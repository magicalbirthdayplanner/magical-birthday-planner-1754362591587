import { describe, expect, it } from 'vitest'
import { isBlockedPath } from '@/lib/security/blocked-routes'

const prod = { NODE_ENV: 'production', ENABLE_DEBUG_ROUTES: 'true' }
const dev = { NODE_ENV: 'development' }
const devEnabled = { NODE_ENV: 'development', ENABLE_DEBUG_ROUTES: 'true' }

describe('isBlockedPath', () => {
  it('blocks account-takeover and DDL routes', () => {
    for (const p of ['/api/bypass-oauth-session', '/api/fix-rls-policies', '/api/env-test', '/api/diagnose-user']) {
      expect(isBlockedPath(p, dev)).toBe(true)
    }
  })

  it('cannot be enabled in production', () => {
    expect(isBlockedPath('/api/bypass-oauth-session', prod)).toBe(true)
    expect(isBlockedPath('/env-check', prod)).toBe(true)
  })

  it('can be enabled for local development only', () => {
    expect(isBlockedPath('/api/debug-auth', devEnabled)).toBe(false)
  })

  it('matches whole segments only', () => {
    expect(isBlockedPath('/api/venues', dev)).toBe(true)
    expect(isBlockedPath('/api/venues-search', dev)).toBe(false)
    expect(isBlockedPath('/api/debug/anything', dev)).toBe(true)
    expect(isBlockedPath('/api/debugger', dev)).toBe(false)
  })

  it('leaves product routes alone', () => {
    for (const p of ['/api/parties', '/api/guests', '/api/invite/abc/rsvp', '/api/discovery/search', '/', '/home', '/party-plan']) {
      expect(isBlockedPath(p, dev)).toBe(false)
    }
  })
})

describe('deprecated insecure legacy routes', () => {
  const dev = { NODE_ENV: 'production' }
  it('blocks billing manipulation, unauthenticated AI and leaky legacy routes', () => {
    for (const p of ['/api/subscriptions/create', '/api/subscriptions/cancel', '/api/budget-allocation', '/api/activity-expansion',
      '/api/emails/password-reset', '/api/party/create', '/api/party/get', '/api/party/guests/add', '/api/n8n/webhook',
      '/api/rsvp/abc', '/api/party/share', '/api/RSVP/abc/']) {
      expect(isBlockedPath(p, dev), p).toBe(true)
    }
  })
  it('keeps live sibling routes reachable', () => {
    for (const p of ['/api/party-venue', '/api/party-activities', '/api/parties']) {
      expect(isBlockedPath(p, dev), p).toBe(false)
    }
  })
  it('is not fooled by path variants', () => {
    for (const p of ['/api//bypass-oauth-session', '/api/Bypass-OAuth-Session', '/api/bypass-oauth-session/', '/api/party//create']) {
      expect(isBlockedPath(p, dev), p).toBe(true)
    }
  })
})
