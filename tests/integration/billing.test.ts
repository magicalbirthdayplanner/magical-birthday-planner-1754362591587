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
let seq = 0

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

const planOf = async (u: TestUser) => (await adminClient().from('users').select('current_plan').eq('id', u.id).single()).data!.current_plan

async function resetToFree(u: TestUser) {
  await adminClient().from('billing_purchases').delete().eq('user_id', u.id)
  await adminClient().from('billing_customers').delete().eq('user_id', u.id)
  await adminClient().from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', u.id)
  await adminClient().rpc('recompute_entitlement', { p_user: u.id })
}

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  ;[U, V] = await Promise.all([createTestUser('bill-u'), createTestUser('bill-v')])
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
  it('requires sign-in and a valid plan; client cannot pick product, price or user', async () => {
    expect((await post(null, { plan: 'PLUS' })).status).toBe(401)
    expect((await post(U.accessToken, { plan: 'PROFESSIONAL' })).status).toBe(400)
    expect((await post(U.accessToken, { plan: 'PLUS', product_id: 'pdt_cheap', price: 1, userId: V.id })).status).toBe(400)
  })

  it('creates a server-controlled Dodo checkout and records it', async () => {
    const res = await post(U.accessToken, { plan: 'PLUS' })
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
    expect((await post(U.accessToken, { plan: 'PRO' })).status).toBe(502)
    expect(await planOf(U)).toBe('FREE')
  })

  it('refuses to start live charging without the explicit switch', async () => {
    process.env.DODO_PAYMENTS_ENVIRONMENT = 'live_mode'
    try {
      expect((await post(U.accessToken, { plan: 'PLUS' })).status).toBe(503)
    } finally {
      process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode'
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

  it('matches by checkout email when metadata is absent', async () => {
    await post(V.accessToken, { plan: 'STARTER' })
    const ev = payment(V, { metadata: {}, customer: { customer_id: 'cus_v_new', email: V.email }, product_cart: [{ product_id: PRODUCTS.STARTER, quantity: 1 }], total_amount: 999 })
    expect((await (await send(ev)).json()).outcome).toBe('processed')
    expect(await planOf(V)).toBe('STARTER')
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
