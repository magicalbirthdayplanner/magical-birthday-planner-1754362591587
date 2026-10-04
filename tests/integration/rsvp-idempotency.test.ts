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

  // ------------------------------------------------------------------ required matrix (explicit)
  it('matrix: every state transition updates the same guest (Going/Can’t go/Maybe in all directions)', async () => {
    const steps: Body['status'][] = ['CONFIRMED', 'DECLINED', 'CONFIRMED', 'MAYBE', 'CONFIRMED', 'MAYBE', 'DECLINED', 'MAYBE']
    for (const st of steps) {
      expect((await rsvp(tokenA, going({ status: st, adults: st === 'DECLINED' ? 0 : 2, children: st === 'DECLINED' ? 0 : 1 }))).status).toBe(200)
      const rows = await guests()
      expect(rows, st).toHaveLength(1)
      expect(rows[0].rsvp_status).toBe(st)
    }
  })

  it('matrix: double-click (two identical requests in flight together) → one guest, one set of emails', async () => {
    await Promise.all([rsvp(tokenA, going({ email: 'dbl@example.test' })), rsvp(tokenA, going({ email: 'dbl@example.test' }))])
    expect(await guests()).toHaveLength(1)
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(1)
    expect(await emails('RSVP_CONFIRMATION')).toBe(1)
  })

  it('matrix: network retry (response lost, identical request re-sent) → one guest, no extra emails', async () => {
    const first = await rsvp(tokenA, going({ email: 'retry@example.test' }))
    expect(first.status).toBe(200) // pretend the client never saw this response and retries
    const retry = await rsvp(tokenA, going({ email: 'retry@example.test' }))
    expect(retry.status).toBe(200)
    expect(await guests()).toHaveLength(1)
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(1)
  })

  it('matrix: concurrent requests A=Going and B=Going for the same invitee → one guest, CONFIRMED', async () => {
    const [a, b] = await Promise.all([rsvp(tokenA, going()), rsvp(tokenA, going())])
    expect([a.status, b.status]).toEqual([200, 200])
    const rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ rsvp_status: 'CONFIRMED', adult_count: 2, child_count: 1 })
  })

  it('matrix: concurrent first RSVPs of two different invitees → two guests (no false merge)', async () => {
    await Promise.all([rsvp(tokenA, going()), rsvp(tokenA, going({ respondent: KEY2, name: 'The Garcia family' }))])
    expect((await guests()).map((g) => g.name).sort()).toEqual(['The Garcia family', 'The Nguyen family'])
  })

  it('matrix: RSVP without email → one guest, identified by the device key alone', async () => {
    await rsvp(tokenA, going())
    await rsvp(tokenA, going({ status: 'MAYBE' }))
    const rows = await guests()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: null, rsvp_status: 'MAYBE' })
  })

  it('matrix: RSVP with email → email is party-scoped (the same address at another party is a different guest)', async () => {
    await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Aviana', email: 'aviana@example.test' })
    await rsvp(tokenB, going({ name: 'Aviana', email: 'aviana@example.test' }))
    expect((await guests(partyA))[0]).toMatchObject({ name: 'Aviana', rsvp_status: 'PENDING' })
    expect(await guests(partyB)).toEqual([expect.objectContaining({ name: 'Aviana', source: 'rsvp_link', rsvp_status: 'CONFIRMED' })])
  })

  it('matrix: host-created guest WITH email + RSVP → that guest is updated (no duplicate), host name kept', async () => {
    await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Aviana', email: 'Aviana@Example.test' })
    await rsvp(tokenA, going({ name: 'Aviana R.', email: 'aviana@example.test', status: 'MAYBE' }))
    expect(await guests()).toEqual([expect.objectContaining({ name: 'Aviana', source: 'host', rsvp_status: 'MAYBE' })])
    // a later change from another device with the same email still lands on that guest
    await rsvp(tokenA, going({ respondent: KEY2, name: 'Aviana', email: 'AVIANA@example.test', status: 'DECLINED', adults: 0, children: 0 }))
    expect(await guests()).toEqual([expect.objectContaining({ name: 'Aviana', rsvp_status: 'DECLINED' })])
  })

  it('matrix (documented limitation): host-created guest WITHOUT email is never matched by name', async () => {
    await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Aviana' })
    await rsvp(tokenA, going({ name: 'Aviana' }))
    const rows = await guests()
    // There is no safe identity to link these: a fuzzy name match would let anyone with the link answer for
    // someone else. The RSVP becomes its own guest; the host's entry is left untouched.
    expect(rows).toHaveLength(2)
    expect(rows.find((g) => g.source === 'host')).toMatchObject({ name: 'Aviana', rsvp_status: 'PENDING' })
    expect(rows.find((g) => g.source === 'rsvp_link')).toMatchObject({ name: 'Aviana', rsvp_status: 'CONFIRMED' })
  })

  it('matrix: expired link (host reset the link) → old token rejected, nothing written', async () => {
    const { data: inv } = await A.client.from('party_invitations').select('id, token').eq('party_id', partyA).single()
    const fresh = Array.from({ length: 48 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    await A.client.from('party_invitations').update({ token: fresh }).eq('id', inv!.id)
    try {
      expect((await rsvp(inv!.token, going())).status).toBe(404)
      expect(await guests()).toHaveLength(0)
      expect((await rsvp(fresh, going())).status).toBe(200)
    } finally {
      await A.client.from('party_invitations').update({ token: inv!.token }).eq('id', inv!.id)
    }
  })

  it('matrix: cross-party — another host cannot read or change party A’s RSVPs through the API or REST', async () => {
    await rsvp(tokenA, going())
    const id = (await guests())[0].id
    expect((await B.client.from('guests').update({ rsvp_status: 'DECLINED' }).eq('id', id).select('id')).data ?? []).toEqual([])
    expect((await B.client.from('guests').delete().eq('id', id).select('id')).data ?? []).toEqual([])
    expect((await anonClient().from('guests').update({ rsvp_status: 'DECLINED' }).eq('id', id).select('id')).data ?? []).toEqual([])
    expect((await guests())[0].rsvp_status).toBe('CONFIRMED')
    // the per-device key can't be "borrowed" across parties either (keys are per party)
    await rsvp(tokenB, going({ status: 'DECLINED', adults: 0, children: 0 }))
    expect((await guests())[0].rsvp_status).toBe('CONFIRMED')
  })

  it('matrix: genuine changes keep notifying (each real change → host + guest email), repeats never do', async () => {
    const seq: [Body['status'], number][] = [['CONFIRMED', 1], ['CONFIRMED', 1], ['DECLINED', 2], ['DECLINED', 2], ['MAYBE', 3], ['CONFIRMED', 4], ['CONFIRMED', 4]]
    for (const [st, expected] of seq) {
      await rsvp(tokenA, going({ email: 'notify@example.test', status: st, adults: st === 'DECLINED' ? 0 : 2, children: st === 'DECLINED' ? 0 : 1 }))
      expect(await emails('RSVP_HOST_NOTIFICATION'), st).toBe(expected)
      expect(await emails('RSVP_CONFIRMATION'), st).toBe(expected)
    }
    // a headcount change on the same status is a real change too
    await rsvp(tokenA, going({ email: 'notify@example.test', status: 'CONFIRMED', adults: 3 }))
    expect(await emails('RSVP_HOST_NOTIFICATION')).toBe(5)
  })

  it('stress: 5 rounds × 20 concurrent submissions mixing key+email and email-only for one invitee → exactly one guest', async () => {
    for (let round = 0; round < 5; round++) {
      await adminClient().from('guests').delete().eq('party_id', partyA)
      // the same person: some requests carry the device key + email, some only the email (an old client)
      const reqs = Array.from({ length: 20 }, (_, i) =>
        rsvp(tokenA, going({ respondent: i % 3 === 0 ? undefined : KEY1, email: i % 2 ? 'STRESS@example.test' : 'stress@example.test', status: (['CONFIRMED', 'DECLINED', 'MAYBE'] as const)[i % 3] })),
      )
      const statuses = (await Promise.all(reqs)).map((r) => r.status)
      expect(statuses.every((st) => st === 200), `round ${round}`).toBe(true)
      const rows = await guests()
      expect(rows, `round ${round}`).toHaveLength(1)
      expect(rows[0].rsvp_respondent, `round ${round}: the key is attached to the one guest`).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('stress: 5 rounds × 20 concurrent submissions with the same key → exactly one guest', async () => {
    for (let round = 0; round < 5; round++) {
      await adminClient().from('guests').delete().eq('party_id', partyA)
      await Promise.all(Array.from({ length: 20 }, (_, i) => rsvp(tokenA, going({ status: (['CONFIRMED', 'DECLINED', 'MAYBE'] as const)[i % 3] }))))
      expect(await guests(), `round ${round}`).toHaveLength(1)
    }
  })

  it('stress: 5 rounds × 20 concurrent email-only submissions (no key) → exactly one guest', async () => {
    for (let round = 0; round < 5; round++) {
      await adminClient().from('guests').delete().eq('party_id', partyA)
      await Promise.all(Array.from({ length: 20 }, () => rsvp(tokenA, going({ respondent: undefined, email: 'only-email@example.test' }))))
      expect(await guests(), `round ${round}`).toHaveLength(1)
    }
  })

  it('DB guard: two rows can never share a respondent key within a party (unique index)', async () => {
    await rsvp(tokenA, going())
    const { rsvp_respondent } = (await guests())[0]
    const { error } = await adminClient().from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Dup', rsvp_respondent, source: 'rsvp_link' })
    expect(error?.code).toBe('23505')
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
