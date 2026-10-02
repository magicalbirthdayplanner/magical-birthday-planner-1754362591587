import { NextResponse } from 'next/server'
import { normalizeZip, resolveZip } from '@/lib/geo/zip'
import { zipGeocoder } from '@/lib/discovery/server-deps'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

/** GET /api/discovery/zip?zip=48084 → { zip, city, state, lat, lng }. Public; used by the wizard. */
export async function GET(req: Request) {
  const rl = rateLimit(`zip:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return apiError(429, 'rate_limited', 'Too many lookups. Try again in a moment.', { 'Retry-After': String(rl.retryAfterSeconds) })

  const raw = new URL(req.url).searchParams.get('zip')
  const zip = normalizeZip(raw)
  if (!zip) return apiError(422, 'invalid_zip', 'Please enter a 5-digit US ZIP code.')

  const loc = await resolveZip(zip, zipGeocoder(clientIp(req)))
  if (!loc) return apiError(404, 'invalid_zip', `We couldn't find ZIP ${zip}. Double-check it?`)

  return NextResponse.json(
    { zip: loc.zip, city: loc.city, state: loc.state, lat: loc.lat, lng: loc.lng },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
