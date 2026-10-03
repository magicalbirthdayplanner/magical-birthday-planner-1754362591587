/**
 * Google Places API (New) client. SERVER ONLY — uses GOOGLE_PLACES_API_KEY.
 *
 * Cost control:
 *  - Text Search uses a field mask without contact/hours/atmosphere fields.
 *  - Place Details (phone, website, hours, kid/group suitability) is fetched only
 *    when a parent opens a venue, then cached (see lib/discovery/service.ts).
 *  - Photo media is requested with skipHttpRedirect so the browser receives a
 *    short-lived googleusercontent URL — the API key never leaves the server.
 */
import 'server-only'
import type { LatLng } from '@/lib/geo/distance'
import type { OpeningHours, PhotoRef, Venue } from '@/lib/discovery/types'
import { categoriesForGoogleTypes } from '@/lib/discovery/taxonomy'
import { placesFailed, placesSucceeded, type PlacesOp } from '@/lib/observability/google'

export type PlacesErrorKind =
  | 'not_configured'
  | 'timeout'
  | 'quota'
  | 'auth'
  | 'invalid_request'
  | 'not_found'
  | 'unavailable'
  | 'network'

export class PlacesError extends Error {
  constructor(
    public kind: PlacesErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'PlacesError'
  }
}

export const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.photos',
  'places.businessStatus',
  'places.googleMapsUri',
].join(',')

export const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'shortFormattedAddress',
  'addressComponents',
  'location',
  'types',
  'primaryType',
  'primaryTypeDisplayName',
  'rating',
  'userRatingCount',
  'priceLevel',
  'photos',
  'businessStatus',
  'googleMapsUri',
  'nationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
  'editorialSummary',
  'goodForChildren',
  'goodForGroups',
].join(',')

// ---------------------------------------------------------------- raw API shapes (subset)
interface RawPhoto {
  name?: string
  widthPx?: number
  heightPx?: number
  authorAttributions?: { displayName?: string; uri?: string }[]
}
interface RawAddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
}
export interface RawPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  addressComponents?: RawAddressComponent[]
  location?: { latitude?: number; longitude?: number }
  types?: string[]
  primaryType?: string
  primaryTypeDisplayName?: { text?: string }
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  photos?: RawPhoto[]
  businessStatus?: string
  googleMapsUri?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean }
  editorialSummary?: { text?: string }
  goodForChildren?: boolean
  goodForGroups?: boolean
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

const component = (place: RawPlace, type: string, short = false) => {
  const c = place.addressComponents?.find((x) => x.types?.includes(type))
  return (short ? c?.shortText : c?.longText) ?? null
}

const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const bool = (x: unknown) => (typeof x === 'boolean' ? x : null)

/** Normalize a raw place. Returns null when the place lacks an id, name, or location. */
export function normalizePlace(place: RawPlace, extraCategories: string[] = [], now = new Date()): Venue | null {
  if (!place || typeof place !== 'object') return null
  const placeId = str(place.id)
  const name = str(place.displayName?.text)
  const lat = num(place.location?.latitude)
  const lng = num(place.location?.longitude)
  if (!placeId || !name || lat == null || lng == null) return null

  const photos: PhotoRef[] = (place.photos ?? [])
    .filter((p): p is RawPhoto & { name: string } => typeof p.name === 'string' && p.name.startsWith('places/'))
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      widthPx: num(p.widthPx),
      heightPx: num(p.heightPx),
      attributions: (p.authorAttributions ?? [])
        .filter((a) => str(a.displayName))
        .map((a) => ({ displayName: a.displayName!.trim(), uri: str(a.uri) })),
    }))

  const types = Array.isArray(place.types) ? place.types.filter((t) => typeof t === 'string') : []
  const categories = Array.from(new Set([...extraCategories, ...categoriesForGoogleTypes(types)]))
  const hours: OpeningHours | null = place.regularOpeningHours?.weekdayDescriptions?.length
    ? {
        weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions.filter((d) => typeof d === 'string'),
        openNow: bool(place.regularOpeningHours.openNow),
      }
    : null
  const priceLevel = place.priceLevel != null && place.priceLevel in PRICE_LEVELS ? PRICE_LEVELS[place.priceLevel] : null

  return {
    placeId,
    name,
    address: str(place.formattedAddress),
    shortAddress: str(place.shortFormattedAddress),
    city: component(place, 'locality') ?? component(place, 'postal_town'),
    state: component(place, 'administrative_area_level_1', true),
    postalCode: component(place, 'postal_code'),
    lat,
    lng,
    rating: num(place.rating),
    reviewCount: num(place.userRatingCount),
    priceLevel,
    types,
    primaryType: str(place.primaryType),
    primaryTypeLabel: str(place.primaryTypeDisplayName?.text),
    categories,
    photos,
    businessStatus: str(place.businessStatus),
    googleMapsUrl: str(place.googleMapsUri),
    phone: str(place.nationalPhoneNumber),
    website: str(place.websiteUri),
    openingHours: hours,
    editorialSummary: str(place.editorialSummary?.text),
    goodForChildren: bool(place.goodForChildren),
    goodForGroups: bool(place.goodForGroups),
    maxCapacity: null,
    lastSyncedAt: now.toISOString(),
    detailsSyncedAt: null,
  }
}

// ---------------------------------------------------------------- client
export interface PlacesClientOptions {
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export interface TextSearchParams {
  textQuery: string
  center: LatLng
  radiusMeters: number
  pageSize?: number
}

export interface PlacesApi {
  searchText(params: TextSearchParams): Promise<RawPlace[]>
  getPlace(placeId: string): Promise<RawPlace>
  getPhotoUri(photoName: string, maxWidthPx: number): Promise<string>
}

export function createPlacesClient(opts: PlacesClientOptions = {}): PlacesApi {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
  const baseUrl = (opts.baseUrl ?? process.env.GOOGLE_PLACES_API_BASE_URL ?? 'https://places.googleapis.com').replace(/\/$/, '')
  const timeoutMs = opts.timeoutMs ?? 8000
  const doFetch = opts.fetchImpl ?? fetch

  async function call(path: string, init: RequestInit & { fieldMask?: string }): Promise<unknown> {
    if (!apiKey) throw new PlacesError('not_configured', 'GOOGLE_PLACES_API_KEY is not set')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          ...(init.fieldMask ? { 'X-Goog-FieldMask': init.fieldMask } : {}),
        },
        cache: 'no-store',
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new PlacesError('timeout', `Places request timed out after ${timeoutMs}ms`)
      throw new PlacesError('network', `Places request failed: ${(err as Error)?.message ?? err}`)
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      let detail = ''
      try {
        const body = (await res.json()) as { error?: { status?: string; message?: string } }
        detail = `${body.error?.status ?? ''} ${body.error?.message ?? ''}`.trim()
      } catch {
        /* ignore */
      }
      const kind: PlacesErrorKind =
        res.status === 429 || /RESOURCE_EXHAUSTED/.test(detail)
          ? 'quota'
          : res.status === 401 || res.status === 403
            ? 'auth'
            : res.status === 404
              ? 'not_found'
              : res.status === 400
                ? 'invalid_request'
                : 'unavailable'
      throw new PlacesError(kind, `Places API ${res.status} ${detail}`.trim(), res.status)
    }
    try {
      return await res.json()
    } catch {
      throw new PlacesError('unavailable', 'Places API returned a malformed response', res.status)
    }
  }

  /** Telemetry: success/failure, latency and status for every Places call (never the key, query or payload). */
  async function observed<T>(op: PlacesOp, run: () => Promise<T>, count?: (r: T) => number): Promise<T> {
    const started = Date.now()
    try {
      const r = await run()
      placesSucceeded(op, Date.now() - started, count?.(r))
      return r
    } catch (err) {
      const e = err instanceof PlacesError ? err : null
      placesFailed(op, Date.now() - started, e?.kind ?? 'unexpected', e?.status)
      throw err
    }
  }

  const api: PlacesApi = {
    async searchText({ textQuery, center, radiusMeters, pageSize = 20 }) {
      // Hard restriction to the circle's bounding box: Google never returns (and we never
      // pay for) places outside it. Ranking then trims the corners to the true radius.
      const r = Math.min(85_000, Math.max(100, radiusMeters)) // 50 mi max radius + margin
      const dLat = r / 111_320
      const dLng = r / (111_320 * Math.max(0.01, Math.cos((center.lat * Math.PI) / 180)))
      const body = {
        textQuery,
        pageSize: Math.min(20, Math.max(1, pageSize)),
        languageCode: 'en',
        regionCode: 'US',
        locationRestriction: {
          rectangle: {
            low: { latitude: center.lat - dLat, longitude: center.lng - dLng },
            high: { latitude: center.lat + dLat, longitude: center.lng + dLng },
          },
        },
      }
      const data = (await call('/v1/places:searchText', {
        method: 'POST',
        body: JSON.stringify(body),
        fieldMask: SEARCH_FIELD_MASK,
      })) as { places?: RawPlace[] }
      if (data !== null && typeof data !== 'object') throw new PlacesError('unavailable', 'Places API returned a malformed response')
      return Array.isArray(data?.places) ? data.places.filter((p): p is RawPlace => !!p && typeof p === 'object') : []
    },

    async getPlace(placeId) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) throw new PlacesError('invalid_request', 'Invalid place id')
      return (await call(`/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
        method: 'GET',
        fieldMask: DETAILS_FIELD_MASK,
      })) as RawPlace
    },

    async getPhotoUri(photoName, maxWidthPx) {
      if (!isValidPhotoName(photoName)) throw new PlacesError('invalid_request', 'Invalid photo name')
      const w = Math.min(1600, Math.max(64, Math.round(maxWidthPx)))
      const data = (await call(`/v1/${photoName}/media?maxWidthPx=${w}&skipHttpRedirect=true`, {
        method: 'GET',
      })) as { photoUri?: string }
      if (!data?.photoUri) throw new PlacesError('not_found', 'No photo URI returned')
      return data.photoUri
    },
  }
  return {
    searchText: (p) => observed('search', () => api.searchText(p), (r) => r.length),
    getPlace: (id) => observed('details', () => api.getPlace(id)),
    getPhotoUri: (name, w) => observed('photo', () => api.getPhotoUri(name, w)),
  }
}

export function isValidPhotoName(name: unknown): name is string {
  return typeof name === 'string' && /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,1000}$/.test(name)
}

export function placeIdFromPhotoName(name: string): string | null {
  return name.match(/^places\/([^/]+)\/photos\//)?.[1] ?? null
}
