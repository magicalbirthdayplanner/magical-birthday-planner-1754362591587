import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { resolveZip } from '@/lib/geo/zip'
import { isValidLatLng } from '@/lib/geo/distance'
import { snapRadius } from '@/lib/discovery/config'
import { partyContextFromRow } from '@/lib/discovery/party-context'
import { DiscoveryUnavailableError, discoverVenues } from '@/lib/discovery/service'
import { discoveryDeps, zipGeocoder } from '@/lib/discovery/server-deps'
import { toClientVenue } from '@/lib/discovery/client-venue'
import { getCategory } from '@/lib/discovery/taxonomy'
import { trackServer } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const Body = z.object({
  partyId: z.string().uuid(),
  radiusMiles: z.number().int().min(1).max(50).optional(),
  categories: z.array(z.string().max(40)).max(10).optional(),
  refresh: z.boolean().optional(),
})

const MESSAGES: Record<string, [number, string]> = {
  quota: [503, 'Our place search is very busy right now. Please try again in a few minutes.'],
  timeout: [504, 'Finding places took too long. Please try again.'],
  not_configured: [503, 'Place search is not configured yet.'],
  google_unavailable: [503, "We couldn't reach our place search right now. Please try again shortly."],
}

/**
 * POST /api/discovery/search { partyId, radiusMiles?, categories?, refresh? }
 * Resolves the party's ZIP (once), then runs cache-first discovery for that party.
 */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in to find places near you.')

  const rl = rateLimit(`discover:${auth.user.id}`, 20, 60_000)
  if (!rl.ok) return apiError(429, 'rate_limited', 'Slow down a little — try again in a moment.', { 'Retry-After': String(rl.retryAfterSeconds) })

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid search request.')
  }
  if (body.refresh && !rateLimit(`discover-refresh:${auth.user.id}`, 5, 3_600_000).ok) {
    body.refresh = false
  }

  // RLS: this only returns the party if it belongs to the caller.
  const { data: party, error } = await auth.supabase
    .from('parties')
    .select('id, child_name, child_age, guest_count, budget, interests, venue_type, zip_code, latitude, longitude, city, state, search_radius_miles')
    .eq('id', body.partyId)
    .maybeSingle()
  if (error) return apiError(500, 'server_error', 'Something went wrong loading your party.')
  if (!party) return apiError(404, 'not_found', 'Party not found.')

  let center = { lat: party.latitude as number, lng: party.longitude as number }
  let city = party.city
  let state = party.state
  if (!isValidLatLng(center)) {
    const loc = await resolveZip(party.zip_code, zipGeocoder(auth.user.id))
    if (!loc) return apiError(422, 'invalid_zip', `We couldn't find ZIP ${party.zip_code ?? ''}. Update it in your party details.`)
    center = { lat: loc.lat, lng: loc.lng }
    city = loc.city
    state = loc.state
    await auth.supabase
      .from('parties')
      .update({ latitude: loc.lat, longitude: loc.lng, city: loc.city, state: loc.state, zip_code: loc.zip })
      .eq('id', party.id)
  }

  const radiusMiles = snapRadius(body.radiusMiles ?? party.search_radius_miles ?? 20)
  if (body.radiusMiles && radiusMiles !== party.search_radius_miles) {
    await auth.supabase.from('parties').update({ search_radius_miles: radiusMiles }).eq('id', party.id)
  }
  const ctx = partyContextFromRow(party, center, party.zip_code ?? '', radiusMiles)
  const categoryIds = body.categories ? Array.from(new Set(body.categories.filter((c) => getCategory(c)))) : undefined

  try {
    const result = await discoverVenues(ctx, discoveryDeps(auth.user.id), { categoryIds: categoryIds?.length ? categoryIds : undefined, forceRefresh: body.refresh })
    trackServer(
      'venue_search_completed',
      {
        results: result.total,
        cacheHits: result.meta.cacheHits,
        cacheMisses: result.meta.cacheMisses,
        apiCalls: result.meta.apiCalls,
        apiErrors: result.meta.apiErrors.length,
        latencyMs: result.meta.latencyMs,
        degraded: result.meta.degraded,
        radiusMiles,
        vendors: !!categoryIds?.length,
      },
      { userId: auth.user.id, partyId: party.id, path: '/api/discovery/search' },
    )
    return NextResponse.json({
      location: { zip: ctx.zip, city, state, lat: center.lat, lng: center.lng, radiusMiles },
      total: result.total,
      venues: result.venues.map((v) => toClientVenue(v)),
      meta: {
        categories: result.meta.categories,
        cacheHits: result.meta.cacheHits,
        cacheMisses: result.meta.cacheMisses,
        degraded: result.meta.degraded,
        partialErrors: result.meta.apiErrors.length,
      },
    })
  } catch (err) {
    const kind = err instanceof DiscoveryUnavailableError ? err.kind : 'google_unavailable'
    trackServer('venue_search_failed', { kind }, { userId: auth.user.id, partyId: party.id })
    if (!(err instanceof DiscoveryUnavailableError)) console.error('discovery failed', err)
    const [status, message] = MESSAGES[kind] ?? MESSAGES.google_unavailable
    return apiError(status, kind as 'quota', message)
  }
}
