/**
 * RSVP idempotency (one invitee = one guest = one current RSVP state), against local Supabase through the real
 * route. Email goes to a dead Resend port: every attempted notification is still recorded in email_logs, which
 * is how notification behaviour is asserted.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  RESEND_API_KEY: 're_test_not_real',
  RESEND_BASE_URL: 'http://127.0.0.1:9',
})
const route = await import('@/app/api/invite/[token]/rsvp/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

const up = await isSupabaseUp()
let A: TestUser, B: TestUser
let partyA: string, partyB: string, tokenA: string, tokenB: string
let ip = 0

const KEY1 = 'k1'.repeat(16), KEY2 = 'k2'.repeat(16)
type Body = { name: string; email?: string; status: 'CONFIRMED' | 'MAYBE' | 'DECLINED'; adults: number; children: number; note?: string; respondent?: string }
const rsvp = (token: string, body: Body) =>
  route.POST(new Request(`http://app.test/api/invite/${token}/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip % 250}` }, body: JSON.stringify(body) }), { params: Promise.resolve({ token }) })
const going = (o: Partial<Body> = {}): Body => ({ name: 'The Nguyen family', status: 'CONFIRMED', adults: 2, children: 1, respondent: KEY1, ...o })
const guests = async (party = partyA) => (await adminClient().from('guests').select('id, name, email, rsvp_status, adult_count, child_count, source, rsvp_respondent').eq('party_id', party).order('created_at')).data!
const emails = async (type: string) => (await adminClient().from('email_logs').select('id').eq('party_id', partyA).eq('email_type', type)).data!.length

describe.skipIf(!up)('RSVP idempotency', () => {
  beforeAll(async () => {
    ;[A, B] = await Promise.all([createTestUser('rsvp-a'), createTestUser('rsvp-b')])
    const mk = async (u: TestUser) => {
      const { data: p } = await u.client.from('parties').insert({ user_id: u.id, child_name: 'Ava', child_age: 7, party_date: '2026-12-12', zip_code: '48084' }).select('id').single()
      const { data: inv } = await u.client.from('party_invitations').insert({ party_id: p!.id, headline: 'Party!' }).select('token').single()
      return [p!.id, inv!.token] as const
    }
    ;[partyA, tokenA] = await mk(A)
    ;[partyB, tokenB] = await mk(B)
  })
  afterAll(async () => {
    await adminClient().from('email_logs').delete().in('party_id', [partyA, partyB])
    await Promise.all([deleteTestUser(A), deleteTestUser(B)])
    for (const k of ['RESEND_API_KEY', 'RESEND_BASE_URL']) delete process.env[k]
  })
  beforeEach(async () => {
    resetRateLimits()
    await adminClient().from('guests').delete().in('party_id', [partyA, partyB])
    await adminClient().from('email_logs').delete().in('party_id', [partyA, partyB])
  })

  it('1. the first RSVP creates one guest (respondent stored only as a SHA-256 hash)', async () => {
    const res = await rsvp(tokenA, going())
    expect(res.status).toBe(200)
    const rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'The Nguyen family', rsvp_status: 'CONFIRMED', adult_count: 2, child_count: 1, source: 'rsvp_link' })
    expect(rows[0].rsvp_respondent).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0].rsvp_respondent).not.toContain(KEY1)
  })

  it('2./5./7. repeating the same RSVP (retry, double submit, refresh) never adds a guest', async () => {
    for (let i = 0; i < 4; i++) expect((await rsvp(tokenA, going())).status).toBe(200)
    expect(await guests()).toHaveLength(1)
  })

  it('3./4. Going → Can’t go → Going updates the same guest', async () => {
    await rsvp(tokenA, going())
    await rsvp(tokenA, going({ status: 'DECLINED', adults: 0, children: 0 }))
    let rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ rsvp_status: 'DECLINED', adult_count: 0, child_count: 0 })
    await rsvp(tokenA, going({ status: 'CONFIRMED', adults: 1, children: 2 }))
    rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ rsvp_status: 'CONFIRMED', adult_count: 1, child_count: 2 })
  })

  it('6. concurrent submissions from one invitee cannot create duplicates', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => rsvp(tokenA, going({ status: i % 2 ? 'DECLINED' : 'CONFIRMED', adults: i % 2 ? 0 : 2, children: i % 2 ? 0 : 1 }))))
    expect(results.every((r) => r.status === 200)).toBe(true)
    const rows = await guests()
    expect(rows).toHaveLength(1)
    expect(['CONFIRMED', 'DECLINED']).toContain(rows[0].rsvp_status)
  })

  it('6b. concurrent email-only submissions (no respondent) also collapse to one guest', async () => {
    await Promise.all(Array.from({ length: 6 }, () => rsvp(tokenA, going({ respondent: undefined, email: 'Race@Example.test' }))))
    expect(await guests()).toHaveLength(1)
  })

  it('different invitees stay separate; a name alone never matches (no overwrite by reusing a name)', async () => {
    await rsvp(tokenA, going())
    await rsvp(tokenA, going({ respondent: KEY2, status: 'DECLINED', adults: 0, children: 0 }))
    await rsvp(tokenA, going({ respondent: undefined, status: 'MAYBE' }))
    const rows = await guests()
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.rsvp_status).sort()).toEqual(['CONFIRMED', 'DECLINED', 'MAYBE'])
  })

  it('the same email on another device updates the same guest (and the email is matched case-insensitively)', async () => {
    await rsvp(tokenA, going({ email: 'nguyen@example.test' }))
    await rsvp(tokenA, going({ respondent: KEY2, email: 'NGUYEN@example.test', status: 'DECLINED', adults: 0, children: 0 }))
    const rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0].rsvp_status).toBe('DECLINED')
  })

  it('an RSVP with the email of a guest the host added updates that guest (keeping the host’s name) instead of duplicating it', async () => {
    await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Patel family (school)', email: 'patel@example.test' })
    await rsvp(tokenA, going({ name: 'The Patels', email: 'Patel@Example.test' }))
    const rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Patel family (school)', source: 'host', rsvp_status: 'CONFIRMED', adult_count: 2, child_count: 1 })
    // later changes from the same device keep updating that row
    await rsvp(tokenA, going({ name: 'The Patels', status: 'DECLINED', adults: 0, children: 0 }))
    expect(await guests()).toEqual([expect.objectContaining({ name: 'Patel family (school)', rsvp_status: 'DECLINED' })])
  })

  it('8./9. notifications: an exact repeat sends nothing; a real change notifies again', async () => {
    await rsvp(tokenA, going({ email: 'guest@example.test' }))
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(1)
    expect(await emails('RSVP_CONFIRMATION')).toBe(1)
    for (let i = 0; i < 3; i++) await rsvp(tokenA, going({ email: 'guest@example.test' }))
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(1)
    expect(await emails('RSVP_CONFIRMATION')).toBe(1)
    await rsvp(tokenA, going({ email: 'guest@example.test', status: 'DECLINED', adults: 0, children: 0 }))
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(2)
    expect(await emails('RSVP_CONFIRMATION')).toBe(2)
    // concurrent duplicates of the new state: at most one more round of emails
    await Promise.all(Array.from({ length: 4 }, () => rsvp(tokenA, going({ email: 'guest@example.test', status: 'MAYBE' }))))
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(3)
  })

  it('10. invalid / inactive invitation tokens are still rejected', async () => {
    expect((await rsvp('f'.repeat(48), going())).status).toBe(404)
    expect((await rsvp('not-a-token', going())).status).toBe(404)
    await A.client.from('party_invitations').update({ is_active: false }).eq('party_id', partyA)
    try {
      expect((await rsvp(tokenA, going())).status).toBe(404)
    } finally {
      await A.client.from('party_invitations').update({ is_active: true }).eq('party_id', partyA)
    }
    expect(await guests()).toHaveLength(0)
  })

  it('malformed respondent keys are rejected without side effects', async () => {
    expect((await rsvp(tokenA, going({ respondent: 'short' }))).status).toBe(400)
    expect((await rsvp(tokenA, going({ respondent: "x'; drop table guests; --" + 'a'.repeat(20) }))).status).toBe(400)
    expect(await guests()).toHaveLength(0)
  })

  it('11. a respondent key from party A cannot touch party B’s guests', async () => {
    await rsvp(tokenA, going())
    await rsvp(tokenB, going({ status: 'DECLINED', adults: 0, children: 0 }))
    expect((await guests(partyA))[0].rsvp_status).toBe('CONFIRMED')
    expect((await guests(partyB))[0].rsvp_status).toBe('DECLINED')
    // and an email RSVP via B never matches A's guests
    await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Lee family', email: 'lee@example.test' })
    await rsvp(tokenB, going({ respondent: KEY2, email: 'lee@example.test' }))
    expect((await guests(partyA)).find((g) => g.email === 'lee@example.test')!.rsvp_status).toBe('PENDING')
  })

  it('12. RLS: submit_rsvp stays service-role only; other users and anon cannot read the guests', async () => {
    await rsvp(tokenA, going())
    const args = { p_token: tokenA, p_name: 'x', p_email: '', p_status: 'CONFIRMED', p_respondent: 'a'.repeat(64) }
    expect((await anonClient().rpc('submit_rsvp', args)).error).not.toBeNull()
    expect((await B.client.rpc('submit_rsvp', args)).error).not.toBeNull()
    expect((await B.client.from('guests').select('id').eq('party_id', partyA)).data).toEqual([])
    expect((await anonClient().from('guests').select('id').eq('party_id', partyA)).data ?? []).toEqual([])
    expect((await A.client.from('guests').select('id').eq('party_id', partyA)).data).toHaveLength(1)
  })

  it('13. host guest management still works next to RSVPs (add, edit, delete)', async () => {
    await rsvp(tokenA, going())
    const { data: g, error } = await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Garcia family' }).select('id').single()
    expect(error).toBeNull()
    expect((await A.client.from('guests').update({ rsvp_status: 'MAYBE' }).eq('id', g!.id)).error).toBeNull()
    expect((await A.client.from('guests').delete().eq('id', g!.id)).error).toBeNull()
    expect(await guests()).toHaveLength(1)
  })

  it('the legacy call shape (no respondent, as sent by the previous deployment) still works', async () => {
    const { data, error } = await adminClient().rpc('submit_rsvp', { p_token: tokenA, p_name: 'Old client', p_email: '', p_status: 'CONFIRMED', p_adults: 1, p_children: 0 })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, created: true })
  })
})
