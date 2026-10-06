/**
 * Launch waitlist against local Supabase: anonymous sign-up through /api/waitlist, duplicate handling, and that no
 * client role (anon or signed-in) can read, change or delete waitlist rows or call the waitlist functions.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY })

const route = await import('@/app/api/waitlist/route')
const adminRoute = await import('@/app/api/admin/waitlist/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const email = (n: string) => `wl-${n}-${stamp}@example.test`
const post = (body: unknown) =>
  route.POST(new Request('http://app.test/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` }, body: JSON.stringify(body) }))
const rows = async (e: string) => (await adminClient().from('launch_waitlist').select('*').eq('email', e)).data ?? []

let U: TestUser
let A: TestUser
beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  ;[U, A] = await Promise.all([createTestUser('wl-user'), createTestUser('wl-admin')])
  await adminClient().from('user_roles').insert({ user_id: A.id, role: 'super_admin' })
})
afterAll(async () => {
  await adminClient().from('launch_waitlist').delete().like('email', `%-${stamp}@example.test`)
  await adminClient().from('user_roles').delete().eq('user_id', A.id)
  await Promise.all([deleteTestUser(U), deleteTestUser(A)])
})
beforeEach(() => resetRateLimits())

describe('anonymous sign-up', () => {
  it('stores one normalized row with first-touch attribution', async () => {
    const res = await post({ email: `  ${email('one').toUpperCase()} `, firstName: 'Sam', utm_source: 'instagram', utm_medium: 'story', utm_campaign: 'prelaunch_oct13', utm_content: 'd07_story' })
    expect(res.status).toBe(200)
    const [row] = await rows(email('one'))
    expect(row).toMatchObject({ email: email('one'), first_name: 'Sam', utm_source: 'instagram', utm_medium: 'story', utm_campaign: 'prelaunch_oct13', utm_content: 'd07_story', status: 'subscribed', signup_count: 1 })
  })

  it('the same email again (any capitalisation) is accepted but never creates a second row or overwrites attribution', async () => {
    await post({ email: email('dup'), utm_source: 'reddit' })
    const again = await post({ email: email('dup').replace('wl-', 'WL-'), firstName: 'Alex', utm_source: 'facebook' })
    expect([again.status, await again.json()]).toEqual([200, { ok: true }])
    const r = await rows(email('dup'))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ utm_source: 'reddit', first_name: 'Alex', signup_count: 2 })
  })

  it('an invalid email is rejected and stores nothing', async () => {
    expect((await post({ email: `not-an-email-${stamp}` })).status).toBe(400)
    expect((await adminClient().from('launch_waitlist').select('id').like('email', `not-an-email-${stamp}%`)).data).toEqual([])
  })

  it('the database itself refuses un-normalized or malformed emails', async () => {
    expect((await adminClient().from('launch_waitlist').insert({ email: `Upper-${stamp}@Example.test` })).error).not.toBeNull()
    expect((await adminClient().from('launch_waitlist').insert({ email: 'no-at-sign' })).error).not.toBeNull()
  })
})

describe('clients can never touch the waitlist', () => {
  it('anon: no read, insert, update, delete or RPC', async () => {
    await post({ email: email('target') })
    const anon = anonClient()
    const read = await anon.from('launch_waitlist').select('email')
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true)
    expect((await anon.from('launch_waitlist').insert({ email: email('anon-insert') })).error).not.toBeNull()
    await anon.from('launch_waitlist').update({ status: 'unsubscribed' }).eq('email', email('target'))
    await anon.from('launch_waitlist').delete().eq('email', email('target'))
    expect(await rows(email('target'))).toMatchObject([{ status: 'subscribed' }])
    expect((await anon.rpc('join_launch_waitlist', { p_email: email('anon-rpc') })).error).not.toBeNull()
    expect((await anon.rpc('launch_waitlist_stats')).error).not.toBeNull()
    expect(await rows(email('anon-rpc'))).toEqual([])
    expect(await rows(email('anon-insert'))).toEqual([])
  })

  it('a signed-in user: the same', async () => {
    const read = await U.client.from('launch_waitlist').select('email')
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true)
    expect((await U.client.from('launch_waitlist').insert({ email: email('user-insert') })).error).not.toBeNull()
    await U.client.from('launch_waitlist').delete().eq('email', email('target'))
    expect(await rows(email('target'))).toHaveLength(1)
    expect((await U.client.rpc('launch_waitlist_stats')).error).not.toBeNull()
  })
})

describe('admin stats', () => {
  const get = (token: string) => adminRoute.GET(new Request('http://app.test/api/admin/waitlist', { headers: { Authorization: `Bearer ${token}` } }))

  it('Super Admin gets counts only (no emails); anyone else gets 404', async () => {
    const res = await get(A.accessToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThanOrEqual(3)
    expect(body.today).toBeGreaterThanOrEqual(1)
    expect(body.bySource.instagram).toBeGreaterThanOrEqual(1)
    expect(body.byCampaign.prelaunch_oct13).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(body)).not.toContain('@')
    expect((await get(U.accessToken)).status).toBe(404)
  })
})
