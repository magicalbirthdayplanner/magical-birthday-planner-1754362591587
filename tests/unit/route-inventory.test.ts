/**
 * Every route the app serves, on purpose. Adding or removing a page/API route must
 * update this list, so debug, fix or legacy routes can't slip back in unnoticed.
 */
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const APP = path.resolve(__dirname, '../../app')

function routes(dir = APP, prefix = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      const seg = /^\(.*\)$/.test(name) ? '' : `/${name}` // route groups don't appear in URLs
      out.push(...routes(p, prefix + seg))
    } else if (/^(page|route)\.tsx?$/.test(name)) out.push(`${prefix || '/'} [${name.startsWith('page') ? 'page' : 'api'}]`)
  }
  return out
}

const EXPECTED = [
  // public marketing + legal
  '/ [page]', '/pricing [page]', '/checkout-success [page]', '/privacy [page]', '/terms [page]',
  // full-screen flows (public: auth, guest invitation, offline; wizard needs sign-in)
  '/login [page]', '/join [page]', '/reset-password [page]', '/offline [page]', '/invite/[token] [page]', '/start [page]', '/venue/[placeId] [page]',
  // signed-in app (bottom navigation)
  '/home [page]', '/plan [page]', '/plan/theme [page]', '/plan/checklist [page]', '/plan/invite [page]', '/discover [page]', '/discover/saved [page]', '/guests [page]', '/more [page]',
  // auth return point
  '/auth/callback [api]',
  // APIs
  '/api/analytics [api]', '/api/health [api]',
  '/api/discovery/search [api]', '/api/discovery/places/[placeId] [api]', '/api/discovery/photo [api]', '/api/discovery/zip [api]',
  '/api/themes/ai [api]', '/api/invitations/send [api]', '/api/invite/[token]/rsvp [api]',
  '/api/billing/checkout [api]', '/api/billing/status [api]', '/api/webhooks/dodo [api]',
].sort()

describe('route inventory', () => {
  const actual = routes().sort()

  it('serves exactly the intended routes', () => {
    expect(actual).toEqual(EXPECTED)
  })

  it('has no debug / fix / test / bypass tooling routes', () => {
    const banned = /(^|\/)[^/]*(debug|fix|test|bypass|diagnos|env-check|seed|admin)[^/]*(\/|$)/i
    expect(actual.filter((r) => banned.test(r.split(' ')[0]))).toEqual([])
  })

  it('the retired desktop planner and its APIs are gone', () => {
    for (const p of ['/dashboard', '/party-plan', '/create-party', '/account', '/signin', '/signup', '/activities', '/api/parties', '/api/venues-search', '/api/user/subscription']) {
      expect(actual.some((r) => r.startsWith(`${p} `)), p).toBe(false)
    }
  })
})
