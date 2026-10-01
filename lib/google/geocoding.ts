/** ZIP → coordinates via Google Geocoding (fallback only; see lib/geo/zip.ts). SERVER ONLY. */
import 'server-only'
import type { ZipLocation } from '@/lib/geo/zip'

export function createZipGeocoder(opts: { apiKey?: string; baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
  const baseUrl = (opts.baseUrl ?? process.env.GOOGLE_GEOCODING_API_BASE_URL ?? 'https://maps.googleapis.com').replace(/\/$/, '')
  const doFetch = opts.fetchImpl ?? fetch

  return async function geocodeZip(zip: string): Promise<ZipLocation | null> {
    if (!apiKey || !/^\d{5}$/.test(zip)) return null
    const url = `${baseUrl}/maps/api/geocode/json?components=${encodeURIComponent(`postal_code:${zip}|country:US`)}&key=${encodeURIComponent(apiKey)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000)
    try {
      const res = await doFetch(url, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) return null
      const data = (await res.json()) as {
        status?: string
        results?: { geometry?: { location?: { lat: number; lng: number } }; address_components?: { long_name: string; short_name: string; types: string[] }[] }[]
      }
      const r = data.status === 'OK' ? data.results?.[0] : undefined
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
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}
