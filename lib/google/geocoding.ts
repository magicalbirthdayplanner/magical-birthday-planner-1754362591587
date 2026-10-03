/** ZIP → coordinates via Google Geocoding (fallback only; see lib/geo/zip.ts). SERVER ONLY. */
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
