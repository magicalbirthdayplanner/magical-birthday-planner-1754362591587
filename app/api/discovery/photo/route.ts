import { NextResponse } from 'next/server'
import { createPlacesClient, isValidPhotoName, placeIdFromPhotoName } from '@/lib/google/places'
import { discoveryDeps } from '@/lib/discovery/server-deps'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { googleBudgetFor } from '@/lib/server/google-budget'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const uriCache = new Map<string, { uri: string; expires: number }>()
const knownPlaces = new Map<string, number>()
const TTL_MS = 6 * 3600_000
const PHOTO_WIDTHS = [320, 640, 960, 1600] as const

/**
 * GET /api/discovery/photo?name=places/…/photos/…&w=640
 * Resolves a Places photo to a short-lived googleusercontent URL and redirects.
 * Keeps the API key server-side; only serves photos of places we have surfaced.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const name = url.searchParams.get('name')
  // Snap to a few widths: arbitrary values must not mint new (paid) cache misses.
  const requested = Number(url.searchParams.get('w')) || 640
  const w = PHOTO_WIDTHS.find((x) => x >= requested) ?? PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1]
  if (!isValidPhotoName(name)) return apiError(400, 'invalid_request', 'Invalid photo.')

  if (!rateLimit(`photo:${clientIp(req)}`, 240, 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests.')

  const key = `${name}|${w}`
  const now = Date.now()
  const hit = uriCache.get(key)
  if (hit && hit.expires > now) return redirect(hit.uri)

  const placeId = placeIdFromPhotoName(name)!
  if (!((knownPlaces.get(placeId) ?? 0) > now)) {
    const known = await discoveryDeps().store.hasPlace(placeId).catch(() => false)
    if (!known) return apiError(404, 'not_found', 'Photo not found.')
    knownPlaces.set(placeId, now + TTL_MS)
  }

  // Only uncached photos reach Google: cap them per IP per hour and charge the shared budget.
  if (!rateLimit(`photo-miss:${clientIp(req)}`, 600, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many requests.')
  if (!googleBudgetFor(`photo:${clientIp(req)}`).allow(1)) return apiError(429, 'quota', 'Photos are busy right now.')
  try {
    const uri = await createPlacesClient({ timeoutMs: 5000 }).getPhotoUri(name, w)
    if (uriCache.size > 5000) uriCache.clear()
    uriCache.set(key, { uri, expires: now + TTL_MS })
    return redirect(uri)
  } catch {
    return apiError(404, 'not_found', 'Photo not available.')
  }
}

function redirect(uri: string) {
  return NextResponse.redirect(uri, { status: 302, headers: { 'Cache-Control': 'public, max-age=21600, s-maxage=21600' } })
}
