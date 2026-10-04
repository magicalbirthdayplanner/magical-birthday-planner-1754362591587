/**
 * Product model, non-AI side (lib/entitlements.ts): guests & RSVP are Starter+. The browser writes guests and
 * invitations straight through RLS, so the database itself must refuse them for Free accounts — hiding the screen
 * is not enough. The 24 h sign-up trial unlocks them; a purchase or override unlocks them; a downgrade keeps the
 * data readable/deletable and public RSVPs to an existing invitation keep working.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

// Email is deliberately not configured: a request that passes the plan check stops at 503 not_configured.
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY })
delete process.env.RESEND_API_KEY

const up = await isSupabaseUp()
let U: TestUser, partyId: string
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

type State = 'trial' | 'free' | 'override:STARTER' | 'override:FREE' | 'purchase' | 'expired-override'
async function setState(u: TestUser, s: State) {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', u.id)
  await db.from('billing_purchases').delete().eq('user_id', u.id)
  const trial = s === 'trial'
  await db.from('users').update({ is_trial_active: trial, trial_expires_at: trial ? new Date(Date.now() + 864e5).toISOString() : '2020-01-01T00:00:00Z' }).eq('id', u.id)
  if (s === 'override:STARTER' || s === 'override:FREE') await db.from('plan_overrides').insert({ user_id: u.id, plan: s.split(':')[1], expires_at: null })
  if (s === 'expired-override') await db.from('plan_overrides').insert({ user_id: u.id, plan: 'PRO', expires_at: '2020-01-01T00:00:00Z' })
  if (s === 'purchase') {
    const { error } = await db.from('billing_purchases').insert({ user_id: u.id, provider_ref: `test-${u.id}`, kind: 'payment', plan: 'STARTER', status: 'active' })
    expect(error).toBeNull()
  }
  await db.rpc('recompute_entitlement', { p_user: u.id })
}
const paid = async (u: TestUser) => (await u.client.rpc('has_paid_access')).data
const addGuest = (u: TestUser, name: string) => u.client.from('guests').insert({ party_id: partyId, user_id: u.id, name }).select('id')
const sendInvites = async (u: TestUser) => {
  const route = await import('@/app/api/invitations/send/route')
  return route.POST(new Request('http://app.test/api/invitations/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.accessToken}` }, body: JSON.stringify({ partyId }) }))
}

beforeAll(async () => {
  if (!up) return
  U = await createTestUser('plan-ent')
  partyId = (await U.client.from('parties').insert({ user_id: U.id, child_name: 'Ava', child_age: 7, party_date: inDays(20), zip_code: '48084', guest_count: 10, budget: 250 }).select('id').single()).data!.id
})
afterAll(async () => {
  if (!up) return
  await adminClient().from('plan_overrides').delete().eq('user_id', U.id)
  await adminClient().from('billing_purchases').delete().eq('user_id', U.id)
  await deleteTestUser(U)
})

describe.skipIf(!up)('guests & RSVP are Starter+ (enforced by the database)', () => {
  it('has_paid_access: trial, purchase and a paid override → true; Free, a FREE override and an expired override → false; anon cannot call it', async () => {
    const expected: [State, boolean][] = [['trial', true], ['purchase', true], ['override:STARTER', true], ['free', false], ['override:FREE', false], ['expired-override', false]]
    for (const [s, want] of expected) {
      await setState(U, s)
      expect([s, await paid(U)]).toEqual([s, want])
    }
    expect((await anonClient().rpc('has_paid_access')).data).not.toBe(true)
  })

  it('the sign-up trial can add guests and create the invitation', async () => {
    await setState(U, 'trial')
    const g = await addGuest(U, 'Trial family')
    expect(g.error).toBeNull()
    const inv = await U.client.from('party_invitations').insert({ party_id: partyId, headline: 'Party!' }).select('token').single()
    expect(inv.error).toBeNull()
  })

  it('Free cannot add or change guests, or create/change the invitation — but can still read and delete them', async () => {
    await setState(U, 'free')
    expect((await addGuest(U, 'Free family')).error).not.toBeNull()
    const existing = (await U.client.from('guests').select('id, name').eq('party_id', partyId)).data!
    expect(existing.map((g) => g.name)).toEqual(['Trial family']) // downgrade: nothing lost, still readable
    const upd = await U.client.from('guests').update({ name: 'Renamed' }).eq('id', existing[0].id).select('id')
    expect(upd.error !== null || upd.data!.length === 0).toBe(true)
    expect((await adminClient().from('guests').select('name').eq('id', existing[0].id).single()).data!.name).toBe('Trial family')
    const invUpd = await U.client.from('party_invitations').update({ headline: 'Changed' }).eq('party_id', partyId).select('id')
    expect(invUpd.error !== null || invUpd.data!.length === 0).toBe(true)
    // a second party cannot get a new invitation
    const p2 = (await U.client.from('parties').insert({ user_id: U.id, child_name: 'Ben', child_age: 5, party_date: inDays(40), zip_code: '48084', guest_count: 8, budget: 200 }).select('id').single()).data!.id
    expect((await U.client.from('party_invitations').insert({ party_id: p2, headline: 'x' })).error).not.toBeNull()
    await U.client.from('parties').delete().eq('id', p2)
    // emailing invitations is refused by the route
    const r = await sendInvites(U)
    expect(r.status).toBe(403)
    expect((await r.json()).error.code).toBe('forbidden')
  })

  it('after a downgrade, guests can still RSVP to the invitation that was already shared', async () => {
    await setState(U, 'free')
    const { data: inv } = await adminClient().from('party_invitations').select('token').eq('party_id', partyId).single()
    expect((await anonClient().rpc('get_invitation', { p_token: inv!.token })).data).not.toBeNull()
  })

  it('Starter (purchase or override) can manage guests again; the host can always delete', async () => {
    for (const s of ['purchase', 'override:STARTER'] as const) {
      await setState(U, s)
      const g = await addGuest(U, `Paid ${s}`)
      expect(g.error).toBeNull()
      expect((await U.client.from('party_invitations').update({ headline: `Hi ${s}` }).eq('party_id', partyId).select('id')).data).toHaveLength(1)
      const r = await sendInvites(U)
      expect(r.status).toBe(503) // past the plan check
      expect((await r.json()).error.code).toBe('not_configured')
    }
    await setState(U, 'free')
    const del = await U.client.from('guests').delete().eq('party_id', partyId).select('id')
    expect(del.error).toBeNull()
    expect(del.data!.length).toBeGreaterThanOrEqual(3)
  })
})
