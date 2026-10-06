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
/** What the Dodo products charge, in USD cents — must equal /pricing ($9.99 / $19.99 / $29.99 per party). */
const PRICE = { STARTER: 999, PLUS: 1999, PRO: 2999 } as const

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
    total_amount: PRICE.PLUS,
    currency: 'USD',
    product_cart: [{ product_id: PRODUCTS.PLUS, quantity: 1 }],
    customer: { customer_id: `cus_${user.id.slice(0, 8)}`, email: user.email, name: 'Test' },
    metadata: { mbp_user_id: user.id },
    ...over,
  },
})

/** A payment for a checkout our server really started for `partyId` (the normal path: metadata carries the checkout). */
async function linked(u: TestUser, partyId: string, plan: 'STARTER' | 'PLUS' | 'PRO' = 'PLUS', over: Record<string, unknown> = {}, type = 'payment.succeeded') {
  expect((await post(u.accessToken, { plan, partyId })).status).toBe(200)
  const meta = (created.at(-1) as { metadata: Record<string, string> }).metadata
  return payment(u, { product_cart: [{ product_id: PRODUCTS[plan], quantity: 1 }], total_amount: PRICE[plan], metadata: { mbp_user_id: u.id, mbp_checkout_id: meta.mbp_checkout_id, mbp_party_id: partyId }, ...over }, type)
}
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
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: PRICE.STARTER })) // sandbox webhook binds cus_U → U
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
  it('a verified successful payment grants the plan to the party it was bought for', async () => {
    const res = await send(await linked(U, PU))
    expect(res.status).toBe(200)
    expect((await res.json()).outcome).toBe('processed')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS', source: 'purchase' })
    const s = await statusOf(U)
    expect(s.plan).toBe('FREE') // the account itself is not upgraded
    expect(s.purchases[0]).toMatchObject({ plan: 'PLUS', status: 'active', kind: 'payment', scope: 'party', party_id: PU })
  })

  it('a duplicate delivery is processed once (idempotent on webhook-id)', async () => {
    const event = await linked(U, PU)
    const id = `msg_dup_${Date.now()}`
    expect((await (await send(event, { id })).json()).outcome).toBe('processed')
    expect((await (await send(event, { id })).json()).outcome).toBe('duplicate')
    const { count } = await adminClient().from('billing_purchases').select('id', { count: 'exact', head: true }).eq('user_id', U.id)
    expect(count).toBe(1)
  })

  it('the same payment under a new webhook-id does not create a second purchase', async () => {
    const event = await linked(U, PU)
    await send(event)
    await send(event)
    const { count } = await adminClient().from('billing_purchases').select('id', { count: 'exact', head: true }).eq('user_id', U.id)
    expect(count).toBe(1)
  })

  it('invalid, tampered or stale signatures are rejected and change nothing', async () => {
    const event = payment(U, { product_cart: [{ product_id: PRODUCTS.PRO, quantity: 1 }], total_amount: PRICE.PRO })
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
    const ev = await linked(U, PU)
    ;(ev.data.metadata as Record<string, string>).mbp_plan = 'PRO'
    await send(ev)
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS' })
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
    await send(await linked(U, PU)) // binds cus_U → U
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.PRO, quantity: 1 }], total_amount: PRICE.PRO, metadata: { mbp_user_id: V.id } }))
    expect(await planOf(V)).toBe('FREE')
    expect(await partyStatus(V, PV)).toMatchObject({ plan: 'FREE' })
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS' }) // the PRO payment had no checkout: unresolved, unlocks nothing
  })

  it('without the checkout reference the payer is found by email, but the party is NOT guessed from a recent checkout', async () => {
    await post(V.accessToken, { plan: 'STARTER', partyId: PV })
    const ev = payment(V, { metadata: {}, customer: { customer_id: 'cus_v_new', email: V.email }, product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: PRICE.STARTER })
    expect((await (await send(ev)).json()).outcome).toBe('unmatched')
    expect(await planOf(V)).toBe('FREE')
    expect(await partyStatus(V, PV)).toMatchObject({ plan: 'FREE' })
    const { data } = await adminClient().from('billing_purchases').select('scope, party_id, unresolved_reason, status').eq('user_id', V.id).single()
    expect(data).toEqual({ scope: 'party', party_id: null, unresolved_reason: 'no_checkout', status: 'active' }) // recorded for reconciliation
  })

  it('refund revokes the plan', async () => {
    const ev = await linked(U, PU)
    await send(ev)
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS' })
    await send({ type: 'refund.succeeded', timestamp: new Date().toISOString(), data: { payload_type: 'Refund', payment_id: ev.data.payment_id } })
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'FREE' })
  })

  it('subscription create → update → cancel, with no duplicates and stale events ignored', async () => {
    const meta = (await linked(U, PU, 'PRO')).data.metadata
    const sub = (type: string, t: string, extra: Record<string, unknown> = {}) => ({
      type,
      timestamp: t,
      data: { payload_type: 'Subscription', subscription_id: `sub_${U.id.slice(0, 6)}`, product_id: PRODUCTS.PRO, customer: { customer_id: `cus_${U.id.slice(0, 8)}`, email: U.email }, metadata: meta, next_billing_date: new Date(Date.now() + 30 * 86_400_000).toISOString(), ...extra },
    })
    const proOf = async () => (await partyStatus(U, PU)).plan
    const t0 = new Date(Date.now() - 3000).toISOString()
    const t1 = new Date(Date.now() - 2000).toISOString()
    const t2 = new Date(Date.now() - 1000).toISOString()
    await send(sub('subscription.active', t0))
    expect(await proOf()).toBe('PRO')
    await send(sub('subscription.updated', t1, { status: 'active' }))
    await send(sub('subscription.cancelled', t2))
    expect(await proOf()).toBe('FREE')
    // an older "active" retry arriving late must not resurrect the subscription
    await send(sub('subscription.renewed', t1))
    expect(await proOf()).toBe('FREE')
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
    await send(payment(V, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: PRICE.STARTER }))
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
      expect((await (await send(await linked(T, TP, 'STARTER'))).json()).outcome).toBe('processed')
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
      const TP = await newParty(T)
      await send(await linked(T, TP, 'PRO')) // Free users can buy
      expect(await partyStatus(T, TP)).toMatchObject({ plan: 'PRO', source: 'purchase' })
      expect(await statusOf(T)).toMatchObject({ plan: 'FREE', source: 'free' }) // the account stays Free
    } finally {
      await deleteTestUser(T)
    }
  })
})

// Plans are bought PER PARTY: a purchase unlocks its plan for the party it was bought for, and nothing else.
const caps = await import('@/app/api/ai/capabilities/route')
const tierOf = async (u: TestUser, partyId: string) => (await (await caps.GET(new Request(`http://app.test/api/ai/capabilities?partyId=${partyId}`, { headers: { Authorization: `Bearer ${u.accessToken}` } }))).json()).tier
describe('per-party plans', () => {
  const buy = async (u: TestUser, partyId: string, plan: 'STARTER' | 'PLUS' | 'PRO', amount: number = PRICE[plan]) => {
    expect((await post(u.accessToken, { plan, partyId })).status).toBe(200)
    const meta = (created.at(-1) as { metadata: Record<string, string> }).metadata
    expect(meta).toMatchObject({ mbp_party_id: partyId })
    const ev = payment(u, { product_cart: [{ product_id: PRODUCTS[plan], quantity: 1 }], total_amount: amount, metadata: { mbp_user_id: u.id, mbp_checkout_id: meta.mbp_checkout_id } })
    expect((await (await send(ev)).json()).outcome).toBe('processed')
    return { ev, checkoutId: meta.mbp_checkout_id }
  }

  it('unlocks the plan for that party only — status, AI tier, guests/invitations RLS; the account stays Free', async () => {
    await buy(U, PU, 'PLUS')
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
    const { checkoutId } = await buy(U, PU, 'STARTER')
    const s = await (await status.GET(new Request(`http://app.test/api/billing/status?checkout=${checkoutId}`, { headers: { Authorization: `Bearer ${U.accessToken}` } }))).json()
    expect(s.checkout).toEqual({ plan: 'STARTER', status: 'completed', partyId: PU, childName: 'Ava' })
    // another user cannot read it
    const sv = await (await status.GET(new Request(`http://app.test/api/billing/status?checkout=${checkoutId}`, { headers: { Authorization: `Bearer ${V.accessToken}` } }))).json()
    expect(sv.checkout).toBeNull()
    expect((await partyStatus(V, PU)).partyId).toBeNull() // and gets no plan for a party that isn't theirs
  })

  it('a party cannot buy a plan it already has; a higher plan is an upgrade for that party; other parties can buy', async () => {
    await buy(U, PU, 'STARTER')
    const again = await post(U.accessToken, { plan: 'STARTER', partyId: PU })
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('already_owned')
    await buy(U, PU, 'PRO')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PRO' })
    expect((await post(U.accessToken, { plan: 'PLUS', partyId: PU })).status).toBe(409) // below what it has
    expect((await post(U.accessToken, { plan: 'STARTER', partyId: PU2 })).status).toBe(200) // a different party
  })

  it('Starter → Plus → Pro is an upgrade path for one party; another party stays Free and can buy Starter on its own', async () => {
    await buy(U, PU, 'STARTER')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'STARTER', source: 'purchase' })
    expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'FREE', source: 'free' })
    await buy(U, PU, 'PLUS')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS' })
    await buy(U, PU, 'PRO')
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PRO' })
    expect(await tierOf(U, PU)).toBe('PRO')
    expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'FREE' }) // upgrades never spill over to another party
    await buy(U, PU2, 'STARTER')
    expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'STARTER', partyId: PU2 })
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PRO' })
    expect(await planOf(U)).toBe('FREE')
  })

  it('each plan checks out with its own Dodo product, and a payment at the old price ($4.99 / $9.99 / $14.99) unlocks nothing', async () => {
    const OLD = { STARTER: 499, PLUS: 999, PRO: 1499 } as const
    for (const plan of ['STARTER', 'PLUS', 'PRO'] as const) {
      expect((await post(U.accessToken, { plan, partyId: PU })).status).toBe(200)
      const sent = created.at(-1) as { product_cart: { product_id: string; quantity: number }[]; metadata: Record<string, string> }
      expect(sent.product_cart, plan).toEqual([{ product_id: PRODUCTS[plan], quantity: 1 }])
      const ev = payment(U, { product_cart: sent.product_cart, total_amount: OLD[plan], metadata: { mbp_user_id: U.id, mbp_checkout_id: sent.metadata.mbp_checkout_id } })
      expect((await (await send(ev)).json()).outcome).toBe('processed')
      const { data } = await adminClient().from('billing_purchases').select('status').eq('provider_ref', ev.data.payment_id as string).single()
      expect(data!.status, plan).toBe('review') // a product still priced at the old amount is held, never granted
      expect(await partyStatus(U, PU)).toMatchObject({ plan: 'FREE' })
    }
  })

  it('a refund ends that party’s plan; deleting the party ends it too (and never moves it to another party)', async () => {
    const { ev } = await buy(U, PU, 'PLUS')
    await send({ type: 'refund.succeeded', timestamp: new Date().toISOString(), data: { payload_type: 'Refund', payment_id: ev.data.payment_id } })
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'FREE' })
    const P3 = await newParty(U, 'Cleo')
    await buy(U, P3, 'PLUS')
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
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: PRICE.STARTER })) // binds cus_U → U
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

// Invariant: every normal paid entitlement belongs to exactly ONE party. A payment that cannot be verifiably tied to a
// party unlocks NOTHING (no account-wide fallback) and is flagged for reconciliation.
const stats = await import('@/app/api/admin/stats/route')
describe('unresolved payments never become account-wide', () => {
  const unlockedAnywhere = async (u: TestUser, parties: string[]) => {
    const plans = await Promise.all(parties.map(async (p) => (await partyStatus(u, p)).plan))
    return { account: await planOf(u), parties: plans, rpc: (await u.client.rpc('has_paid_access')).data, partyRpc: await Promise.all(parties.map(async (p) => (await u.client.rpc('has_paid_access', { p_party: p })).data)) }
  }
  const NOTHING = (n: number) => ({ account: 'FREE', parties: Array(n).fill('FREE'), rpc: false, partyRpc: Array(n).fill(false) })

  it('a payment with no checkout reference, for a user with several parties, unlocks no party and not the account', async () => {
    const res = await send(payment(U, { metadata: { mbp_user_id: U.id } }))
    expect((await res.json()).outcome).toBe('unmatched')
    expect(await unlockedAnywhere(U, [PU, PU2])).toEqual(NOTHING(2))
    expect(await tierOf(U, PU)).toBe('FREE')
    expect(await tierOf(U, PU2)).toBe('FREE')
    expect((await U.client.from('guests').insert({ party_id: PU, user_id: U.id, name: 'Nope' })).error).not.toBeNull()
    const { data } = await adminClient().from('billing_purchases').select('scope, party_id, unresolved_reason').eq('user_id', U.id).single()
    expect(data).toEqual({ scope: 'party', party_id: null, unresolved_reason: 'no_checkout' })
  })

  it('a checkout reference that doesn’t match (other plan, other party in metadata, unknown checkout) is unresolved, not guessed', async () => {
    expect((await post(U.accessToken, { plan: 'STARTER', partyId: PU })).status).toBe(200)
    const starterCheckout = (created.at(-1) as { metadata: Record<string, string> }).metadata.mbp_checkout_id
    // paid for PLUS against a STARTER checkout
    await send(payment(U, { metadata: { mbp_user_id: U.id, mbp_checkout_id: starterCheckout } }))
    // right checkout, but the metadata names another party
    await send(payment(U, { product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: PRICE.STARTER, metadata: { mbp_user_id: U.id, mbp_checkout_id: starterCheckout, mbp_party_id: PU2 } }))
    // a checkout id that doesn't exist
    await send(payment(U, { metadata: { mbp_user_id: U.id, mbp_checkout_id: '00000000-0000-4000-8000-000000000000' } }))
    const { data } = await adminClient().from('billing_purchases').select('party_id, unresolved_reason').eq('user_id', U.id).order('created_at')
    expect(data).toEqual([{ party_id: null, unresolved_reason: 'checkout_mismatch' }, { party_id: null, unresolved_reason: 'checkout_mismatch' }, { party_id: null, unresolved_reason: 'no_checkout' }])
    expect(await unlockedAnywhere(U, [PU, PU2])).toEqual(NOTHING(2))
  })

  it('the party deleted before the payment arrived → unresolved (the plan is not moved to another party)', async () => {
    const P3 = await newParty(U, 'Dora')
    const ev = await linked(U, P3)
    await U.client.from('parties').delete().eq('id', P3)
    expect((await (await send(ev)).json()).outcome).toBe('unmatched')
    expect(await unlockedAnywhere(U, [PU, PU2])).toEqual(NOTHING(2))
    const { data } = await adminClient().from('billing_purchases').select('unresolved_reason').eq('user_id', U.id).single()
    expect(data!.unresolved_reason).toBe('party_unavailable')
  })

  it('is surfaced for reconciliation (Sentry warning + Super Admin stats) and can be attached to ONE of the payer’s parties', async () => {
    const res = await send(payment(U, { metadata: { mbp_user_id: U.id } }))
    expect((await res.json()).outcome).toBe('unmatched')
    await adminClient().from('user_roles').insert({ user_id: V.id, role: 'super_admin' })
    try {
      const st = await (await stats.GET(new Request('http://app.test/api/admin/stats', { headers: { Authorization: `Bearer ${V.accessToken}` } }))).json()
      expect(st.unresolvedPayments).toBeGreaterThanOrEqual(1)
    } finally {
      await adminClient().from('user_roles').delete().eq('user_id', V.id)
    }
    const { data: row } = await adminClient().from('billing_purchases').select('id').eq('user_id', U.id).single()
    // never to someone else's party
    expect((await adminClient().rpc('reconcile_purchase', { p_purchase: row!.id, p_party: PV })).error).not.toBeNull()
    // clients cannot reconcile
    expect((await U.client.rpc('reconcile_purchase' as never, { p_purchase: row!.id, p_party: PU } as never)).error).not.toBeNull()
    expect((await adminClient().rpc('reconcile_purchase', { p_purchase: row!.id, p_party: PU })).error).toBeNull()
    expect(await partyStatus(U, PU)).toMatchObject({ plan: 'PLUS', source: 'purchase' })
    expect(await partyStatus(U, PU2)).toMatchObject({ plan: 'FREE' })
    expect(await planOf(U)).toBe('FREE')
    // once reconciled it cannot be moved again
    expect((await adminClient().rpc('reconcile_purchase', { p_purchase: row!.id, p_party: PU2 })).error).not.toBeNull()
  })

  it('the database refuses account-wide purchases and any change of scope or party (even with the service role)', async () => {
    const base = { user_id: U.id, provider: 'dodo', kind: 'payment', plan: 'PRO', status: 'active' }
    expect((await adminClient().from('billing_purchases').insert({ ...base, provider_ref: `acct_${Date.now()}`, scope: 'account' })).error?.message).toMatch(/party-scoped/)
    const ins = await adminClient().from('billing_purchases').insert({ ...base, provider_ref: `pty_${Date.now()}`, party_id: PU }).select('id, scope').single()
    expect(ins.data!.scope).toBe('party') // the default is party
    expect((await adminClient().from('billing_purchases').update({ scope: 'account' }).eq('id', ins.data!.id)).error?.message).toMatch(/scope cannot change/)
    expect((await adminClient().from('billing_purchases').update({ party_id: PU2 }).eq('id', ins.data!.id)).error?.message).toMatch(/cannot move/)
    expect((await adminClient().from('billing_purchases').update({ unresolved_reason: 'no_checkout', party_id: null }).eq('id', ins.data!.id)).error).toBeNull() // detaching is allowed
    expect(await planOf(U)).toBe('FREE')
  })

  it('the 24 h sign-up trial stays account-wide (every party gets guests & RSVP, no AI)', async () => {
    const T = await createTestUser('bill-trial-acct')
    try {
      const [A, B] = [await newParty(T, 'Ava'), await newParty(T, 'Ben')]
      for (const p of [A, B]) {
        expect(await partyStatus(T, p)).toMatchObject({ source: 'trial', trialActive: true })
        expect((await T.client.rpc('has_paid_access', { p_party: p })).data).toBe(true)
        expect(await tierOf(T, p)).toBe('FREE') // AI is never part of the trial
      }
    } finally {
      await deleteTestUser(T)
    }
  })
})
