import { NextResponse } from 'next/server'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { isValidLatLng } from '@/lib/geo/distance'
import { partyContextFromRow } from '@/lib/discovery/party-context'
import type { PartyContext } from '@/lib/discovery/types'
import { getVenueDetails } from '@/lib/discovery/service'
import { discoveryDeps } from '@/lib/discovery/server-deps'
import { toClientVenue } from '@/lib/discovery/client-venue'
import { PlacesError } from '@/lib/google/places'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

/** GET /api/discovery/places/:placeId?partyId=… → full venue details (+ "why recommended" for that party). */
export async function GET(req: Request, props: { params: Promise<{ placeId: string }> }) {
  const params = await props.params
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in to view venue details.')
  if (!rateLimit(`details:${auth.user.id}`, 60, 60_000).ok) return apiError(429, 'rate_limited', 'Slow down a little — try again in a moment.')

  const placeId = params.placeId
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return apiError(400, 'invalid_request', 'Invalid place.')

  const partyId = new URL(req.url).searchParams.get('partyId')
  let ctx: PartyContext | null = null
  if (partyId && /^[0-9a-f-]{36}$/i.test(partyId)) {
    const { data: party } = await auth.supabase
      .from('parties')
      .select('child_name, child_age, guest_count, budget, interests, venue_type, zip_code, latitude, longitude, search_radius_miles')
      .eq('id', partyId)
      .maybeSingle()
    const center = { lat: party?.latitude as number, lng: party?.longitude as number }
    if (party && isValidLatLng(center)) ctx = partyContextFromRow(party, center, party.zip_code ?? '')
  }

  // Details are only fetched for places discovery already surfaced: a client cannot
  // make us pay for Place Details on arbitrary place ids.
  const deps = discoveryDeps(auth.user.id)
  if (!(await deps.store.hasPlace(placeId).catch(() => false))) return apiError(404, 'not_found', "We couldn't find that place.")

  try {
    const { venue, stale } = await getVenueDetails(placeId, deps, ctx)
    return NextResponse.json({ venue: toClientVenue(venue, { allPhotos: true, photoWidth: 960 }), stale })
  } catch (err) {
    if (err instanceof PlacesError && (err.kind === 'not_found' || err.kind === 'invalid_request')) {
      return apiError(404, 'not_found', "We couldn't find that place.")
    }
    return apiError(503, 'google_unavailable', "We couldn't load this place right now. Please try again.")
  }
}
