import { NextResponse } from 'next/server'
import { createPlacesClient, isValidPhotoName, placeIdFromPhotoName } from '@/lib/google/places'
import { discoveryDeps } from '@/lib/discovery/server-deps'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

const uriCache = new Map<string, { uri: string; expires: number }>()
const knownPlaces = new Map<string, number>()
const TTL_MS = 6 * 3600_000

/**
 * GET /api/discovery/photo?name=places/…/photos/…&w=640
 * Resolves a Places photo to a short-lived googleusercontent URL and redirects.
 * Keeps the API key server-side; only serves photos of places we have surfaced.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const name = url.searchParams.get('name')
  const w = Math.min(1600, Math.max(64, Number(url.searchParams.get('w')) || 640))
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
