/**
 * Launch-state routing layer (temporary pre-launch / waitlist mode, see lib/launch.ts).
 *
 * PRE_LAUNCH: `/`, `/privacy` and `/terms` are served from the pre-launch shell (app/(prelaunch)); product pages
 * (sign-in, sign-up, party creation, pricing, the app itself) redirect to the waitlist at `/`; checkout is refused.
 * LIVE: everything passes through untouched and the pre-launch pages redirect to their public paths.
 *
 * Owner preview: with PRELAUNCH_PREVIEW_TOKEN set, opening any page with `?preview=<token>` sets an httpOnly cookie
 * that shows the normal product during PRE_LAUNCH (`?preview=off` clears it). Without the variable there is no bypass.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { launchState, routeFor } from '@/lib/launch'

const PREVIEW_COOKIE = 'mbp_preview'

const digest = (v: string) => createHash('sha256').update(`mbp-preview:${v}`).digest('hex')
const previewToken = () => {
  const t = process.env.PRELAUNCH_PREVIEW_TOKEN?.trim()
  return t && t.length >= 24 ? t : null
}
const sameDigest = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function middleware(req: NextRequest) {
  const state = launchState()
  const token = previewToken()
  const url = req.nextUrl

  const asked = url.searchParams.get('preview')
  if (asked !== null && state === 'PRE_LAUNCH') {
    const clean = url.clone()
    clean.searchParams.delete('preview')
    const res = NextResponse.redirect(clean)
    res.headers.set('Cache-Control', 'no-store')
    if (asked === 'off') res.cookies.delete(PREVIEW_COOKIE)
    else if (token && sameDigest(digest(asked), digest(token))) {
      res.cookies.set(PREVIEW_COOKIE, digest(token), { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 7 * 86_400 })
    }
    return res
  }

  const cookie = req.cookies.get(PREVIEW_COOKIE)?.value
  const preview = !!(token && cookie && sameDigest(cookie, digest(token)))
  const route = routeFor(url.pathname, state, preview)

  switch (route.action) {
    case 'next':
      return NextResponse.next()
    case 'rewrite': {
      const to = url.clone()
      to.pathname = route.to
      return NextResponse.rewrite(to)
    }
    case 'redirect': {
      const to = url.clone()
      to.pathname = route.to
      const res = NextResponse.redirect(to, 307) // temporary: never cached as permanent by browsers
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    case 'block':
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Magical Birthday Planner opens on October 13.' } },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
  }
}

export const config = {
  runtime: 'nodejs',
  // Pages (no static files, no Next internals) + the one API the pre-launch closes. Webhooks, health, RSVP and
  // waitlist APIs never pass through here.
  matcher: ['/((?!_next/|api/|.*\\.[A-Za-z0-9]+$).*)', '/api/billing/checkout'],
}
