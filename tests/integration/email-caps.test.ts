/**
 * Launch-readiness fixes, against local Supabase:
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
})

const inviteSend = await import('@/app/api/invitations/send/route')
const rsvp = await import('@/app/api/invite/[token]/rsvp/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

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
