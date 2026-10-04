/**
 * Every route the app serves, on purpose. Adding or removing a page/API route must
 * update this list, so debug, fix or legacy routes can't slip back in unnoticed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
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

/** AI routes (feature flags + plan + limits enforced server-side in lib/ai/handler.ts). */
const AI_ROUTES = ['/api/ai/capabilities', '/api/ai/party-planner', '/api/ai/theme-ideas', '/api/ai/apply', '/api/ai/checklist', '/api/ai/budget', '/api/ai/activities', '/api/ai/food', '/api/ai/invitation', '/api/ai/timeline', '/api/ai/shopping-list', '/api/ai/discover-explain', '/api/ai/activity', '/api/ai/host', '/api/ai/party-experience']

const EXPECTED = [
  // public marketing + legal
  '/ [page]', '/pricing [page]', '/checkout-success [page]', '/privacy [page]', '/terms [page]', '/help [page]',
  // full-screen flows (public: auth, guest invitation, offline; wizard needs sign-in)
  '/login [page]', '/join [page]', '/reset-password [page]', '/offline [page]', '/invite/[token] [page]', '/start [page]', '/venue/[placeId] [page]',
  // signed-in app (bottom navigation)
  '/home [page]', '/plan [page]', '/activities [page]', '/plan/theme [page]', '/plan/checklist [page]', '/plan/invite [page]', '/discover [page]', '/discover/saved [page]', '/guests [page]', '/more [page]',
  // Super Admin (server-verified role; 404 for everyone else)
  '/admin [page]',
  // auth return point
  '/auth/callback [api]',
  // APIs
  '/api/analytics [api]', '/api/health [api]',
  '/api/discovery/search [api]', '/api/discovery/places/[placeId] [api]', '/api/discovery/photo [api]', '/api/discovery/zip [api]',
  '/api/themes/ai [api]', '/api/invitations/send [api]', '/api/invite/[token]/rsvp [api]',
  '/api/billing/checkout [api]', '/api/billing/status [api]', '/api/webhooks/dodo [api]',
  '/api/admin/session [api]', '/api/admin/users [api]', '/api/admin/stats [api]', '/api/admin/override [api]', '/api/admin/audit [api]',
  // AI planning assistant (every route authenticates; behind AI_ENABLED + per-feature flags)
  ...AI_ROUTES.map((r) => `${r} [api]`),
].sort()
// The only routes allowed to carry "admin": each verifies the super_admin role server-side.
const SUPER_ADMIN_ROUTES = new Set(['/admin', '/api/admin/session', '/api/admin/users', '/api/admin/stats', '/api/admin/override', '/api/admin/audit'])

describe('route inventory', () => {
  const actual = routes().sort()

  it('serves exactly the intended routes', () => {
    expect(actual).toEqual(EXPECTED)
  })

  it('has no debug / fix / test / bypass tooling routes', () => {
    const banned = /(^|\/)[^/]*(debug|fix|test|bypass|diagnos|env-check|seed|admin)[^/]*(\/|$)/i
    expect(actual.filter((r) => banned.test(r.split(' ')[0]) && !SUPER_ADMIN_ROUTES.has(r.split(' ')[0]))).toEqual([])
  })

  it('every admin route enforces requireSuperAdmin', () => {
    for (const r of SUPER_ADMIN_ROUTES) {
      if (!r.startsWith('/api/')) continue
      const src = readFileSync(path.join(APP, r, 'route.ts'), 'utf8')
      const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) ?? []
      expect(handlers.length, r).toBeGreaterThan(0)
      expect((src.match(/await requireSuperAdmin\(req\)/g) ?? []).length, r).toBe(handlers.length)
    }
  })

  it('every AI route authenticates (createAIRoute or getAuthedRequest)', () => {
    for (const r of AI_ROUTES) {
      const src = readFileSync(path.join(APP, r, 'route.ts'), 'utf8')
      expect(/createAIRoute\(|await getAuthedRequest\(req\)/.test(src), r).toBe(true)
    }
  })

  it('the retired desktop planner and its APIs are gone', () => {
    // ('/activities' was a retired desktop page; it returns as the mobile Activities tab, listed in EXPECTED above.)
    for (const p of ['/dashboard', '/party-plan', '/create-party', '/account', '/signin', '/signup', '/api/parties', '/api/venues-search', '/api/user/subscription']) {
      expect(actual.some((r) => r.startsWith(`${p} `)), p).toBe(false)
    }
  })
})
