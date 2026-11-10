import { NextResponse } from 'next/server'
import { z } from 'zod'
import { reportError } from '@/lib/observability/telemetry'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { partyContextFromRow } from '@/lib/discovery/party-context'
import { DiscoveryUnavailableError, discoverVenues } from '@/lib/discovery/service'
import { discoveryDeps, resolvePostal } from '@/lib/discovery/server-deps'
import { countryConfig, parseCountryCode } from '@/lib/country/countries'
import { normalizePostal, postalFormatError, postalNotFoundError } from '@/lib/country/postal'
import { toClientVenue } from '@/lib/discovery/client-venue'
import { trackServer } from '@/lib/analytics/server'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = 'force-no-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** How many places the signed-out preview shows; the full list comes with the saved party. */
const PREVIEW_LIMIT = 6

const Body = z.object({
  country: z.string().max(4).optional(),
  zip: z.string().min(1).max(12),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  interests: z.array(z.string().max(24)).max(12).optional(),
})

const MESSAGES: Record<string, [number, string]> = {
  quota: [503, 'Our place search is very busy right now. Save your party and we’ll keep looking.'],
  timeout: [504, 'Finding places took too long. Save your party and we’ll keep looking.'],
  not_configured: [503, 'Place search is not configured yet.'],
  google_unavailable: [503, 'We couldn’t reach our place search right now. Save your party and we’ll keep looking.'],
}

/**
 * POST /api/discovery/preview { country?, zip, childAge?, interests? } — public. The wizard's "ideas near you" before
 * any account exists: the same cache-first discovery as a saved party (default 20-mile radius, either setting, no
 * budget), top PREVIEW_LIMIT places. The location is resolved on the server (never trusted from the client). Guarded by
 * per-IP rate limits and the shared Google call budget; most requests are cache hits on venue_searches.
 */
export async function POST(req: Request) {
  const ip = clientIp(req)
  const minute = rateLimit(`preview:${ip}`, 12, 60_000)
  const hour = minute.ok ? rateLimit(`preview-h:${ip}`, 60, 3_600_000) : minute
  if (!minute.ok || !hour.ok) {
    const rl = minute.ok ? hour : minute
    return apiError(429, 'rate_limited', 'Slow down a little — try again in a moment.', { 'Retry-After': String(rl.retryAfterSeconds) })
  }

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid search request.')
  }
  const country = body.country === undefined ? 'US' : parseCountryCode(body.country)
  if (!country) return apiError(422, 'invalid_request', 'That country isn’t supported yet.')
  const code = normalizePostal(country, body.zip)
  if (!code) return apiError(422, 'invalid_zip', postalFormatError(country))
  const loc = await resolvePostal(country, code, ip)
  if (!loc) return apiError(422, 'invalid_zip', postalNotFoundError(country, code))

  const center = { lat: loc.lat, lng: loc.lng }
  const ctx = partyContextFromRow({ child_age: body.childAge ?? null, interests: body.interests ?? [], venue_type: 'mixed', country_code: country }, center, loc.postalCode, 20)

  try {
    const result = await discoverVenues(ctx, discoveryDeps(`preview:${ip}`))
    trackServer(
      'venue_search_completed',
      {
        preview: true,
        results: result.total,
        cacheHits: result.meta.cacheHits,
        cacheMisses: result.meta.cacheMisses,
        apiCalls: result.meta.apiCalls,
        apiErrors: result.meta.apiErrors.length,
        latencyMs: result.meta.latencyMs,
        degraded: result.meta.degraded,
        radiusMiles: ctx.radiusMiles,
        country,
      },
      { path: '/api/discovery/preview' },
    )
    return NextResponse.json({
      location: { zip: loc.postalCode, city: loc.city, state: loc.state, lat: center.lat, lng: center.lng, radiusMiles: ctx.radiusMiles, country: countryConfig(country).code },
      total: result.total,
      venues: result.venues.slice(0, PREVIEW_LIMIT).map((v) => toClientVenue(v)),
    })
  } catch (err) {
    const kind = err instanceof DiscoveryUnavailableError ? err.kind : 'google_unavailable'
    trackServer('venue_search_failed', { kind, country, preview: true }, { path: '/api/discovery/preview' })
    if (!(err instanceof DiscoveryUnavailableError)) {
      console.error('discovery preview failed', err)
      reportError(err, { area: 'api', op: 'discovery_preview' })
    }
    const [status, message] = MESSAGES[kind] ?? MESSAGES.google_unavailable
    return apiError(status, kind as 'quota', message)
  }
}
