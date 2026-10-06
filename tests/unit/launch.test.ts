/**
 * Pre-launch mode: the Oct 6–12 (America/New_York) window, the routing decisions and the owner-preview cookie.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { LAUNCH_AT, PRELAUNCH_STARTS_AT, launchState, routeFor, zonedTimeToInstant } from '@/lib/launch'
import { countdownLabel } from '@/components/prelaunch/Countdown'

const ET = (d: number, h = 0, mi = 0, s = 0) => zonedTimeToInstant(2026, 10, d, h, mi, s)
const AUTO = {} // no PRELAUNCH_MODE override

describe('launch window (America/New_York)', () => {
  it('starts Oct 6 00:00 EDT and launches Oct 13 00:00 EDT (UTC−4)', () => {
    expect(PRELAUNCH_STARTS_AT.toISOString()).toBe('2026-10-06T04:00:00.000Z')
    expect(LAUNCH_AT.toISOString()).toBe('2026-10-13T04:00:00.000Z')
  })

  it('October 6 → October 12 is PRE_LAUNCH; October 13 12:00:00 AM ET is LIVE', () => {
    expect(launchState(ET(5, 23, 59, 59), AUTO)).toBe('LIVE') // before the window
    expect(launchState(ET(6), AUTO)).toBe('PRE_LAUNCH')
    for (let d = 6; d <= 12; d++) expect(launchState(ET(d, 12), AUTO), `Oct ${d}`).toBe('PRE_LAUNCH')
    expect(launchState(ET(12, 23, 59), AUTO)).toBe('PRE_LAUNCH') // Oct 12, 11:59 PM ET
    expect(launchState(ET(12, 23, 59, 59), AUTO)).toBe('PRE_LAUNCH')
    expect(launchState(LAUNCH_AT.getTime() - 1, AUTO)).toBe('PRE_LAUNCH') // last millisecond
    expect(launchState(ET(13), AUTO)).toBe('LIVE') // Oct 13, 12:00:00 AM ET
    expect(launchState(ET(13, 9), AUTO)).toBe('LIVE')
    expect(launchState(new Date('2027-01-01T00:00:00Z'), AUTO)).toBe('LIVE')
  })

  it('is not UTC: Oct 13 00:30 UTC is still Oct 12 in New York', () => {
    expect(launchState(new Date('2026-10-13T00:30:00Z'), AUTO)).toBe('PRE_LAUNCH')
    expect(launchState(new Date('2026-10-13T03:59:59Z'), AUTO)).toBe('PRE_LAUNCH')
    expect(launchState(new Date('2026-10-13T04:00:00Z'), AUTO)).toBe('LIVE')
  })

  describe('does not depend on the server time zone', () => {
    const original = process.env.TZ
    afterEach(() => {
      process.env.TZ = original
    })
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Auckland', 'America/New_York']) {
      it(tz, () => {
        process.env.TZ = tz
        expect(zonedTimeToInstant(2026, 10, 13).toISOString()).toBe('2026-10-13T04:00:00.000Z')
        expect(launchState(new Date('2026-10-13T03:59:59.999Z'), AUTO)).toBe('PRE_LAUNCH')
      })
    }
  })

  it('handles daylight saving time (EST after Nov 1)', () => {
    expect(zonedTimeToInstant(2026, 11, 2).toISOString()).toBe('2026-11-02T05:00:00.000Z')
    expect(zonedTimeToInstant(2026, 3, 9).toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })

  it('PRELAUNCH_MODE forces the state; anything else means auto', () => {
    expect(launchState(ET(20), { PRELAUNCH_MODE: 'on' })).toBe('PRE_LAUNCH')
    expect(launchState(ET(8), { PRELAUNCH_MODE: 'off' })).toBe('LIVE')
    expect(launchState(ET(8), { PRELAUNCH_MODE: 'auto' })).toBe('PRE_LAUNCH')
    expect(launchState(ET(8), { PRELAUNCH_MODE: 'banana' })).toBe('PRE_LAUNCH')
  })
})

describe('routing during PRE_LAUNCH', () => {
  const pre = (p: string, preview = false) => routeFor(p, 'PRE_LAUNCH', preview)

  it('serves the waitlist and legal pages from the pre-launch shell', () => {
    expect(pre('/')).toEqual({ action: 'rewrite', to: '/prelaunch' })
    expect(pre('/privacy')).toEqual({ action: 'rewrite', to: '/prelaunch/privacy' })
    expect(pre('/terms/')).toEqual({ action: 'rewrite', to: '/prelaunch/terms' })
  })

  it('sends pricing, sign-in, sign-up, party creation, checkout pages and the app to the waitlist', () => {
    for (const p of ['/pricing', '/login', '/join', '/start', '/home', '/plan', '/plan/theme', '/discover', '/guests', '/activities', '/more', '/admin', '/help', '/checkout-success', '/venue/abc', '/anything-new']) {
      expect(pre(p), p).toEqual({ action: 'redirect', to: '/' })
    }
    expect(pre('/prelaunch')).toEqual({ action: 'redirect', to: '/' })
    expect(pre('/prelaunch/privacy')).toEqual({ action: 'redirect', to: '/privacy' })
  })

  it('refuses checkout but leaves other APIs (webhooks, RSVP, waitlist, health) alone', () => {
    expect(pre('/api/billing/checkout')).toEqual({ action: 'block' })
    for (const p of ['/api/webhooks/dodo', '/api/waitlist', '/api/health', '/api/invite/abc/rsvp', '/api/billing/status']) expect(pre(p), p).toEqual({ action: 'next' })
  })

  it('keeps guests’ RSVP links and auth callbacks working for parties that already exist', () => {
    for (const p of ['/invite/0123abcd', '/auth/callback', '/reset-password', '/offline']) expect(pre(p), p).toEqual({ action: 'next' })
  })

  it('the owner preview sees the normal product', () => {
    for (const p of ['/', '/pricing', '/login', '/home', '/api/billing/checkout']) expect(pre(p, true), p).toEqual({ action: 'next' })
  })
})

describe('routing when LIVE', () => {
  it('passes everything through and retires the pre-launch pages', () => {
    for (const p of ['/', '/pricing', '/login', '/start', '/home', '/admin', '/help', '/api/billing/checkout']) expect(routeFor(p, 'LIVE'), p).toEqual({ action: 'next' })
    expect(routeFor('/prelaunch', 'LIVE')).toEqual({ action: 'redirect', to: '/' })
    expect(routeFor('/prelaunch/terms', 'LIVE')).toEqual({ action: 'redirect', to: '/terms' })
  })
})

describe('middleware', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })
  const run = async (url: string, cookie?: string) => {
    const { middleware } = await import('@/middleware')
    return middleware(new NextRequest(url, { headers: cookie ? { cookie } : {} }))
  }

  it('PRE_LAUNCH: rewrites /, redirects /pricing (temporary, uncached, keeps the query) and blocks checkout', async () => {
    process.env.PRELAUNCH_MODE = 'on'
    expect((await run('https://mbp.test/?utm_source=x')).headers.get('x-middleware-rewrite')).toBe('https://mbp.test/prelaunch?utm_source=x')
    const r = await run('https://mbp.test/pricing?utm_source=reddit')
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toBe('https://mbp.test/?utm_source=reddit')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect((await run('https://mbp.test/api/billing/checkout')).status).toBe(403)
  })

  it('LIVE: the normal site', async () => {
    process.env.PRELAUNCH_MODE = 'off'
    const r = await run('https://mbp.test/pricing')
    expect(r.headers.get('x-middleware-next')).toBe('1')
    expect((await run('https://mbp.test/prelaunch')).headers.get('location')).toBe('https://mbp.test/')
  })

  it('owner preview: only the right token sets the cookie; without PRELAUNCH_PREVIEW_TOKEN there is no bypass', async () => {
    process.env.PRELAUNCH_MODE = 'on'
    delete process.env.PRELAUNCH_PREVIEW_TOKEN
    expect((await run('https://mbp.test/?preview=anything')).cookies.get('mbp_preview')).toBeUndefined()
    process.env.PRELAUNCH_PREVIEW_TOKEN = 'a-long-owner-preview-token-1234567890'
    expect((await run('https://mbp.test/?preview=wrong-token')).cookies.get('mbp_preview')).toBeUndefined()
    const ok = await run('https://mbp.test/home?preview=a-long-owner-preview-token-1234567890')
    expect(ok.headers.get('location')).toBe('https://mbp.test/home')
    const cookie = ok.cookies.get('mbp_preview')!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.value).not.toContain('a-long-owner') // a digest, not the token
    expect((await run('https://mbp.test/home', `mbp_preview=${cookie.value}`)).headers.get('x-middleware-next')).toBe('1')
    expect((await run('https://mbp.test/home', 'mbp_preview=forged')).status).toBe(307)
  })
})

describe('countdown label', () => {
  it('counts down and disappears at launch', () => {
    expect(countdownLabel(6 * 86_400_000 + 3_600_000)).toBe('6 days to go')
    expect(countdownLabel(30 * 3_600_000)).toBe('1 day, 6 hr to go')
    expect(countdownLabel(5 * 3_600_000)).toBe('5 hr to go')
    expect(countdownLabel(90_000)).toBe('2 min to go')
    expect(countdownLabel(0)).toBeNull()
    expect(countdownLabel(-1)).toBeNull()
  })
})
