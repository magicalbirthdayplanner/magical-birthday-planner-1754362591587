/**
 * Paid acquisition: UTM capture (first/last touch), in-app browser detection and the Meta Pixel event mapping.
 */
import { describe, expect, it } from 'vitest'
import { isInAppBrowser, mergeTouch, touchFrom } from '@/lib/analytics/attribution'
import { pixelAllowedOn, pixelCallsFor, urlHasAuthTokens } from '@/lib/analytics/meta-pixel'

const AD = '?utm_source=instagram&utm_medium=paid_social&utm_campaign=mbp_founding_25&utm_content=Tabs&fbclid=IwAR123'

describe('attribution', () => {
  it('reads campaign tags (normalized) and the fbclid flag, never the click id itself', () => {
    expect(touchFrom(AD, 1)).toEqual({ utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: 'mbp_founding_25', utm_content: 'tabs', fbclid: true, at: 1 })
    expect(touchFrom('?utm_content=<script>alert(1)</script>', 1)?.utm_content).toBe('_script_alert_1___script_')
    expect(touchFrom('?ref=x', 1)).toBeNull()
  })
  it('keeps the first touch, replaces the last, and forgets both after 30 days', () => {
    const a = mergeTouch(null, touchFrom('?utm_source=facebook', 0), 0)!
    const b = mergeTouch(a, touchFrom('?utm_source=instagram', 1000), 1000)!
    expect([b.first.utm_source, b.last.utm_source]).toEqual(['facebook', 'instagram'])
    expect(mergeTouch(b, null, 2000)).toBe(b) // a plain visit changes nothing
    expect(mergeTouch(b, null, 1000 + 31 * 86_400_000)).toBeNull()
  })
  it('recognises the Facebook and Instagram in-app browsers only', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0.0')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false)
  })
})

describe('Meta Pixel mapping', () => {
  it('maps the funnel to Meta events, with plan values and nothing personal', () => {
    expect(pixelCallsFor('signup_completed', { method: 'password', utm_source: 'facebook' }, false)).toEqual([{ kind: 'track', name: 'CompleteRegistration' }])
    expect(pixelCallsFor('signup_started', {}, false)).toEqual([{ kind: 'trackCustom', name: 'SignupStarted' }])
    expect(pixelCallsFor('party_created', { age: 6, interests: ['art'] }, false)).toEqual([{ kind: 'trackCustom', name: 'PartyCreated' }])
    expect(pixelCallsFor('checkout_started', { plan: 'PLUS' }, false)).toEqual([{ kind: 'track', name: 'InitiateCheckout', params: { currency: 'USD', value: 19.99 } }])
    expect(pixelCallsFor('purchase_completed', { plan: 'PRO' }, false)).toEqual([{ kind: 'track', name: 'Purchase', params: { currency: 'USD', value: 29.99 } }])
    expect(pixelCallsFor('venue_viewed', {}, false)).toEqual([])
  })
  it('sends FirstPlanningAction once per device', () => {
    expect(pixelCallsFor('theme_selected', {}, false)).toEqual([{ kind: 'trackCustom', name: 'FirstPlanningAction' }])
    expect(pixelCallsFor('ai_feature_used', {}, true)).toEqual([])
  })
  it('never runs on guest RSVP pages or admin', () => {
    expect(pixelAllowedOn('/')).toBe(true)
    expect(pixelAllowedOn('/start')).toBe(true)
    expect(pixelAllowedOn('/invite/abc')).toBe(false)
    expect(pixelAllowedOn('/admin')).toBe(false)
    expect(pixelAllowedOn('/invitations')).toBe(true)
    expect(pixelAllowedOn('/auth/callback')).toBe(false)
    expect(pixelAllowedOn('/reset-password')).toBe(false)
  })
  it('waits while sign-in tokens are in the URL fragment', () => {
    expect(urlHasAuthTokens('#access_token=eyJ&expires_in=3600&refresh_token=x&type=signup')).toBe(true)
    expect(urlHasAuthTokens('#parties')).toBe(false)
    expect(urlHasAuthTokens('')).toBe(false)
  })
})
