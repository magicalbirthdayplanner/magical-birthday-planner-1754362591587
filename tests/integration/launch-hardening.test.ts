/**
 * Launch-readiness fixes, against local Supabase:
 *  - legacy planner routes that call paid providers require sign-in and validate input
 *  - /api/party-venue never writes client data into the shared venues catalogue
 *  - /api/activities can't be used for PostgREST filter injection / unbounded pages
 *  - DB-backed daily email caps (invitations per host, RSVP emails per party)
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  // Fake Resend on a dead port: nothing can actually be sent from these tests.
  RESEND_API_KEY: 're_test_not_real',
  RESEND_BASE_URL: 'http://127.0.0.1:9',
  GOOGLE_PLACES_API_KEY: 'mock-key-not-secret',
})

const venuesSearch = await import('@/app/api/venues-search/route')
const foodVendors = await import('@/app/api/food-vendors/route')
const themeRecs = await import('@/app/api/theme-recommendations/route')
const partyVenue = await import('@/app/api/party-venue/route')
const activities = await import('@/app/api/activities/route')
const inviteSend = await import('@/app/api/invitations/send/route')
const rsvp = await import('@/app/api/invite/[token]/rsvp/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')
const { resetGoogleBudgets } = await import('@/lib/server/google-budget')

const up = await isSupabaseUp()
let A: TestUser
let partyId: string
let token: string

const bearer = (t: string | null): Record<string, string> => (t ? { Authorization: `Bearer ${t}` } : {})
const req = (url: string, init: RequestInit & { token?: string | null } = {}) =>
  new Request(`http://app.test${url}`, { ...init, headers: { 'Content-Type': 'application/json', ...bearer(init.token ?? null), ...(init.headers as Record<string, string>) } }) as never

describe.skipIf(!up)('launch hardening', () => {
  beforeAll(async () => {
    A = await createTestUser('launch')
    const { data: party, error } = await A.client
      .from('parties')
      .insert({ user_id: A.id, child_name: 'Ava', child_age: 7, party_date: '2026-12-12', zip_code: '48084', latitude: 42.5627, longitude: -83.1799 })
      .select('id')
      .single()
    if (error) throw error
    partyId = party!.id
    await A.client.from('guests').insert({ party_id: partyId, user_id: A.id, name: 'Patel family', email: 'patel@guest.test' })
    const { data: inv } = await A.client.from('party_invitations').insert({ party_id: partyId, headline: 'Party!' }).select('token').single()
    token = inv!.token
  })
  afterAll(async () => {
    await adminClient().from('email_logs').delete().eq('party_id', partyId)
    await deleteTestUser(A)
    for (const k of ['RESEND_API_KEY', 'RESEND_BASE_URL', 'EMAIL_DAILY_INVITES_PER_USER', 'EMAIL_DAILY_RSVP_EMAILS_PER_PARTY']) delete process.env[k]
  })
  beforeEach(() => {
    resetRateLimits()
    resetGoogleBudgets()
  })

  describe('legacy paid-provider routes', () => {
    it('reject anonymous callers before any provider call', async () => {
      expect((await venuesSearch.GET(req('/api/venues-search?zipCode=48084&category=indoor'))).status).toBe(401)
      expect((await venuesSearch.POST(req('/api/venues-search', { method: 'POST', body: JSON.stringify({ zipCode: '48084', category: 'indoor' }) }))).status).toBe(401)
      expect((await foodVendors.GET(req('/api/food-vendors?zipCode=48084'))).status).toBe(401)
      expect((await themeRecs.POST(req('/api/theme-recommendations', { method: 'POST', body: JSON.stringify({ childName: 'x', age: 5, interests: ['a'] }) }))).status).toBe(401)
    })

    it('validate input for signed-in users (no Google call for bad ZIPs)', async () => {
      const bad = await venuesSearch.GET(req('/api/venues-search?zipCode=ABCDE&category=indoor', { token: A.accessToken }))
      expect(bad.status).toBe(400)
      const injected = await venuesSearch.GET(req('/api/venues-search?zipCode=48084%26key%3Dx&category=indoor', { token: A.accessToken }))
      expect(injected.status).toBe(400)
      const badCat = await venuesSearch.GET(req('/api/venues-search?zipCode=48084&category=evil', { token: A.accessToken }))
      expect(badCat.status).toBe(400)
      expect((await foodVendors.GET(req('/api/food-vendors?zipCode=nope', { token: A.accessToken }))).status).toBe(400)
    })

    it('rate-limit each user', async () => {
      const statuses: number[] = []
      for (let i = 0; i < 12; i++) statuses.push((await venuesSearch.GET(req('/api/venues-search?zipCode=bad&category=indoor', { token: A.accessToken }))).status)
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0)
    })
  })

  describe('/api/party-venue', () => {
    it('never creates shared catalogue rows from client data', async () => {
      const placeId = `ChIJpoison${Date.now()}`
      const res = await partyVenue.POST(
        req('/api/party-venue', { method: 'POST', token: A.accessToken, body: JSON.stringify({ partyId, venue: { placeId, name: 'Totally Real Venue', rating: 5, latitude: 1, longitude: 1 } }) }),
      )
      expect(res.status).toBe(200)
      const { data: catalogue } = await adminClient().from('venues').select('id').eq('place_id', placeId)
      expect(catalogue).toEqual([])
      const { data: sel } = await adminClient().from('party_venues').select('is_custom, custom_name, venue_id').eq('party_id', partyId).single()
      expect(sel).toMatchObject({ is_custom: true, custom_name: 'Totally Real Venue', venue_id: null })
    })
  })

  describe('/api/activities', () => {
    it('neutralises PostgREST filter syntax and bounds page size', async () => {
      const res = await activities.GET(req('/api/activities?search=' + encodeURIComponent('x%,id.not.is.null),or(name.ilike.*') + '&limit=100000'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect((body.activities ?? body.data ?? []).length).toBeLessThanOrEqual(100)
    })
  })

  describe('daily email caps (email_logs)', () => {
    it('refuses invitation emails once the host reached the daily cap', async () => {
      process.env.EMAIL_DAILY_INVITES_PER_USER = '1'
      await adminClient().from('email_logs').insert({ user_id: A.id, party_id: partyId, email_type: 'INVITATION', recipient_email: 'x@guest.test', subject: 's', status: 'SENT' })
      const res = await inviteSend.POST(req('/api/invitations/send', { method: 'POST', token: A.accessToken, body: JSON.stringify({ partyId }) }))
      expect(res.status).toBe(429)
      expect((await res.json()).error.message).toMatch(/limit/i)
    })

    it('still records the RSVP but skips emails when the party hit its daily cap', async () => {
      process.env.EMAIL_DAILY_RSVP_EMAILS_PER_PARTY = '1'
      await adminClient().from('email_logs').insert({ party_id: partyId, email_type: 'RSVP_CONFIRMATION', recipient_email: 'y@guest.test', subject: 's', status: 'SENT' })
      const res = await rsvp.POST(
        req(`/api/invite/${token}/rsvp`, { method: 'POST', body: JSON.stringify({ name: 'Nguyen family', email: 'victim@example.test', status: 'CONFIRMED', adults: 1, children: 1 }) }),
        { params: { token } } as never,
      )
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, emailed: { guest: false, host: false } })
      const { data: g } = await adminClient().from('guests').select('name').eq('party_id', partyId).eq('name', 'Nguyen family')
      expect(g?.length).toBe(1)
    })
  })
})
