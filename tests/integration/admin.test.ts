/**
 * Super Admin: role checks, plan overrides (with expiry), audit log, and that overrides
 * never touch billing — real purchases keep working underneath them.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'
import { signWebhook } from '@/lib/billing/webhook-signature'

const WEBHOOK_SECRET = 'whsec_' + Buffer.from('integration-admin-signing-key-01').toString('base64')
const PRODUCTS = { STARTER: 'pdt_adStarter001', PLUS: 'pdt_adPlus000002', PRO: 'pdt_adPro0000003' }

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  DODO_PAYMENTS_WEBHOOK_SECRET: WEBHOOK_SECRET,
  DODO_PRODUCT_STARTER: PRODUCTS.STARTER,
  DODO_PRODUCT_PLUS: PRODUCTS.PLUS,
  DODO_PRODUCT_PRO: PRODUCTS.PRO,
})

const session = await import('@/app/api/admin/session/route')
const users = await import('@/app/api/admin/users/route')
const stats = await import('@/app/api/admin/stats/route')
const override = await import('@/app/api/admin/override/route')
const audit = await import('@/app/api/admin/audit/route')
const status = await import('@/app/api/billing/status/route')
const webhook = await import('@/app/api/webhooks/dodo/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

let A: TestUser // super admin
let U: TestUser // normal user
let seq = 0

const req = (path: string, token: string | null, method = 'GET', body?: unknown) =>
  new Request(`http://app.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const setOverride = (token: string | null, body: unknown) => override.POST(req('/api/admin/override', token, 'POST', body))
const removeOverride = (token: string | null, body: unknown) => override.DELETE(req('/api/admin/override', token, 'DELETE', body))
const billing = async (u: TestUser) => (await status.GET(req('/api/billing/status', u.accessToken))).json()
const planOf = async (u: TestUser) => (await adminClient().from('users').select('current_plan').eq('id', u.id).single()).data!.current_plan
const purchasesOf = async (u: TestUser) => (await adminClient().from('billing_purchases').select('id').eq('user_id', u.id)).data!.length
const auditFor = async (u: TestUser) => (await adminClient().from('admin_audit_log').select('*').eq('target_user_id', u.id).order('id')).data!

function buy(user: TestUser, plan: keyof typeof PRODUCTS) {
  const id = `msg_admin_${Date.now()}_${++seq}`
  const ts = Math.floor(Date.now() / 1000)
  const raw = JSON.stringify({
    business_id: 'bus_test',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Payment',
      payment_id: `pay_admin_${user.id.slice(0, 8)}_${seq}`,
      total_amount: 999,
      currency: 'USD',
      product_cart: [{ product_id: PRODUCTS[plan], quantity: 1 }],
      customer: { customer_id: `cus_admin_${user.id.slice(0, 8)}`, email: user.email, name: 'Test' },
      metadata: { mbp_user_id: user.id },
    },
  })
  return webhook.POST(new Request('http://app.test/api/webhooks/dodo', { method: 'POST', headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': signWebhook(WEBHOOK_SECRET, id, ts, raw), 'Content-Type': 'application/json' }, body: raw }))
}

async function reset(u: TestUser, trial = false) {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', u.id)
  await db.from('billing_purchases').delete().eq('user_id', u.id)
  await db.from('billing_customers').delete().eq('user_id', u.id)
  await db.from('users').update(trial ? { is_trial_active: true, trial_plan: 'PRO', trial_expires_at: new Date(Date.now() + 86_400_000).toISOString() } : { is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', u.id)
  await db.rpc('recompute_entitlement', { p_user: u.id })
}

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  ;[A, U] = await Promise.all([createTestUser('admin-a'), createTestUser('admin-u')])
  // The role is granted only server-side (service role), exactly like the production seed.
  const { error } = await adminClient().from('user_roles').insert({ user_id: A.id, role: 'super_admin' })
  if (error) throw error
})
afterAll(async () => {
  await adminClient().from('admin_audit_log').delete().or(`admin_user_id.eq.${A.id},target_user_id.eq.${A.id},target_user_id.eq.${U.id}`)
  await Promise.all([deleteTestUser(A), deleteTestUser(U)])
})
beforeEach(async () => {
  resetRateLimits()
  await adminClient().from('admin_audit_log').delete().in('target_user_id', [A.id, U.id])
  await reset(A)
  await reset(U)
})

describe('access control', () => {
  it('only a verified super_admin reaches admin APIs; everyone else gets 404 with no admin data', async () => {
    expect((await session.GET(req('/api/admin/session', A.accessToken))).status).toBe(200)
    for (const token of [null, U.accessToken, 'not-a-jwt']) {
      for (const res of [
        await session.GET(req('/api/admin/session', token)),
        await users.GET(req('/api/admin/users?q=', token)),
        await stats.GET(req('/api/admin/stats', token)),
        await audit.GET(req('/api/admin/audit', token)),
        await setOverride(token, { userId: U.id, plan: 'PRO', duration: 'none' }),
        await removeOverride(token, { userId: U.id }),
      ]) {
        expect(res.status).toBe(404)
        const text = await res.text()
        expect(text).not.toContain(A.email)
        expect(text).not.toMatch(/super_admin|override/i)
      }
    }
    expect(await planOf(U)).toBe('FREE')
  })

  it('ignores client-claimed roles/plans in the request', async () => {
    const res = await setOverride(U.accessToken, { userId: U.id, plan: 'PRO', duration: 'none', isAdmin: true, role: 'super_admin' })
    expect(res.status).toBe(404)
    // Even an admin can't smuggle extra fields.
    expect((await setOverride(A.accessToken, { userId: U.id, plan: 'PRO', duration: 'none', set_by: U.id })).status).toBe(400)
    expect((await setOverride(A.accessToken, { userId: U.id, plan: 'PROFESSIONAL', duration: 'none' })).status).toBe(400)
    expect((await setOverride(A.accessToken, { userId: U.id, plan: 'PRO', duration: '1y' })).status).toBe(400)
    expect((await setOverride(A.accessToken, { userId: '00000000-0000-0000-0000-000000000000', plan: 'PRO', duration: 'none' })).status).toBe(404)
  })
})

describe('direct database manipulation is denied', () => {
  it('a user cannot grant roles, create overrides, write audit rows, recompute or edit their plan', async () => {
    const c = U.client
    expect((await c.from('user_roles').insert({ user_id: U.id, role: 'super_admin' })).error).not.toBeNull()
    expect((await c.from('plan_overrides').insert({ user_id: U.id, plan: 'PRO' })).error).not.toBeNull()
    expect((await c.from('admin_audit_log').insert({ action: 'role_granted', target_user_id: U.id })).error).not.toBeNull()
    expect((await c.rpc('recompute_entitlement', { p_user: U.id })).error).not.toBeNull()
    await c.from('users').update({ current_plan: 'PRO' }).eq('id', U.id)
    expect(await planOf(U)).toBe('FREE')
    // anon too
    expect((await anonClient().from('user_roles').insert({ user_id: U.id, role: 'super_admin' })).error).not.toBeNull()
    expect((await adminClient().from('user_roles').select('user_id').eq('user_id', U.id)).data).toEqual([])
  })

  it("a user can't modify or delete an override set on them, nor read anyone's roles or the audit log", async () => {
    await setOverride(A.accessToken, { userId: U.id, plan: 'STARTER', duration: 'none' })
    await U.client.from('plan_overrides').update({ plan: 'PRO', expires_at: null }).eq('user_id', U.id)
    await U.client.from('plan_overrides').delete().eq('user_id', U.id)
    expect((await adminClient().from('plan_overrides').select('plan').eq('user_id', U.id).single()).data!.plan).toBe('STARTER')
    expect((await U.client.from('user_roles').select('*')).data).toEqual([]) // admin list hidden
    const auditRead = await U.client.from('admin_audit_log').select('*')
    expect(auditRead.data ?? []).toEqual([])
    // An admin's own JWT on the plain data API is no more privileged.
    await A.client.from('plan_overrides').insert({ user_id: U.id, plan: 'PRO' })
    expect((await adminClient().from('plan_overrides').select('plan').eq('user_id', U.id).single()).data!.plan).toBe('STARTER')
  })
})

describe('plan overrides', () => {
  it('switches FREE → STARTER → PLUS → PRO → FREE as an admin override, never a purchase', async () => {
    for (const plan of ['STARTER', 'PLUS', 'PRO', 'FREE'] as const) {
      const res = await setOverride(A.accessToken, { userId: U.id, plan, duration: 'none' })
      expect(res.status).toBe(200)
      const b = await billing(U)
      expect(b).toMatchObject({ plan, source: 'admin_override', override: { plan, expiresAt: null } })
      expect(await planOf(U)).toBe(plan)
    }
    expect(await purchasesOf(U)).toBe(0)
    expect((await adminClient().from('billing_checkouts').select('id').eq('user_id', U.id)).data).toEqual([])
    const log = await auditFor(U)
    expect(log.map((l) => [l.action, l.old_plan, l.new_plan])).toEqual([
      ['override_set', 'FREE', 'STARTER'],
      ['override_changed', 'STARTER', 'PLUS'],
      ['override_changed', 'PLUS', 'PRO'],
      ['override_changed', 'PRO', 'FREE'],
    ])
    expect(log.every((l) => l.admin_user_id === A.id)).toBe(true)
  })

  it('stores the expiry for 24h / 7d / 30d and none', async () => {
    for (const [duration, ms] of [['24h', 864e5], ['7d', 7 * 864e5], ['30d', 30 * 864e5]] as const) {
      await setOverride(A.accessToken, { userId: U.id, plan: 'PLUS', duration })
      const row = (await adminClient().from('plan_overrides').select('expires_at, set_by').eq('user_id', U.id).single()).data!
      expect(Math.abs(new Date(row.expires_at!).getTime() - (Date.now() + ms))).toBeLessThan(60_000)
      expect(row.set_by).toBe(A.id)
    }
  })

  it('an expired override lapses: normal plan resumes and the expiry is audited', async () => {
    await setOverride(A.accessToken, { userId: U.id, plan: 'PRO', duration: '24h' })
    expect(await planOf(U)).toBe('PRO')
    await adminClient().from('plan_overrides').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('user_id', U.id)
    const b = await billing(U)
    expect(b).toMatchObject({ plan: 'FREE', source: 'free', override: null })
    expect(await planOf(U)).toBe('FREE')
    expect((await adminClient().from('plan_overrides').select('user_id').eq('user_id', U.id)).data).toEqual([])
    expect((await auditFor(U)).at(-1)).toMatchObject({ action: 'override_expired', old_plan: 'PRO' })
  })

  it('even before cleanup, recompute ignores an expired override', async () => {
    await adminClient().from('plan_overrides').insert({ user_id: U.id, plan: 'PRO', expires_at: new Date(Date.now() - 1000).toISOString() })
    expect((await adminClient().rpc('recompute_entitlement', { p_user: U.id })).data).toBe('FREE')
  })

  it('removing an override restores the trial', async () => {
    await reset(U, true)
    expect(await billing(U)).toMatchObject({ plan: 'PRO', source: 'trial', trialActive: true })
    await setOverride(A.accessToken, { userId: U.id, plan: 'STARTER', duration: '7d' })
    expect(await billing(U)).toMatchObject({ plan: 'STARTER', source: 'admin_override' })
    expect((await removeOverride(A.accessToken, { userId: U.id })).status).toBe(200)
    expect(await billing(U)).toMatchObject({ plan: 'PRO', source: 'trial', override: null })
    expect((await auditFor(U)).at(-1)).toMatchObject({ action: 'override_removed', old_plan: 'STARTER', new_plan: 'PRO' })
  })

  it('a real purchase still grants, under and after an override', async () => {
    await setOverride(A.accessToken, { userId: U.id, plan: 'FREE', duration: 'none' })
    expect((await buy(U, 'PLUS')).status).toBe(200)
    expect(await purchasesOf(U)).toBe(1)
    expect(await billing(U)).toMatchObject({ plan: 'FREE', source: 'admin_override' }) // override wins while active
    await removeOverride(A.accessToken, { userId: U.id })
    expect(await billing(U)).toMatchObject({ plan: 'PLUS', source: 'purchase', override: null })
    expect(await purchasesOf(U)).toBe(1) // removal didn't touch billing
    // And without any override a purchase grants immediately.
    await reset(U)
    expect((await buy(U, 'STARTER')).status).toBe(200)
    expect(await billing(U)).toMatchObject({ plan: 'STARTER', source: 'purchase' })
  })

  it('the admin can switch their own plan (quick test) and it persists across sessions', async () => {
    await setOverride(A.accessToken, { userId: A.id, plan: 'PLUS', duration: '24h' })
    // A fresh sign-in on a new client sees the server-side state.
    expect(await billing(A)).toMatchObject({ plan: 'PLUS', source: 'admin_override' })
    expect((await A.client.from('plan_overrides').select('plan').eq('user_id', A.id).single()).data!.plan).toBe('PLUS')
  })
})

describe('admin reads', () => {
  it('search by email or name returns profile + plan fields only (no secrets); search syntax is inert', async () => {
    await setOverride(A.accessToken, { userId: U.id, plan: 'PRO', duration: '30d' })
    const res = await users.GET(req(`/api/admin/users?q=${encodeURIComponent(U.email.split('@')[0])}`, A.accessToken))
    const { users: list } = await res.json()
    expect(list).toHaveLength(1)
    expect(Object.keys(list[0]).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'override', 'plan', 'role', 'source', 'trialActive'])
    expect(list[0]).toMatchObject({ id: U.id, email: U.email, plan: 'PRO', source: 'admin_override', role: null })
    const injected = await users.GET(req(`/api/admin/users?q=${encodeURIComponent('x),id.not.is.null,(email')}`, A.accessToken))
    expect(injected.status).toBe(200)
    expect((await injected.json()).users).toEqual([])
  })

  it('stats and audit history', async () => {
    await setOverride(A.accessToken, { userId: U.id, plan: 'PLUS', duration: 'none' })
    const s = await (await stats.GET(req('/api/admin/stats', A.accessToken))).json()
    expect(s.users).toBeGreaterThanOrEqual(2)
    expect(s.overrides).toBeGreaterThanOrEqual(1)
    const { entries } = await (await audit.GET(req('/api/admin/audit', A.accessToken))).json()
    expect(entries[0]).toMatchObject({ target: U.email, action: 'override_set', newPlan: 'PLUS', expiresAt: null })
  })
})
