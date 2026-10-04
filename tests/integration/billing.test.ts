/**
 * Dodo billing end-to-end against local Supabase + a mock Dodo API.
 * Premium is granted ONLY by a verified webhook.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'
import { signWebhook } from '@/lib/billing/webhook-signature'

const WEBHOOK_SECRET = 'whsec_' + Buffer.from('integration-test-signing-key-xyz').toString('base64')
const PRODUCTS = { STARTER: 'pdt_itStarter001', PLUS: 'pdt_itPlus000002', PRO: 'pdt_itPro0000003' }

// ---- mock Dodo API: POST /checkouts
const created: Record<string, unknown>[] = []
let dodoMode: 'ok' | 'error' = 'ok'
const dodo = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/checkouts' && req.headers.authorization === 'Bearer test_dodo_key') {
      if (dodoMode === 'error') {
        res.writeHead(500).end('{}')
        return
      }
      const json = JSON.parse(body)
      created.push(json)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ session_id: `cks_${created.length}`, checkout_url: `https://test.checkout.dodopayments.com/session/cks_${created.length}` }))
      return
    }
    res.writeHead(401).end('{}')
  })
})
await new Promise<void>((r) => dodo.listen(0, '127.0.0.1', () => r()))
const DODO_BASE = `http://127.0.0.1:${(dodo.address() as AddressInfo).port}`

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  DODO_PAYMENTS_API_KEY: 'test_dodo_key',
  DODO_PAYMENTS_WEBHOOK_SECRET: WEBHOOK_SECRET,
  DODO_PAYMENTS_ENVIRONMENT: 'test_mode',
  DODO_API_BASE_URL: DODO_BASE,
  DODO_PRODUCT_STARTER: PRODUCTS.STARTER,
  DODO_PRODUCT_PLUS: PRODUCTS.PLUS,
  DODO_PRODUCT_PRO: PRODUCTS.PRO,
  NEXT_PUBLIC_BASE_URL: 'https://preview.example.test',
})

const checkout = await import('@/app/api/billing/checkout/route')
const webhook = await import('@/app/api/webhooks/dodo/route')
const status = await import('@/app/api/billing/status/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

let U: TestUser
let V: TestUser
let PU: string // U's party
let PU2: string // U's second party
let PV: string // V's party
let seq = 0
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const newParty = async (u: TestUser, name = 'Ava') =>
  (await u.client.from('parties').insert({ user_id: u.id, child_name: name, child_age: 7, party_date: inDays(30), zip_code: '48084', guest_count: 12, budget: 250 }).select('id').single()).data!.id as string

const post = (token: string | null, body: unknown) =>
  checkout.POST(new Request('http://app.test/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }))

function send(event: unknown, opts: { id?: string; secret?: string; ts?: number } = {}) {
  const id = opts.id ?? `msg_${Date.now()}_${++seq}`
  const ts = opts.ts ?? Math.floor(Date.now() / 1000)
  const raw = JSON.stringify(event)
  return webhook.POST(
    new Request('http://app.test/api/webhooks/dodo', {
      method: 'POST',
      headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': signWebhook(opts.secret ?? WEBHOOK_SECRET, id, ts, raw), 'Content-Type': 'application/json' },
      body: raw,
    }),
  )
}

const payment = (user: TestUser, over: Record<string, unknown> = {}, type = 'payment.succeeded') => ({
  business_id: 'bus_test',
  type,
  timestamp: new Date().toISOString(),
  data: {
    payload_type: 'Payment',
    payment_id: `pay_${user.id.slice(0, 8)}_${++seq}`,
    total_amount: 1999,
    currency: 'USD',
    product_cart: [{ product_id: PRODUCTS.PLUS, quantity: 1 }],
    customer: { customer_id: `cus_${user.id.slice(0, 8)}`, email: user.email, name: 'Test' },
    metadata: { mbp_user_id: user.id },
    ...over,
  },
})

const statusOf = async (u: TestUser) => (await status.GET(new Request('http://app.test/api/billing/status', { headers: { Authorization: `Bearer ${u.accessToken}` } }))).json()
const partyStatus = async (u: TestUser, partyId: string) => (await status.GET(new Request(`http://app.test/api/billing/status?partyId=${partyId}`, { headers: { Authorization: `Bearer ${u.accessToken}` } }))).json()
const planOf = async (u: TestUser) => (await adminClient().from('users').select('current_plan').eq('id', u.id).single()).data!.current_plan

async function resetToFree(u: TestUser) {
  await adminClient().from('billing_purchases').delete().eq('user_id', u.id)
  await adminClient().from('billing_customers').delete().eq('user_id', u.id)
  await adminClient().from('billing_checkouts').delete().eq('user_id', u.id)
  await adminClient().from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', u.id)
  await adminClient().rpc('recompute_entitlement', { p_user: u.id })
}

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  ;[U, V] = await Promise.all([createTestUser('bill-u'), createTestUser('bill-v')])
  ;[PU, PU2, PV] = await Promise.all([newParty(U), newParty(U, 'Ben'), newParty(V)])
})
afterAll(async () => {
  for (const k of ["DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_SECRET", "DODO_PAYMENTS_ENVIRONMENT", "DODO_API_BASE_URL", "DODO_PRODUCT_STARTER", "DODO_PRODUCT_PLUS", "DODO_PRODUCT_PRO"]) delete process.env[k]
  dodo.close()
  await Promise.all([deleteTestUser(U), deleteTestUser(V)])
})
beforeEach(async () => {
  resetRateLimits()
  dodoMode = 'ok'
  await resetToFree(U)
  await resetToFree(V)
})

describe('checkout', () => {
  it('requires sign-in, a valid plan and one of your parties; client cannot pick product, price or user', async () => {
    expect((await post(null, { plan: 'PLUS', partyId: PU })).status).toBe(401)
    expect((await post(U.accessToken, { plan: 'PROFESSIONAL', partyId: PU })).status).toBe(400)
    expect((await post(U.accessToken, { plan: 'PLUS', partyId: PU, product_id: 'pdt_cheap', price: 1, userId: V.id })).status).toBe(400)
    expect((await post(U.accessToken, { plan: 'enterprise', partyId: PU })).status).toBe(400)
    expect((await post(U.accessToken, { plan: PRODUCTS.PRO, partyId: PU })).status).toBe(400) // a product id is not a plan
    expect((await post(U.accessToken, { productId: PRODUCTS.PRO, partyId: PU })).status).toBe(400)
    expect((await post(U.accessToken, { plan: 'PLUS' })).status).toBe(400) // plans are bought for a party
    expect((await post(U.accessToken, { plan: 'PLUS', partyId: 'not-a-uuid' })).status).toBe(400)
    expect((await post(U.accessToken, { plan: 'PLUS', partyId: PV })).status).toBe(404) // someone else's party
  })

  it('accepts lower-case plan names and tags the checkout (application, environment)', async () => {
    const res = await post(U.accessToken, { plan: 'starter', partyId: PU })
    expect(res.status).toBe(200)
    const sent = created.at(-1) as { product_cart: { product_id: string }[]; metadata: Record<string, string> }
    expect(sent.product_cart[0].product_id).toBe(PRODUCTS.STARTER)
    expect(sent.metadata).toMatchObject({ application: 'magical-birthday-planner', environment: 'test', mbp_plan: 'STARTER' })
  })

  it('refuses checkout when DODO_PAYMENTS_ENVIRONMENT is missing (no silent default)', async () => {
    delete process.env.DODO_PAYMENTS_ENVIRONMENT
    try {
      expect((await post(U.accessToken, { plan: 'PLUS', partyId: PU })).status).toBe(503)
    } finally {
      process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode'
    }
  })

  it('creates a server-controlled Dodo checkout and records it', async () => {
    const res = await post(U.accessToken, { plan: 'PLUS', partyId: PU })
    expect(res.status).toBe(200)
    const { checkoutUrl } = await res.json()
    expect(checkoutUrl).toMatch(/^https:\/\/test\.checkout\.dodopayments\.com\//)
    const sent = created.at(-1) as { product_cart: { product_id: string; quantity: number }[]; customer: { email: string }; metadata: Record<string, string>; return_url: string }
    expect(sent.product_cart).toEqual([{ product_id: PRODUCTS.PLUS, quantity: 1 }])
    expect(sent.customer.email).toBe(U.email)
    expect(sent.metadata.mbp_user_id).toBe(U.id)
    expect(sent.return_url).toMatch(/^https:\/\/preview\.example\.test\/checkout-success\?ref=/)
    const { data } = await adminClient().from('billing_checkouts').select('plan, status, session_id').eq('user_id', U.id).order('created_at', { ascending: false }).limit(1)
    expect(data![0]).toMatchObject({ plan: 'PLUS', status: 'pending' })
    expect(data![0].session_id).toMatch(/^cks_/)
    expect(await planOf(U)).toBe('FREE') // checkout alone grants nothing
  })

  it('handles provider failure without granting anything', async () => {
    dodoMode = 'error'
    expect((await post(U.accessToken, { plan: 'PRO', partyId: PU })).status).toBe(502)
    expect(await planOf(U)).toBe('FREE')
  })

  it('refuses to start live charging without the explicit switch', async () => {
    process.env.DODO_PAYMENTS_ENVIRONMENT = 'live_mode'
    try {
      expect((await post(U.accessToken, { plan: 'PLUS', partyId: PU })).status).toBe(503)
    } finally {
      process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode'
    }
  })

  it('never reuses a sandbox customer id in live mode (separate Dodo accounts)', async () => {
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: 499 })) // sandbox webhook binds cus_U → U
    await post(U.accessToken, { plan: 'PLUS', partyId: PU })
    expect((created.at(-1) as { customer: { customer_id?: string } }).customer.customer_id).toBe(`cus_${U.id.slice(0, 8)}`)
    Object.assign(process.env, { DODO_PAYMENTS_ENVIRONMENT: 'live_mode', DODO_LIVE_PAYMENTS_ENABLED: 'true' })
    try {
      expect((await post(U.accessToken, { plan: 'PLUS', partyId: PU })).status).toBe(200)
      const sent = created.at(-1) as { customer: { customer_id?: string; email?: string } }
      expect(sent.customer.customer_id).toBeUndefined()
      expect(sent.customer.email).toBe(U.email)
      // The first live payment replaces the sandbox mapping.
      await send(payment(U, { customer: { customer_id: 'cus_live_u', email: U.email } }))
      const { data } = await adminClient().from('billing_customers').select('provider, provider_customer_id').eq('user_id', U.id).single()
      expect(data).toEqual({ provider: 'dodo_live', provider_customer_id: 'cus_live_u' })
    } finally {
      process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode'
      delete process.env.DODO_LIVE_PAYMENTS_ENABLED
    }
  })
})

describe('webhook → entitlement', () => {
  it('a verified successful payment grants the plan', async () => {
    const res = await send(payment(U))
    expect(res.status).toBe(200)
    expect((await res.json()).outcome).toBe('processed')
    expect(await planOf(U)).toBe('PLUS')
    const s = await (await status.GET(new Request('http://app.test/api/billing/status', { headers: { Authorization: `Bearer ${U.accessToken}` } }))).json()
    expect(s.plan).toBe('PLUS')
    expect(s.purchases[0]).toMatchObject({ plan: 'PLUS', status: 'active', kind: 'payment' })
  })

  it('a duplicate delivery is processed once (idempotent on webhook-id)', async () => {
    const event = payment(U)
    const id = `msg_dup_${Date.now()}`
    expect((await (await send(event, { id })).json()).outcome).toBe('processed')
    expect((await (await send(event, { id })).json()).outcome).toBe('duplicate')
    const { count } = await adminClient().from('billing_purchases').select('id', { count: 'exact', head: true }).eq('user_id', U.id)
    expect(count).toBe(1)
  })

  it('the same payment under a new webhook-id does not create a second purchase', async () => {
    const event = payment(U)
    await send(event)
    await send(event)
    const { count } = await adminClient().from('billing_purchases').select('id', { count: 'exact', head: true }).eq('user_id', U.id)
    expect(count).toBe(1)
  })

  it('invalid, tampered or stale signatures are rejected and change nothing', async () => {
    const event = payment(U, { product_cart: [{ product_id: PRODUCTS.PRO, quantity: 1 }], total_amount: 2999 })
    expect((await send(event, { secret: 'whsec_' + Buffer.from('wrong').toString('base64') })).status).toBe(401)
    expect((await send(event, { ts: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(401)
    const raw = JSON.stringify(event)
    const id = 'msg_tamper'
    const ts = Math.floor(Date.now() / 1000)
    const sig = signWebhook(WEBHOOK_SECRET, id, ts, raw)
    const tampered = await webhook.POST(new Request('http://app.test/api/webhooks/dodo', { method: 'POST', headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sig }, body: raw.replace(PRODUCTS.PRO, PRODUCTS.PLUS) }))
    expect(tampered.status).toBe(401)
    expect(await planOf(U)).toBe('FREE')
  })

  it('failed payments never grant', async () => {
    await send(payment(U, {}, 'payment.failed'))
    expect(await planOf(U)).toBe('FREE')
  })

  it('cancelled payments are recorded as cancelled and never grant', async () => {
    const ev = payment(U, {}, 'payment.cancelled')
    await send(ev)
    expect(await planOf(U)).toBe('FREE')
    const { data } = await adminClient().from('billing_purchases').select('status').eq('provider_ref', ev.data.payment_id as string).maybeSingle()
    expect(data?.status).toBe('cancelled')
  })

  it('tampered plan in metadata cannot upgrade beyond the paid product', async () => {
    await send(payment(U, { metadata: { mbp_user_id: U.id, mbp_plan: 'PRO' } }))
    expect(await planOf(U)).toBe('PLUS')
  })

  it('tampered/low price is held for review instead of granting', async () => {
    const res = await send(payment(U, { product_cart: [{ product_id: PRODUCTS.PRO, quantity: 1 }], total_amount: 100 }))
    expect((await res.json()).outcome).toBe('processed')
    expect(await planOf(U)).toBe('FREE')
    const { data } = await adminClient().from('billing_purchases').select('status').eq('user_id', U.id).single()
    expect(data!.status).toBe('review')
  })

  it('unknown customer is recorded as unmatched and grants nothing', async () => {
    const ghost = payment(U, { customer: { customer_id: 'cus_ghost', email: 'nobody@example.test' }, metadata: {} })
    const res = await send(ghost)
    expect((await res.json()).outcome).toBe('unmatched')
    expect(await planOf(U)).toBe('FREE')
  })

  it('metadata pointing at another user cannot hijack an existing customer', async () => {
    await send(payment(U)) // binds cus_U → U
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.PRO, quantity: 1 }], total_amount: 2999, metadata: { mbp_user_id: V.id } }))
    expect(await planOf(V)).toBe('FREE')
    expect(await planOf(U)).toBe('PRO')
  })

  it('matches by checkout email when metadata is absent — and the plan goes to that checkout’s party', async () => {
    await post(V.accessToken, { plan: 'STARTER', partyId: PV })
    const ev = payment(V, { metadata: {}, customer: { customer_id: 'cus_v_new', email: V.email }, product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: 999 })
    expect((await (await send(ev)).json()).outcome).toBe('processed')
    expect(await planOf(V)).toBe('FREE') // the account itself is not upgraded…
    expect(await partyStatus(V, PV)).toMatchObject({ plan: 'STARTER', source: 'purchase' }) // …the party is
  })

  it('refund revokes the plan', async () => {
    const ev = payment(U)
    await send(ev)
    expect(await planOf(U)).toBe('PLUS')
    await send({ type: 'refund.succeeded', timestamp: new Date().toISOString(), data: { payload_type: 'Refund', payment_id: ev.data.payment_id } })
    expect(await planOf(U)).toBe('FREE')
  })

  it('subscription create → update → cancel, with no duplicates and stale events ignored', async () => {
    const sub = (type: string, t: string, extra: Record<string, unknown> = {}) => ({
      type,
      timestamp: t,
      data: { payload_type: 'Subscription', subscription_id: `sub_${U.id.slice(0, 6)}`, product_id: PRODUCTS.PRO, customer: { customer_id: `cus_${U.id.slice(0, 8)}`, email: U.email }, metadata: { mbp_user_id: U.id }, next_billing_date: new Date(Date.now() + 30 * 86_400_000).toISOString(), ...extra },
    })
    const t0 = new Date(Date.now() - 3000).toISOString()
    const t1 = new Date(Date.now() - 2000).toISOString()
    const t2 = new Date(Date.now() - 1000).toISOString()
    await send(sub('subscription.active', t0))
    expect(await planOf(U)).toBe('PRO')
    await send(sub('subscription.updated', t1, { status: 'active' }))
    await send(sub('subscription.cancelled', t2))
    expect(await planOf(U)).toBe('FREE')
    // an older "active" retry arriving late must not resurrect the subscription
    await send(sub('subscription.renewed', t1))
    expect(await planOf(U)).toBe('FREE')
    const { count } = await adminClient().from('billing_purchases').select('id', { count: 'exact', head: true }).eq('user_id', U.id)
    expect(count).toBe(1)
  })

  it('malformed payloads and unsigned requests', async () => {
    const res = await webhook.POST(new Request('http://app.test/api/webhooks/dodo', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    expect((await (await send({ nope: true })).json()).outcome).toBe('ignored')
  })
})

describe('clients cannot touch billing data', () => {
  it('cannot insert purchases, customers or events, nor read others’ purchases', async () => {
    expect((await U.client.from('billing_purchases').insert({ user_id: U.id, provider_ref: 'x', kind: 'payment', plan: 'PRO', status: 'active' })).error).not.toBeNull()
    expect((await U.client.from('billing_customers').insert({ user_id: U.id, provider_customer_id: 'cus_x' })).error).not.toBeNull()
    expect((await U.client.from('billing_webhook_events').select('event_id')).data ?? []).toEqual([])
    expect((await U.client.rpc('recompute_entitlement' as never, { p_user: U.id } as never)).error).not.toBeNull()
    await send(payment(V, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: 999 }))
    expect((await U.client.from('billing_purchases').select('id').eq('user_id', V.id)).data).toEqual([])
    expect((await U.client.from('billing_purchases').update({ status: 'active' }).eq('user_id', U.id).select('id')).data ?? []).toEqual([])
  })
})

describe('trial expiry (server-side)', () => {
  it('a lapsed 24 h trial is expired by /api/billing/status, without any client write', async () => {
    const T = await createTestUser('bill-trial')
    try {
      await adminClient().from('users').update({ current_plan: 'PRO', is_trial_active: true, trial_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', T.id)
      const res = await status.GET(new Request('http://app.test/api/billing/status', { headers: { Authorization: `Bearer ${T.accessToken}` } }))
      expect(await res.json()).toMatchObject({ plan: 'FREE', trialActive: false })
      const { data } = await adminClient().from('users').select('current_plan, is_trial_active').eq('id', T.id).single()
      expect(data).toEqual({ current_plan: 'FREE', is_trial_active: false })
    } finally {
      await deleteTestUser(T)
    }
  })

  it('an active trial is left alone', async () => {
    const T = await createTestUser('bill-trial-ok')
    try {
      const res = await status.GET(new Request('http://app.test/api/billing/status', { headers: { Authorization: `Bearer ${T.accessToken}` } }))
      expect(await res.json()).toMatchObject({ plan: 'PRO', trialActive: true })
    } finally {
      await deleteTestUser(T)
    }
  })
})

// Launch audit P0: every sign-up gets a 24 h PRO trial; trial users must still be able to buy a plan, and a
// purchase must win over the trial (override → purchase → trial → free).
describe('trial users can buy (sign-up trial never blocks a purchase)', () => {

  it('a brand-new user is on the 24 h trial, can start checkout for every plan, and the server picks the product', async () => {
    const T = await createTestUser('bill-trial-buy')
    try {
      const TP = await newParty(T)
      expect(await statusOf(T)).toMatchObject({ plan: 'PRO', source: 'trial', trialActive: true })
      for (const [plan, product] of Object.entries(PRODUCTS)) {
        const res = await post(T.accessToken, { plan: plan.toLowerCase(), partyId: TP })
        expect(res.status, plan).toBe(200)
        expect((created.at(-1) as { product_cart: { product_id: string }[] }).product_cart).toEqual([{ product_id: product, quantity: 1 }])
      }
      // the client still cannot pick product/price or claim a plan
      expect((await post(T.accessToken, { plan: 'STARTER', partyId: TP, productId: PRODUCTS.PRO, price: 1 })).status).toBe(400)
      expect((await T.client.from('users').update({ current_plan: 'PRO', is_trial_active: true, trial_expires_at: '2099-01-01T00:00:00Z' }).eq('id', T.id)).error).not.toBeNull()
    } finally {
      await deleteTestUser(T)
    }
  })

  it('a verified purchase during the trial becomes that party’s plan, survives new sessions and the trial ending', async () => {
    const T = await createTestUser('bill-trial-paid')
    try {
      const TP = await newParty(T)
      await post(T.accessToken, { plan: 'STARTER', partyId: TP })
      expect((await (await send(payment(T, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: 499 }))).json()).outcome).toBe('processed')
      // for that party the purchase beats the trial, and is reported as a purchase, not a trial
      expect(await partyStatus(T, TP)).toMatchObject({ plan: 'STARTER', source: 'purchase' })
      const { tierFor } = await import('@/lib/ai/capabilities')
      const { getPartyPlan } = await import('@/lib/billing/server')
      expect(tierFor(await getPartyPlan(adminClient(), T.id, TP))).toBe('STARTER')
      // the account itself stays on the trial (plans are per party)
      expect(await statusOf(T)).toMatchObject({ source: 'trial' })
      // trial runs out: the party's paid plan stays
      await adminClient().from('users').update({ trial_expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', T.id)
      expect(await partyStatus(T, TP)).toMatchObject({ plan: 'STARTER', source: 'purchase', trialActive: false })
      // a refund ends the paid plan; with the trial over the party falls back to FREE
      await send({ business_id: 'bus_test', type: 'refund.succeeded', timestamp: new Date().toISOString(), data: { payment_id: (await adminClient().from('billing_purchases').select('provider_ref').eq('user_id', T.id).single()).data!.provider_ref } })
      expect(await partyStatus(T, TP)).toMatchObject({ plan: 'FREE', source: 'free' })
    } finally {
      await deleteTestUser(T)
    }
  })

  it('a trial that ends without a purchase falls back to FREE; existing Free and paid users are unchanged', async () => {
    const T = await createTestUser('bill-trial-lapse')
    try {
      await adminClient().from('users').update({ trial_expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', T.id)
      expect(await statusOf(T)).toMatchObject({ plan: 'FREE', source: 'free', trialActive: false })
      expect((await post(T.accessToken, { plan: 'PLUS', partyId: await newParty(T) })).status).toBe(200) // Free users can buy
      await send(payment(T, { product_cart: [{ product_id: PRODUCTS.PRO, quantity: 1 }], total_amount: 1499 }))
      expect(await statusOf(T)).toMatchObject({ plan: 'PRO', source: 'purchase' })
    } finally {
      await deleteTestUser(T)
    }
  })
})

// Plans are bought PER PARTY: a purchase unlocks its plan for the party it was bought for, and nothing else.
const caps = await import('@/app/api/ai/capabilities/route')
describe('per-party plans', () => {
  const tierOf = async (u: TestUser, partyId: string) => (await (await caps.GET(new Request(`http://app.test/api/ai/capabilities?partyId=${partyId}`, { headers: { Authorization: `Bearer ${u.accessToken}` } }))).json()).tier
  const buy = async (u: TestUser, partyId: string, plan: 'STARTER' | 'PLUS' | 'PRO', amount: number) => {
    expect((await post(u.accessToken, { plan, partyId })).status).toBe(200)
    const meta = (created.at(-1) as { metadata: Record<string, string> }).metadata
    expect(meta).toMatchObject({ mbp_party_id: partyId })
    const ev = payment(u, { product_cart: [{ product_id: PRODUCTS[plan], quantity: 1 }], total_amount: amount, metadata: { mbp_user_id: u.id, mbp_checkout_id: meta.mbp_checkout_id } })
    expect((await (await send(ev)).json()).outcome).toBe('processed')
    return { ev, checkoutId: meta.mbp_checkout_id }
  }

  it('unlocks the plan for that party only — status, AI tier, guests/invitations RLS; the account stays Free', async () => {
    await buy(U, PU, 'PLUS', 999)
    const { data: row } = await adminClient().from('billing_purchases').select('party_id, scope, plan, status').eq('user_id', U.id).single()
    expect(row).toEqual({ party_id: PU, scope: 'party', plan: 'PLUS', status: 'active' })
    expect(await planOf(U)).toBe('FREE')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS', source: 'purchase', partyId: PU })
    expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'FREE', source: 'free', partyId: PU2 })
    expect(await statusOf(U)).toMatchObject({ plan: 'FREE', source: 'free', partyId: null })
    expect(await tierOf(U, PU)).toBe('PLUS')
    expect(await tierOf(U, PU2)).toBe('FREE')
    expect((await U.client.rpc('has_paid_access', { p_party: PU })).data).toBe(true)
    expect((await U.client.rpc('has_paid_access', { p_party: PU2 })).data).toBe(false)
    expect((await U.client.rpc('has_paid_access', { p_party: PV })).data).toBe(false) // someone else's party
    expect((await U.client.rpc('has_paid_access')).data).toBe(false) // account level: nothing
    expect((await U.client.from('guests').insert({ party_id: PU, user_id: U.id, name: 'Paid party guest' })).error).toBeNull()
    expect((await U.client.from('guests').insert({ party_id: PU2, user_id: U.id, name: 'Free party guest' })).error).not.toBeNull()
    await adminClient().from('guests').delete().eq('party_id', PU)
  })

  it('the checkout-success status reports that checkout and its party', async () => {
    const { checkoutId } = await buy(U, PU, 'STARTER', 499)
    const s = await (await status.GET(new Request(`http://app.test/api/billing/status?checkout=${checkoutId}`, { headers: { Authorization: `Bearer ${U.accessToken}` } }))).json()
    expect(s.checkout).toEqual({ plan: 'STARTER', status: 'completed', partyId: PU, childName: 'Ava' })
    // another user cannot read it
    const sv = await (await status.GET(new Request(`http://app.test/api/billing/status?checkout=${checkoutId}`, { headers: { Authorization: `Bearer ${V.accessToken}` } }))).json()
    expect(sv.checkout).toBeNull()
    expect((await partyStatus(V, PU)).partyId).toBeNull() // and gets no plan for a party that isn't theirs
  })

  it('a party cannot buy a plan it already has; a higher plan is an upgrade for that party; other parties can buy', async () => {
    await buy(U, PU, 'STARTER', 499)
    const again = await post(U.accessToken, { plan: 'STARTER', partyId: PU })
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('already_owned')
    await buy(U, PU, 'PRO', 1499)
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PRO' })
    expect((await post(U.accessToken, { plan: 'PLUS', partyId: PU })).status).toBe(409) // below what it has
    expect((await post(U.accessToken, { plan: 'STARTER', partyId: PU2 })).status).toBe(200) // a different party
  })

  it('a refund ends that party’s plan; deleting the party ends it too (and never moves it to another party)', async () => {
    const { ev } = await buy(U, PU, 'PLUS', 999)
    await send({ type: 'refund.succeeded', timestamp: new Date().toISOString(), data: { payload_type: 'Refund', payment_id: ev.data.payment_id } })
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'FREE' })
    const P3 = await newParty(U, 'Cleo')
    await buy(U, P3, 'PLUS', 999)
    expect(await partyStatus(U, P3)).toMatchObject({ plan: 'PLUS' })
    await U.client.from('parties').delete().eq('id', P3)
    const { data: rows } = await adminClient().from('billing_purchases').select('party_id, scope, status').eq('user_id', U.id).eq('status', 'active')
    expect(rows).toEqual([{ party_id: null, scope: 'party', status: 'active' }]) // the payment record stays for accounting
    expect(await planOf(U)).toBe('FREE')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'FREE' })
    expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'FREE' })
  })

  it('a webhook cannot attach a purchase to another user’s checkout or party', async () => {
    await post(V.accessToken, { plan: 'PLUS', partyId: PV })
    const vCheckout = (created.at(-1) as { metadata: Record<string, string> }).metadata.mbp_checkout_id
    const res = await send(payment(U, { metadata: { mbp_user_id: U.id, mbp_checkout_id: vCheckout, mbp_party_id: PV } }))
    expect((await res.json()).outcome).toBe('unmatched') // inconsistent metadata: nothing is granted to anyone
    expect((await adminClient().from('billing_purchases').select('id').eq('user_id', U.id)).data).toEqual([])
    // a known customer with a foreign party in the metadata: the purchase is never attached to that party
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: 499 })) // binds cus_U → U
    await send(payment(U, { metadata: { mbp_user_id: U.id, mbp_party_id: PV } }))
    const { data: rows } = await adminClient().from('billing_purchases').select('party_id').eq('user_id', U.id)
    expect(rows!.every((r) => r.party_id !== PV)).toBe(true)
    expect(await partyStatus(V, PV)).toMatchObject({ plan: 'FREE' })
  })

  it('an admin override still applies to every party of the account', async () => {
    await adminClient().from('plan_overrides').insert({ user_id: U.id, plan: 'PLUS', expires_at: null })
    try {
      await adminClient().rpc('recompute_entitlement', { p_user: U.id })
      expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS', source: 'admin_override' })
      expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'PLUS', source: 'admin_override' })
      expect((await U.client.rpc('has_paid_access', { p_party: PU2 })).data).toBe(true)
    } finally {
      await adminClient().from('plan_overrides').delete().eq('user_id', U.id)
      await adminClient().rpc('recompute_entitlement', { p_user: U.id })
    }
  })
})
