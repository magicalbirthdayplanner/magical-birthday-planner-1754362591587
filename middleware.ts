/**
 * Magical Santa on its own domain (same deployment). For the Santa hosts (default magicalholidays.app + www;
 * SANTA_HOSTS overrides, comma-separated):
 *   /            → rewritten to /santa (the URL stays /)
 *   birthday-app pages (/home, /plan, /start, …) → redirected to /
 *   www.<host> → 308 to the apex
 * Every other host (the birthday site) is untouched.
 */
import { NextResponse, type NextRequest } from 'next/server'

// Defaults to the production Santa domain; SANTA_HOSTS overrides (e.g. a test host locally).
const hosts = (process.env.SANTA_HOSTS ?? 'magicalholidays.app,www.magicalholidays.app')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

// Paths a Santa-domain visitor may use as-is.
const ALLOWED = /^\/(santa(\/|$)|api\/|auth\/|_next\/|brands\/|icons\/|favicon|robots\.txt|sitemap\.xml|manifest|sw\.js|privacy|terms|offline)/

export function middleware(req: NextRequest) {
  if (!hosts.length) return NextResponse.next()
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!hosts.includes(host)) return NextResponse.next()
  const { pathname } = req.nextUrl
  // One canonical origin: www → apex.
  if (host.startsWith('www.') && hosts.includes(host.slice(4))) {
    const url = req.nextUrl.clone()
    url.host = host.slice(4)
    url.port = ''
    url.protocol = 'https'
    return NextResponse.redirect(url, 308)
  }
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = '/santa'
    return NextResponse.rewrite(url)
  }
  if (!ALLOWED.test(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // Skip static assets for speed; everything else is checked (cheap when SANTA_HOSTS is empty).
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|webp|svg|ico|js|css|woff2?)$).*)'],
}
