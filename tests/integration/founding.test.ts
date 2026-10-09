/**
 * Founding families (migration 20251009001700): the first 25 accounts get Pro free. A seat is taken only once the
 * email is confirmed, never by test/staff accounts, never beyond 25 (even under concurrent confirmations), and it
 * unlocks Pro through the normal override path (RLS + server plan). Clients can't take or fake a seat.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, isSupabaseUp } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY })

const up = await isSupabaseUp()
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
// Not a reserved test domain: these accounts qualify for a seat, like real ones.
const email = (label: string, domain = 'founding.example') => `fm-${label}-${stamp}@${domain}`
const made: string[] = []

async function createUser(address: string, confirmed = true) {
  const { data, error } = await adminClient().auth.admin.createUser({ email: address, password: `pw-${stamp}-A1!`, email_confirm: confirmed })
  if (error || !data.user) throw error ?? new Error('createUser failed')
  made.push(data.user.id)
  return data.user.id
}
const seatOf = async (id: string) => (await adminClient().from('founding_members').select('seat').eq('user_id', id).maybeSingle()).data?.seat ?? null
const left = async () => (await anonClient().rpc('founding_seats_left')).data

async function cleanup() {
  await Promise.all(made.splice(0).map((id) => adminClient().auth.admin.deleteUser(id)))
}
afterEach(cleanup)
afterAll(cleanup)

describe.skipIf(!up)('founding families', () => {
  it('a confirmed account gets a seat and Pro, shown as "founding" by the server', async () => {
    const before = await left()
    const id = await createUser(email('a'))
    expect(await seatOf(id)).toBeGreaterThanOrEqual(1)
    expect(await left()).toBe(before! - 1)
    const { data: ov } = await adminClient().from('plan_overrides').select('plan, expires_at').eq('user_id', id).single()
    expect(ov).toEqual({ plan: 'PRO', expires_at: null })
    expect((await adminClient().from('users').select('current_plan').eq('id', id).single()).data?.current_plan).toBe('PRO')
    const { getUserPlan, getPartyPlan } = await import('@/lib/billing/server')
    const plan = await getUserPlan(adminClient() as never, id)
    expect(plan).toMatchObject({ plan: 'PRO', source: 'founding' })
    expect(plan.foundingSeat).toBe(await seatOf(id))
    expect(await getPartyPlan(adminClient() as never, id, crypto.randomUUID())).toMatchObject({ plan: 'PRO', source: 'founding' })

    // Pro on every party, enforced by RLS (guests are Starter+): the user's own client can add a guest.
    const client = anonClient()
    await client.auth.signInWithPassword({ email: email('a'), password: `pw-${stamp}-A1!` })
    const date = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10)
    const { data: party, error } = await client.from('parties').insert({ user_id: id, child_name: 'Ava', child_age: 6, party_date: date, zip_code: '48084', guest_count: 10, budget: 300 }).select('id').single()
    expect(error).toBeNull()
    await adminClient().from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', id) // no trial help
    expect((await client.rpc('has_paid_access', { p_party: party!.id })).data).toBe(true)
    expect((await client.from('guests').insert({ party_id: party!.id, user_id: id, name: 'Sam' }).select('id')).error).toBeNull()
  })

  it('no seat before the email is confirmed; the seat comes with the confirmation', async () => {
    const id = await createUser(email('later'), false)
    expect(await seatOf(id)).toBeNull()
    await adminClient().auth.admin.updateUserById(id, { email_confirm: true })
    expect(await seatOf(id)).not.toBeNull()
  })

  it('test addresses and Super Admins never take a seat', async () => {
    for (const a of [email('t', 'example.test'), email('i', 'users.invalid'), email('r', 'resend.dev')]) expect(await seatOf(await createUser(a))).toBeNull()
    const id = await createUser(email('admin'), false)
    await adminClient().from('user_roles').insert({ user_id: id, role: 'super_admin' })
    await adminClient().auth.admin.updateUserById(id, { email_confirm: true })
    expect(await seatOf(id)).toBeNull()
  })

  it('never more than 25, even when everyone confirms at once; a deleted account frees its seat', async () => {
    const free = (await left()) as number
    const ids = await Promise.all(Array.from({ length: free + 3 }, (_, i) => createUser(email(`rush${i}`))))
    const all = await Promise.all(ids.map(seatOf))
    const seats = all.filter((s) => s !== null)
    expect(seats).toHaveLength(free)
    expect(new Set(seats).size).toBe(free)
    expect((await adminClient().from('founding_members').select('seat')).data).toHaveLength(25)
    expect(await left()).toBe(0)
    const late = ids[all.indexOf(null)] // who lost the race: no seat, no Pro
    expect((await adminClient().from('plan_overrides').select('user_id').eq('user_id', late)).data).toEqual([])

    const route = await import('@/app/api/founding/route')
    expect(await (await route.GET()).json()).toEqual({ seats: 25, left: 0 })

    const holder = ids[all.findIndex((s) => s !== null)]
    await adminClient().auth.admin.deleteUser(holder)
    expect(await left()).toBe(1)
  })

  it('clients cannot take, fake or list seats', async () => {
    const id = await createUser(email('c'), false)
    const client = anonClient()
    await adminClient().auth.admin.updateUserById(id, { email_confirm: false })
    await client.auth.signInWithPassword({ email: email('c'), password: `pw-${stamp}-A1!` }).catch(() => null)
    for (const c of [anonClient(), client]) {
      expect((await c.rpc('claim_founding_seat', { p_user: id })).error).not.toBeNull()
      await c.from('founding_members').insert({ user_id: id, seat: 25 })
    }
    expect(await seatOf(id)).toBeNull()
    expect((await anonClient().from('founding_members').select('user_id')).data ?? []).toEqual([])
  })
})
