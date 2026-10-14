/** US ZIP / Indian PIN → coordinates via Google Geocoding (see lib/geo/zip.ts, lib/geo/pin.ts). SERVER ONLY. */
import 'server-only'
import type { ZipLocation } from '@/lib/geo/zip'
import { placesFailed, placesSucceeded } from '@/lib/observability/google'

export function createZipGeocoder(opts: { apiKey?: string; baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
  const baseUrl = (opts.baseUrl ?? process.env.GOOGLE_GEOCODING_API_BASE_URL ?? 'https://maps.googleapis.com').replace(/\/$/, '')
  const doFetch = opts.fetchImpl ?? fetch

  return async function geocodeZip(zip: string): Promise<ZipLocation | null> {
    if (!apiKey || !/^\d{5}$/.test(zip)) return null
    const url = `${baseUrl}/maps/api/geocode/json?components=${encodeURIComponent(`postal_code:${zip}|country:US`)}&key=${encodeURIComponent(apiKey)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000)
    const started = Date.now()
    try {
      const res = await doFetch(url, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) {
        placesFailed('geocode', Date.now() - started, res.status === 429 ? 'quota' : res.status === 401 || res.status === 403 ? 'auth' : 'unavailable', res.status)
        return null
      }
      const data = (await res.json()) as {
        status?: string
        results?: { geometry?: { location?: { lat: number; lng: number } }; address_components?: { long_name: string; short_name: string; types: string[] }[] }[]
      }
      const r = data.status === 'OK' ? data.results?.[0] : undefined
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') placesSucceeded('geocode', Date.now() - started, data.results?.length ?? 0)
      else placesFailed('geocode', Date.now() - started, data.status === 'OVER_QUERY_LIMIT' ? 'quota' : data.status === 'REQUEST_DENIED' ? 'auth' : 'unavailable', res.status)
      const loc = r?.geometry?.location
      if (!loc) return null
      const find = (t: string) => r?.address_components?.find((c) => c.types.includes(t))
      return {
        zip,
        lat: loc.lat,
        lng: loc.lng,
        city: find('locality')?.long_name ?? find('postal_town')?.long_name ?? null,
        state: find('administrative_area_level_1')?.short_name ?? null,
        source: 'geocoding',
      }
    } catch (err) {
      placesFailed('geocode', Date.now() - started, (err as Error)?.name === 'AbortError' ? 'timeout' : 'network')
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

/** What Google Geocoding knows about an Indian PIN (any field may be missing — that never invalidates a PIN). */
export interface PinGeocode {
  pin: string
  lat: number
  lng: number
  city: string | null
  locality: string | null
  district: string | null
  state: string | null
}

/** Indian PIN → coordinates via Google Geocoding (components=postal_code|country:IN). SERVER ONLY. */
export function createPinGeocoder(opts: { apiKey?: string; baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch; onDenied?: () => void } = {}) {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
  const baseUrl = (opts.baseUrl ?? process.env.GOOGLE_GEOCODING_API_BASE_URL ?? 'https://maps.googleapis.com').replace(/\/$/, '')
  const doFetch = opts.fetchImpl ?? fetch

  return async function geocodePin(pin: string): Promise<PinGeocode | null> {
    if (!apiKey || !/^[1-9]\d{5}$/.test(pin)) return null
    const url = `${baseUrl}/maps/api/geocode/json?components=${encodeURIComponent(`postal_code:${pin}|country:IN`)}&region=in&key=${encodeURIComponent(apiKey)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000)
    const started = Date.now()
    try {
      const res = await doFetch(url, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) opts.onDenied?.()
        placesFailed('geocode', Date.now() - started, res.status === 429 ? 'quota' : res.status === 401 || res.status === 403 ? 'auth' : 'unavailable', res.status)
        return null
      }
      const data = (await res.json()) as {
        status?: string
        results?: { geometry?: { location?: { lat: number; lng: number } }; address_components?: { long_name: string; short_name: string; types: string[] }[] }[]
      }
      if (data.status === 'REQUEST_DENIED') opts.onDenied?.() // Geocoding API not enabled on this key
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') placesSucceeded('geocode', Date.now() - started, data.results?.length ?? 0)
      else placesFailed('geocode', Date.now() - started, data.status === 'OVER_QUERY_LIMIT' ? 'quota' : data.status === 'REQUEST_DENIED' ? 'auth' : 'unavailable', res.status)
      const r = data.status === 'OK' ? data.results?.[0] : undefined
      const loc = r?.geometry?.location
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null
      const find = (t: string) => r?.address_components?.find((c) => c.types.includes(t))?.long_name ?? null
      // A geocode outside India means Google matched something else — never use it.
      if (r?.address_components?.some((c) => c.types.includes('country') && c.short_name !== 'IN')) return null
      return {
        pin,
        lat: loc.lat,
        lng: loc.lng,
        city: find('locality') ?? find('administrative_area_level_3'),
        locality: find('sublocality_level_1') ?? find('sublocality') ?? find('neighborhood'),
        district: find('administrative_area_level_3') ?? find('administrative_area_level_2'),
        state: find('administrative_area_level_1'),
      }
    } catch (err) {
      placesFailed('geocode', Date.now() - started, (err as Error)?.name === 'AbortError' ? 'timeout' : 'network')
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Indian PIN → location through Places API (New) Text Search ("560034, India" → a `postal_code` place). Used when
 * the Geocoding API is unavailable on the key, so India works with the API the app already uses. Only a result that
 * IS that postal code in India is accepted. SERVER ONLY.
 */
export function createPlacesPinGeocoder(opts: { apiKey?: string; baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
  const baseUrl = (opts.baseUrl ?? process.env.GOOGLE_PLACES_API_BASE_URL ?? 'https://places.googleapis.com').replace(/\/$/, '')
  const doFetch = opts.fetchImpl ?? fetch

  return async function placesPin(pin: string): Promise<PinGeocode | null> {
    if (!apiKey || !/^[1-9]\d{5}$/.test(pin)) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000)
    const started = Date.now()
    try {
      const res = await doFetch(`${baseUrl}/v1/places:searchText`, {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.types,places.location,places.addressComponents' },
        body: JSON.stringify({ textQuery: `${pin}, India`, regionCode: 'IN', languageCode: 'en', pageSize: 1 }),
      })
      if (!res.ok) {
        placesFailed('geocode', Date.now() - started, res.status === 429 ? 'quota' : res.status === 401 || res.status === 403 ? 'auth' : 'unavailable', res.status)
        return null
      }
      const data = (await res.json()) as { places?: { types?: string[]; location?: { latitude?: number; longitude?: number }; addressComponents?: { longText?: string; shortText?: string; types?: string[] }[] }[] }
      placesSucceeded('geocode', Date.now() - started, data.places?.length ?? 0)
      const p = data.places?.[0]
      const find = (t: string) => p?.addressComponents?.find((c) => c.types?.includes(t))
      const lat = p?.location?.latitude
      const lng = p?.location?.longitude
      if (!p?.types?.includes('postal_code') || find('postal_code')?.longText !== pin || find('country')?.shortText !== 'IN') return null
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        pin,
        lat,
        lng,
        city: find('locality')?.longText ?? find('administrative_area_level_3')?.longText ?? null,
        locality: find('sublocality_level_1')?.longText ?? find('sublocality')?.longText ?? null,
        district: find('administrative_area_level_3')?.longText ?? null,
        state: find('administrative_area_level_1')?.longText ?? null,
      }
    } catch (err) {
      placesFailed('geocode', Date.now() - started, (err as Error)?.name === 'AbortError' ? 'timeout' : 'network')
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}
