import { NextResponse } from 'next/server'
import { resolvePostal } from '@/lib/discovery/server-deps'
import { parseCountryCode } from '@/lib/country/countries'
import { normalizePostal, postalFormatError, postalNotFoundError } from '@/lib/country/postal'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

/**
 * GET /api/discovery/zip?zip=48084[&country=US] → { zip, city, state, lat, lng, country, district, localities }.
 * Public; used by the wizard and party edits. country=IN looks up a 6-digit Indian PIN. Unknown country → 422.
 */
export async function GET(req: Request) {
  const rl = rateLimit(`zip:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return apiError(429, 'rate_limited', 'Too many lookups. Try again in a moment.', { 'Retry-After': String(rl.retryAfterSeconds) })

  const params = new URL(req.url).searchParams
  const countryParam = params.get('country')
  const country = countryParam === null ? 'US' : parseCountryCode(countryParam)
  if (!country) return apiError(422, 'invalid_request', 'That country isn’t supported yet.')
  const code = normalizePostal(country, params.get('zip'))
  if (!code) return apiError(422, 'invalid_zip', postalFormatError(country))

  const loc = await resolvePostal(country, code, clientIp(req))
  if (!loc) return apiError(404, 'invalid_zip', postalNotFoundError(country, code))

  return NextResponse.json(
    { zip: loc.postalCode, city: loc.city, state: loc.state, lat: loc.lat, lng: loc.lng, country: loc.country, district: loc.district, localities: loc.localities, approximate: loc.approximate },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
