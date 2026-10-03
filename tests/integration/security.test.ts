import { existsSync } from 'node:fs'
import path from 'node:path'
/**
 * Release-gate security tests (local Supabase):
 *  - explicit User A / User B matrix: read, update, delete, insert-as-other
 *  - entitlement integrity: users cannot grant themselves a plan
 *  - invitation tokens and RSVP route
 *  - server-side input validation on discovery
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  GOOGLE_PLACES_API_KEY: 'mock-key-not-secret',
  GOOGLE_PLACES_API_BASE_URL: 'http://127.0.0.1:9', // nothing listens: Google must not be needed here
})

const rsvpRoute = await import('@/app/api/invite/[token]/rsvp/route')
const searchRoute = await import('@/app/api/discovery/search/route')
const detailsRoute = await import('@/app/api/discovery/places/[placeId]/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

interface World {
  user: TestUser
  partyId: string
  guestId: string
  savedId: string
  invitationId: string
  token: string
}

let A: World
let B: World
let venueId: string
const placeId = `ChIJsec${Date.now()}`

async function seed(user: TestUser, label: string): Promise<World> {
  const c = user.client
  const { data: party, error } = await c
    .from('parties')
    .insert({ user_id: user.id, child_name: `${label} Kid`, child_age: 7, party_date: '2026-12-12', zip_code: '48084', latitude: 42.5627, longitude: -83.1799 })
    .select('id')
    .single()
  if (error) throw error
  const { data: guest } = await c.from('guests').insert({ party_id: party!.id, user_id: user.id, name: `${label} Guest`, email: `${label.toLowerCase()}@guest.test` }).select('id').single()
  const { data: saved } = await c.from('saved_venues').insert({ party_id: party!.id, venue_id: venueId, place_id: placeId, notes: `Private Note ${label}` }).select('id').single()
  const { data: inv } = await c.from('party_invitations').insert({ party_id: party!.id, location_text: `${label} home address` }).select('id, token').single()
  return { user, partyId: party!.id, guestId: guest!.id, savedId: saved!.id, invitationId: inv!.id, token: inv!.token }
}

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  const { data: v, error } = await adminClient().from('venues').insert({ place_id: placeId, name: 'Security Test Studio', latitude: 42.56, longitude: -83.18 }).select('id').single()
  if (error) throw error
  venueId = v!.id
  const [ua, ub] = await Promise.all([createTestUser('sec-a'), createTestUser('sec-b')])
  A = await seed(ua, 'A')
  B = await seed(ub, 'B')
})

afterAll(async () => {
  await Promise.all([deleteTestUser(A?.user), deleteTestUser(B?.user)])
  await adminClient().from('venues').delete().eq('id', venueId)
})

beforeEach(() => resetRateLimits())

// ------------------------------------------------------------------------------------- RLS matrix
const ENTITIES = [
  { table: 'parties', id: (w: World) => w.partyId, patch: { child_name: 'HACKED' } },
  { table: 'guests', id: (w: World) => w.guestId, patch: { name: 'HACKED' } },
  { table: 'saved_venues', id: (w: World) => w.savedId, patch: { notes: 'HACKED' } },
  { table: 'party_invitations', id: (w: World) => w.invitationId, patch: { headline: 'HACKED' } },
] as const

describe('RLS matrix: User A vs User B', () => {
  for (const e of ENTITIES) {
    for (const [attacker, victim] of [['A', 'B'], ['B', 'A']] as const) {
      it(`${e.table}: ${attacker} cannot read, update or delete ${victim}`, async () => {
        const att = attacker === 'A' ? A : B
        const vic = victim === 'A' ? A : B
        const c = att.user.client
        const read = await c.from(e.table).select('id').eq('id', e.id(vic))
        expect(read.data).toEqual([])
        const upd = await c.from(e.table).update(e.patch as never).eq('id', e.id(vic)).select('id')
        expect(upd.data ?? []).toEqual([])
        const del = await c.from(e.table).delete().eq('id', e.id(vic)).select('id')
        expect(del.data ?? []).toEqual([])
        const after = await adminClient().from(e.table).select('*').eq('id', e.id(vic)).single()
        expect(JSON.stringify(after.data)).not.toContain('HACKED')
      })
    }
  }

  it('private notes stay private', async () => {
    const a = await A.user.client.from('saved_venues').select('notes')
    const b = await B.user.client.from('saved_venues').select('notes')
    expect(a.data?.map((r) => r.notes)).toEqual(['Private Note A'])
    expect(b.data?.map((r) => r.notes)).toEqual(['Private Note B'])
  })

  for (const [attacker, victim] of [['A', 'B'], ['B', 'A']] as const) {
    it(`${attacker} cannot insert data owned by ${victim}`, async () => {
      const att = attacker === 'A' ? A : B
      const vic = victim === 'A' ? A : B
      const c = att.user.client
      // into the victim's party
      expect((await c.from('guests').insert({ party_id: vic.partyId, user_id: att.user.id, name: 'x' })).error).not.toBeNull()
      expect((await c.from('saved_venues').insert({ party_id: vic.partyId, venue_id: venueId, place_id: placeId })).error).not.toBeNull()
      expect((await c.from('party_invitations').insert({ party_id: vic.partyId })).error).not.toBeNull()
      expect((await c.from('checklist_items').insert({ party_id: vic.partyId, task_key: 'x', title: 'x' })).error).not.toBeNull()
      // rows attributed to the victim inside the attacker's own party
      expect((await c.from('guests').insert({ party_id: att.partyId, user_id: vic.user.id, name: 'x' })).error).not.toBeNull()
      expect((await c.from('saved_venues').insert({ party_id: att.partyId, user_id: vic.user.id, venue_id: venueId, place_id: placeId })).error).not.toBeNull()
      // a party owned by the victim
      expect((await c.from('parties').insert({ user_id: vic.user.id, child_name: 'x', child_age: 5, party_date: '2026-12-01' })).error).not.toBeNull()
      // moving own rows to the victim
      expect((await c.from('guests').update({ party_id: vic.partyId }).eq('id', att.guestId)).error).not.toBeNull()
      expect((await c.from('parties').update({ user_id: vic.user.id }).eq('id', att.partyId)).error).not.toBeNull()
    })
  }
})

// ------------------------------------------------------------------------------------- billing
describe('entitlements cannot be self-granted', () => {
  it('a user cannot upgrade their own plan or extend a trial via Supabase', async () => {
    const c = A.user.client
    // Start from an expired FREE account (as the server would leave it).
    await adminClient().from('users').update({ current_plan: 'FREE', is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', A.user.id)
    for (const patch of [{ current_plan: 'PRO' }, { current_plan: 'PROFESSIONAL' }, { is_trial_active: true }, { trial_expires_at: '2099-01-01T00:00:00Z' }, { has_used_trial: false }]) {
      const { error } = await c.from('users').update(patch).eq('id', A.user.id)
      expect(error?.code, JSON.stringify(patch)).toBe('42501')
    }
    const { data } = await adminClient().from('users').select('current_plan, is_trial_active, has_used_trial').eq('id', A.user.id).single()
    expect(data).toEqual({ current_plan: 'FREE', is_trial_active: false, has_used_trial: true })
  })

  it('a user cannot change another user’s plan', async () => {
    const before = await adminClient().from('users').select('current_plan').eq('id', B.user.id).single()
    const res = await A.user.client.from('users').update({ current_plan: 'FREE' }).eq('id', B.user.id).select('id')
    expect(res.data ?? []).toEqual([])
    const after = await adminClient().from('users').select('current_plan').eq('id', B.user.id).single()
    expect(after.data!.current_plan).toBe(before.data!.current_plan)
  })

  it('profile edits that do not touch entitlements still work', async () => {
    const { error } = await A.user.client.from('users').update({ display_name: 'Sam' }).eq('id', A.user.id)
    expect(error).toBeNull()
  })

  it('a self-inserted profile row gets server-chosen values, not client-chosen ones', async () => {
    const u = await createTestUser('sec-insert')
    try {
      await adminClient().from('users').delete().eq('id', u.id)
      const { error } = await u.client.from('users').insert({
        id: u.id, email: u.email, current_plan: 'PROFESSIONAL', trial_expires_at: '2099-01-01T00:00:00Z', is_trial_active: true, has_used_trial: false,
      })
      expect(error).toBeNull()
      const { data } = await adminClient().from('users').select('current_plan, trial_expires_at, has_used_trial').eq('id', u.id).single()
      expect(data!.current_plan).toBe('PRO') // the standard one-time 24h trial
      expect(data!.has_used_trial).toBe(true)
      expect(new Date(data!.trial_expires_at!).getTime() - Date.now()).toBeLessThan(24 * 3600_000 + 60_000)
    } finally {
      await deleteTestUser(u)
    }
  })

  it('the server (service role) can still manage plans', async () => {
    const { error } = await adminClient().from('users').update({ current_plan: 'PLUS' }).eq('id', B.user.id)
    expect(error).toBeNull()
    await adminClient().from('users').update({ current_plan: 'FREE' }).eq('id', B.user.id)
  })

  it('the legacy self-upgrade endpoints no longer exist (plans change only via the Dodo webhook)', () => {
    for (const r of ['app/api/user/subscription/route.ts', 'app/api/user/purchase/route.ts', 'app/api/user/trial/route.ts']) {
      expect(existsSync(path.resolve(__dirname, '../..', r)), r).toBe(false)
    }
  })
})

// ------------------------------------------------------------------------------------- invitations
describe('invitation links', () => {
  const rsvp = (token: string, body: unknown, ip = '203.0.113.7') =>
    rsvpRoute.POST(new Request(`http://app.test/api/invite/${token}/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }), { params: Promise.resolve({ token }) })

  it('tokens are 192-bit random hex, unique per party, not derived from ids', () => {
    for (const t of [A.token, B.token]) expect(t).toMatch(/^[0-9a-f]{48}$/)
    expect(A.token).not.toBe(B.token)
    expect(A.token).not.toContain(A.partyId.replace(/-/g, '').slice(0, 12))
  })

  it('party ids, sequential or short tokens reveal nothing', async () => {
    for (const t of [A.partyId, A.invitationId, '1', '0'.repeat(48), A.token.slice(0, 47), A.token.toUpperCase()]) {
      const { data } = await anonClient().rpc('get_invitation', { p_token: t })
      expect(data, t).toBeNull()
    }
  })

  it('the public projection contains no private party data', async () => {
    const { data } = await anonClient().rpc('get_invitation', { p_token: A.token })
    const json = JSON.stringify(data)
    for (const leak of ['48084', A.partyId, A.user.id, 'budget', 'zip', 'email', 'Guest']) expect(json).not.toContain(leak)
  })

  it('anonymous and other users cannot read invitation rows or tokens', async () => {
    expect((await anonClient().from('party_invitations').select('token')).data ?? []).toEqual([])
    expect((await B.user.client.from('party_invitations').select('token').eq('party_id', A.partyId)).data).toEqual([])
  })

  it('RSVP via the route lands only on the right host list', async () => {
    const res = await rsvp(A.token, { name: 'Nguyen family', email: 'nguyen@example.test', status: 'CONFIRMED', adults: 2, children: 1 })
    expect(res.status).toBe(200)
    const a = await A.user.client.from('guests').select('name, rsvp_status').eq('source', 'rsvp_link')
    expect(a.data).toEqual([{ name: 'Nguyen family', rsvp_status: 'CONFIRMED' }])
    expect((await B.user.client.from('guests').select('id').eq('source', 'rsvp_link')).data).toEqual([])
  })

  it('a different invitee cannot overwrite an RSVP by reusing a name', async () => {
    await rsvp(A.token, { name: 'Nguyen family', status: 'DECLINED', adults: 0, children: 0 }, '203.0.113.8')
    const rows = await adminClient().from('guests').select('rsvp_status').eq('party_id', A.partyId).eq('name', 'Nguyen family')
    expect(rows.data?.map((r) => r.rsvp_status).sort()).toEqual(['CONFIRMED', 'DECLINED'])
  })

  it('an RSVP cannot modify host-created guests', async () => {
    await rsvp(A.token, { name: 'Imposter', email: 'a@guest.test', status: 'DECLINED', adults: 0, children: 0 }, '203.0.113.9')
    const host = await adminClient().from('guests').select('name, rsvp_status').eq('id', A.guestId).single()
    expect(host.data).toEqual({ name: 'A Guest', rsvp_status: 'PENDING' })
  })

  it('rejects unknown tokens and malformed input; rate-limits', async () => {
    expect((await rsvp('f'.repeat(48), { name: 'x', status: 'CONFIRMED', adults: 1, children: 0 })).status).toBe(404)
    expect((await rsvp('not-a-token', { name: 'x', status: 'CONFIRMED', adults: 1, children: 0 })).status).toBe(404)
    expect((await rsvp(A.token, { name: '', status: 'CONFIRMED', adults: 1, children: 0 })).status).toBe(400)
    expect((await rsvp(A.token, { name: 'x', status: 'OWNER', adults: 1, children: 0 })).status).toBe(400)
    expect((await rsvp(A.token, { name: 'x', status: 'CONFIRMED', adults: 999, children: 0 })).status).toBe(400)
    resetRateLimits()
    const statuses: number[] = []
    for (let i = 0; i < 8; i++) statuses.push((await rsvp(A.token, { name: `Spam ${i}`, status: 'MAYBE', adults: 1, children: 0 }, '198.51.100.1')).status)
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true)
    expect(statuses.slice(6)).toEqual([429, 429])
  })

  it('a rotated link stops working immediately', async () => {
    const fresh = 'a'.repeat(48)
    await A.user.client.from('party_invitations').update({ token: fresh }).eq('id', A.invitationId)
    expect((await anonClient().rpc('get_invitation', { p_token: A.token })).data).toBeNull()
    expect((await rsvp(A.token, { name: 'Late', status: 'CONFIRMED', adults: 1, children: 0 }, '203.0.113.10')).status).toBe(404)
    expect((await A.user.client.from('party_invitations').update({ token: 'short' }).eq('id', A.invitationId)).error).not.toBeNull()
    await A.user.client.from('party_invitations').update({ token: A.token }).eq('id', A.invitationId)
  })
})

// ------------------------------------------------------------------------------------- input validation
describe('discovery input validation (server-side)', () => {
  const post = (body: unknown) =>
    searchRoute.POST(new Request('http://app.test/api/discovery/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${A.user.accessToken}` }, body: JSON.stringify(body) }))

  it.each([
    [{ partyId: 'x' }],
    [{ partyId: A?.partyId ?? '00000000-0000-0000-0000-000000000000', radiusMiles: 0 }],
    [{ partyId: '00000000-0000-0000-0000-000000000000', radiusMiles: 51 }],
    [{ partyId: '00000000-0000-0000-0000-000000000000', radiusMiles: 'far' }],
    [{ partyId: '00000000-0000-0000-0000-000000000000', radiusMiles: 10.5 }],
    [{ partyId: '00000000-0000-0000-0000-000000000000', categories: Array.from({ length: 11 }, (_, i) => `c${i}`) }],
    [{ partyId: '00000000-0000-0000-0000-000000000000', categories: ['x'.repeat(41)] }],
  ])('rejects %j with 400', async (body) => {
    expect((await post(body)).status).toBe(400)
  })

  it('an invalid ZIP on the party returns 422, not a Google call', async () => {
    const { data } = await A.user.client.from('parties').insert({ user_id: A.user.id, child_name: 'Z', child_age: 5, party_date: '2026-12-01', zip_code: '99999' }).select('id').single()
    const res = await post({ partyId: data!.id })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('invalid_zip')
  })

  it('requires a valid session', async () => {
    const res = await searchRoute.POST(new Request('http://app.test/api/discovery/search', { method: 'POST', headers: { Authorization: 'Bearer not-a-jwt-token-at-all-xxxxx' }, body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('details refuses place ids discovery never surfaced (no Google call, no cost)', async () => {
    const res = await detailsRoute.GET(new Request('http://app.test/api/discovery/places/ChIJneverSeenBefore123', { headers: { Authorization: `Bearer ${A.user.accessToken}` } }), { params: Promise.resolve({ placeId: 'ChIJneverSeenBefore123' }) })
    expect(res.status).toBe(404)
  })

  it('error responses never leak internals', async () => {
    const res = await post({ partyId: 'x' })
    const text = await res.text()
    expect(text).not.toMatch(/stack|PGRST|postgres|ZodError|at \//i)
  })
})
