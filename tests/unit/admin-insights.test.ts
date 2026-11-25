import { describe, expect, it } from 'vitest'
import { biggestDrop, buildDays, buildDevices, buildFeatures, buildFunnel, buildSources, eventDetail, etMidnightIso, excludedEmails, FUNNEL, isTestEmail, lastDays, sourceOf, stepOf, withoutStaff, type EventRow } from '@/lib/admin/insights'

let t = Date.parse('2026-11-24T21:00:00Z')
const ev = (event: string, anon: string | null, extra: Partial<EventRow> = {}): EventRow => ({
  event,
  anonymous_id: anon,
  user_id: null,
  party_id: null,
  properties: {},
  path: '/',
  created_at: new Date((t += 60_000)).toISOString(),
  ...extra,
})
const idx = (id: string) => FUNNEL.findIndex((s) => s.id === id)

describe('admin usage insights', () => {
  it('maps events to funnel steps, including the ZIP answer of the setup questions', () => {
    expect(stepOf({ event: 'landing_page_view', properties: {} })).toBe(0)
    expect(stepOf({ event: 'party_creation_started', properties: {} })).toBe(idx('started'))
    expect(stepOf({ event: 'onboarding_step_completed', properties: { step: 'child' } })).toBe(0)
    expect(stepOf({ event: 'onboarding_step_completed', properties: { step: 'zip' } })).toBe(idx('answered'))
    expect(stepOf({ event: 'signup_started', properties: {} })).toBe(idx('signup'))
    expect(stepOf({ event: 'party_created', properties: {} })).toBe(idx('party'))
    expect(stepOf({ event: 'guest_added', properties: {} })).toBe(idx('engaged'))
  })

  it('names the traffic source from the first event, never from IP', () => {
    expect(sourceOf({ properties: { utm_source: 'ig', utm_content: 'link_in_bio' }, path: '/' })).toBe('ig / link_in_bio')
    expect(sourceOf({ properties: { fbclid: true, in_app: true }, path: '/' })).toBe('Facebook link')
    expect(sourceOf({ properties: { in_app: true }, path: '/' })).toBe('Facebook / Instagram app')
    expect(sourceOf({ properties: {}, path: '/santa' })).toBe('Magical Santa')
    expect(sourceOf(undefined)).toBe('Direct / other')
  })

  it('builds one journey per browser, a funnel that counts later steps, and the biggest drop-off', () => {
    const events = [
      ev('landing_page_view', 'a', { properties: { fbclid: true } }),
      ev('landing_page_view', 'b'),
      ev('party_creation_started', 'b', { path: '/start' }),
      ev('venue_search_completed', 'b', { properties: { results: 90 } }),
      ev('landing_page_view', 'c'),
      ev('party_creation_started', 'c'),
      ev('signup_started', 'c'),
      ev('party_created', 'c', { user_id: 'u1' }),
      // a returning signed-in user who skipped the early steps still counts for them
      ev('guest_added', null, { user_id: 'u2' }),
    ]
    const devices = buildDevices(events)
    expect(devices).toHaveLength(4)
    const b = devices.find((d) => d.id === 'b')!
    expect(b.furthest).toBe(idx('venues'))
    expect(b.pages).toEqual(['/', '/start'])
    expect(devices.find((d) => d.id === 'c')!.userId).toBe('u1')
    expect(devices.find((d) => d.id === 'a')!.source).toBe('Facebook link')

    const funnel = buildFunnel(devices)
    expect(funnel[0].devices).toBe(4)
    expect(funnel[idx('started')].devices).toBe(3)
    expect(funnel[idx('party')].devices).toBe(2)
    expect(funnel[idx('engaged')].devices).toBe(1)
    expect(funnel[idx('started')].fromPrevious).toBeCloseTo(0.75)
    expect(funnel[0].stoppedHere).toBe(1)
    expect(biggestDrop(funnel)).toMatchObject({ after: FUNNEL[0].label, lost: 1 })

    const sources = buildSources(devices)
    expect(sources.find((s) => s.source === 'Direct / other')).toMatchObject({ devices: 3, started: 3, parties: 2 })
  })

  it('leaves out staff accounts AND every browser they ever signed in on', () => {
    const events = [ev('landing_page_view', 'me'), ev('sign_in', 'me', { user_id: 'admin' }), ev('landing_page_view', 'someone')]
    expect(withoutStaff(events, new Set(['admin'])).map((e) => e.anonymous_id)).toEqual(['someone'])
  })

  it('counts per day in New York time and lists unused features', () => {
    const late = ev('landing_page_view', 'x', { created_at: '2026-11-25T03:30:00Z' }) // 10:30 pm on Nov 24 in New York
    const rows = buildDays([late, ev('signup_completed', 'x', { created_at: '2026-11-25T03:40:00Z' })], ['2026-11-24', '2026-11-25'])
    expect(rows[0]).toMatchObject({ day: '2026-11-24', visitors: 1, accounts: 1 })
    expect(rows[1]).toMatchObject({ visitors: 0 })
    const features = buildFeatures([ev('venue_viewed', 'a'), ev('venue_viewed', 'a'), ev('venue_viewed', 'b')])
    expect(features.find((f) => f.event === 'venue_viewed')).toMatchObject({ times: 3, people: 2 })
    expect(features.find((f) => f.event === 'guest_added')).toMatchObject({ times: 0 })
  })

  it('test addresses and the exclusion list; readable details; date helpers', () => {
    expect(isTestEmail('a@b.test')).toBe(true)
    expect(isTestEmail('x@resend.dev')).toBe(true)
    expect(isTestEmail('mom@gmail.com')).toBe(false)
    expect([...excludedEmails(' Me@Gmail.com, ,other@x.com')]).toEqual(['me@gmail.com', 'other@x.com'])
    expect(eventDetail({ event: 'venue_search_completed', properties: { results: 12, apiErrors: 2, preview: true } })).toBe('12 results · 2 search errors · before sign-up')
    expect(etMidnightIso('2026-11-24')).toBe('2026-11-24T05:00:00.000Z')
    expect(etMidnightIso('2026-07-04')).toBe('2026-07-04T04:00:00.000Z')
    expect(lastDays(3, new Date('2026-11-25T15:00:00Z'))).toEqual(['2026-11-23', '2026-11-24', '2026-11-25'])
  })
})
