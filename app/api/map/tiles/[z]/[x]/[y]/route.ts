import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const STYLE = /^[a-z0-9-]{3,40}$/

/**
 * GET /api/map/tiles/:z/:x/:y → Geoapify raster tile (512 px, for 256 px CSS tiles).
 * Proxied so GEOAPIFY_API_KEY never reaches the browser. Tiles are cacheable at
 * the CDN, so repeat views don't spend Geoapify credits.
 */
export async function GET(req: Request, { params }: { params: { z: string; x: string; y: string } }) {
  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) return apiError(404, 'not_configured', 'Map tiles are not configured.', { 'Cache-Control': 'no-store' })

  const [z, x, y] = [params.z, params.x, params.y].map((v) => (/^\d{1,6}$/.test(v) ? Number(v) : NaN))
  const n = 2 ** z
  if (!(z >= 2 && z <= 18) || !(x >= 0 && x < n) || !(y >= 0 && y < n)) return apiError(400, 'invalid_request', 'Invalid tile.')

  if (!rateLimit(`tile:${clientIp(req)}`, 600, 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests.')
  const hourly = Number(process.env.MAP_TILES_INSTANCE_HOURLY) > 0 ? Number(process.env.MAP_TILES_INSTANCE_HOURLY) : 20_000
  if (!rateLimit('tile:instance', hourly, 3_600_000).ok) return apiError(429, 'rate_limited', 'Map is busy. Try again soon.')

  const style = STYLE.test(process.env.MAP_TILE_STYLE ?? '') ? process.env.MAP_TILE_STYLE! : 'positron'
  const base = (process.env.GEOAPIFY_TILES_BASE_URL || 'https://maps.geoapify.com').replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${base}/v1/tile/${style}/${z}/${x}/${y}@2x.png?apiKey=${encodeURIComponent(apiKey)}`, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
      return apiError(res.status === 429 ? 429 : 502, res.status === 429 ? 'rate_limited' : 'server_error', 'Map tile unavailable.', { 'Cache-Control': 'no-store' })
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type')!,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return apiError(504, 'timeout', 'Map tile unavailable.', { 'Cache-Control': 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}
