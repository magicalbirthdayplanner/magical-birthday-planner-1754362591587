/**
 * Geoapify Places + Geocoding client. SERVER ONLY — uses GEOAPIFY_API_KEY.
 *
 * Data is OpenStreetMap-based: there are no ratings, review counts, prices or
 * photos. Those fields stay null — never invented. Unnamed features are skipped
 * (`conditions=named`), so every result is a place a parent can look up.
 *
 * The key travels in the query string (Geoapify's only auth method): request
 * URLs are never logged or put into error messages.
 */
import 'server-only'
import type { LatLng } from '@/lib/geo/distance'
import type { ZipLocation } from '@/lib/geo/zip'
import type { OpeningHours, Venue } from '@/lib/discovery/types'
import { PlacesError, type PlacesErrorKind } from '@/lib/google/places'
import { GEOAPIFY_ID_PREFIX, categoriesForGeoapify, primaryGeoapifyType } from './categories'

export interface GeoapifyProperties {
  place_id?: string
  name?: string
  categories?: string[]
  formatted?: string
  address_line1?: string
  address_line2?: string
  housenumber?: string
  street?: string
  city?: string
  state_code?: string
  postcode?: string
  lat?: number
  lon?: number
  website?: string
  opening_hours?: string
  contact?: { phone?: string; email?: string }
  datasource?: { raw?: Record<string, unknown> }
}

export interface GeoapifyClientOptions {
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export interface GeoapifySearchParams {
  categories: string[]
  center: LatLng
  radiusMeters: number
  limit?: number
}

export interface GeoapifyApi {
  searchPlaces(params: GeoapifySearchParams): Promise<GeoapifyProperties[]>
  placeDetails(placeId: string): Promise<GeoapifyProperties | null>
  geocodeZip(zip: string): Promise<ZipLocation | null>
}

const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const stripCountry = (s: string | null) => s?.replace(/,\s*United States of America$/, '').replace(/,\s*United States$/, '') ?? null

const DAYS: Record<string, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun', PH: 'Holidays' }

/** OSM `opening_hours` ("Mo-Fr 09:00-17:00; Sa 10:00-14:00") → readable lines. */
export function openingHoursFromOsm(raw: unknown): OpeningHours | null {
  const s = str(raw)
  if (!s || s.length > 500) return null
  const lines = s
    .split(';')
    .map((part) =>
      part
        .trim()
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAYS[d])
        .replace(/,(?=\S)/g, ', ')
        .replace(/(\w)-(\w)/g, '$1–$2')
        // "Mon–Fri 09:00–17:00" → "Mon–Fri: 09:00–17:00" (the detail screen splits on ": ")
        .replace(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Holidays)[A-Za-z–, ]*?)\s+(?=\d|off|closed)/i, '$1: '),
    )
    .filter(Boolean)
  return lines.length ? { weekdayDescriptions: lines, openNow: null } : null
}

const label = (category: string | null) => {
  const last = category?.split('.').pop()
  return last ? last.charAt(0).toUpperCase() + last.slice(1).replace(/_/g, ' ') : null
}

/** Normalize a Geoapify feature. Returns null without an id, a name, or a location. */
export function normalizeGeoapifyPlace(p: GeoapifyProperties, extraCategories: string[] = [], now = new Date()): Venue | null {
  if (!p || typeof p !== 'object') return null
  const rawId = str(p.place_id)
  const name = str(p.name)
  const lat = num(p.lat)
  const lng = num(p.lon)
  if (!rawId || !/^[A-Za-z0-9]{10,200}$/.test(rawId) || !name || lat == null || lng == null) return null

  const types = Array.isArray(p.categories) ? p.categories.filter((t): t is string => typeof t === 'string') : []
  const primaryType = primaryGeoapifyType(types)
  const raw = (p.datasource?.raw ?? {}) as Record<string, unknown>
  const line1 = str(p.address_line1)
  const line2 = stripCountry(str(p.address_line2))
  const address = line1 && line1 !== name ? [line1, line2].filter(Boolean).join(', ') : line2
  const street = [str(p.housenumber), str(p.street)].filter(Boolean).join(' ')
  const website = str(p.website) ?? str(raw.website) ?? str(raw['contact:website'])

  return {
    placeId: `${GEOAPIFY_ID_PREFIX}${rawId}`,
    name,
    address: address || stripCountry(str(p.formatted)),
    shortAddress: [street || null, str(p.city)].filter(Boolean).join(', ') || null,
    city: str(p.city),
    state: str(p.state_code),
    postalCode: str(p.postcode),
    lat,
    lng,
    rating: null,
    reviewCount: null,
    priceLevel: null,
    types,
    primaryType,
    primaryTypeLabel: label(primaryType),
    categories: Array.from(new Set([...extraCategories, ...categoriesForGeoapify(types, name)])),
    photos: [],
    businessStatus: null,
    googleMapsUrl: null,
    phone: str(p.contact?.phone) ?? str(raw.phone) ?? str(raw['contact:phone']),
    website: website && /^https?:\/\//i.test(website) ? website : null,
    openingHours: openingHoursFromOsm(p.opening_hours ?? raw.opening_hours),
    editorialSummary: null,
    goodForChildren: null,
    goodForGroups: null,
    maxCapacity: null,
    lastSyncedAt: now.toISOString(),
    detailsSyncedAt: null,
  }
}

export function createGeoapifyClient(opts: GeoapifyClientOptions = {}): GeoapifyApi {
  const apiKey = opts.apiKey ?? process.env.GEOAPIFY_API_KEY ?? ''
  const baseUrl = (opts.baseUrl ?? process.env.GEOAPIFY_API_BASE_URL ?? 'https://api.geoapify.com').replace(/\/$/, '')
  const timeoutMs = opts.timeoutMs ?? 6000
  const doFetch = opts.fetchImpl ?? fetch

  async function call(path: string, params: Record<string, string>): Promise<{ features?: { properties?: GeoapifyProperties }[]; results?: GeoapifyProperties[] }> {
    if (!apiKey) throw new PlacesError('not_configured', 'GEOAPIFY_API_KEY is not set')
    const qs = new URLSearchParams({ ...params, apiKey })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await doFetch(`${baseUrl}${path}?${qs.toString()}`, { signal: controller.signal, cache: 'no-store' })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new PlacesError('timeout', `Geoapify request timed out after ${timeoutMs}ms`)
      throw new PlacesError('network', 'Geoapify request failed')
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      const kind: PlacesErrorKind =
        res.status === 429 ? 'quota' : res.status === 401 || res.status === 403 ? 'auth' : res.status === 404 ? 'not_found' : res.status === 400 ? 'invalid_request' : 'unavailable'
      throw new PlacesError(kind, `Geoapify ${path} ${res.status}`, res.status)
    }
    try {
      const data = await res.json()
      if (!data || typeof data !== 'object') throw new Error('not an object')
      return data
    } catch {
      throw new PlacesError('unavailable', 'Geoapify returned a malformed response', res.status)
    }
  }

  const props = (data: { features?: { properties?: GeoapifyProperties }[] }) =>
    (Array.isArray(data.features) ? data.features : []).map((f) => f?.properties).filter((p): p is GeoapifyProperties => !!p && typeof p === 'object')

  return {
    async searchPlaces({ categories, center, radiusMeters, limit = 20 }) {
      if (!categories.length) return []
      const r = Math.round(Math.min(80_000, Math.max(100, radiusMeters)))
      return props(
        await call('/v2/places', {
          categories: categories.join(','),
          conditions: 'named',
          filter: `circle:${center.lng},${center.lat},${r}`,
          bias: `proximity:${center.lng},${center.lat}`,
          limit: String(Math.min(50, Math.max(1, limit))),
          lang: 'en',
        }),
      )
    },

    async placeDetails(placeId) {
      if (!/^[A-Za-z0-9]{10,200}$/.test(placeId)) throw new PlacesError('invalid_request', 'Invalid place id')
      return props(await call('/v2/place-details', { id: placeId, features: 'details', lang: 'en' }))[0] ?? null
    },

    async geocodeZip(zip) {
      if (!/^\d{5}$/.test(zip)) return null
      const data = await call('/v1/geocode/search', { postcode: zip, type: 'postcode', filter: 'countrycode:us', format: 'json', limit: '1' })
      const r = Array.isArray(data.results) ? data.results.find((x) => str(x?.postcode) === zip) : undefined
      const lat = num(r?.lat)
      const lng = num(r?.lon)
      if (!r || lat == null || lng == null) return null
      return { zip, lat, lng, city: str(r.city), state: str(r.state_code), source: 'geocoding' }
    },
  }
}
