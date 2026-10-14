/**
 * India market against local Supabase + the mock Google/Dodo/Razorpay server:
 * country data model and RLS, public invitation projection, PIN lookup, India discovery, and Razorpay checkout →
 * verify → webhook (success, failures, tampering, duplicates, races, refunds), with the US Dodo path unchanged.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

const MOCK_PORT = 4012
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const RZP = {
  RAZORPAY_KEY_ID: 'rzp_test_itMockKey001',
  RAZORPAY_KEY_SECRET: 'integration_rzp_key_secret',
  RAZORPAY_WEBHOOK_SECRET: 'integration_rzp_webhook_secret',
  RAZORPAY_API_BASE_URL: MOCK,
  RAZORPAY_PRICE_STARTER_PAISE: '49900',
  RAZORPAY_PRICE_PLUS_PAISE: '99900',
  RAZORPAY_PRICE_PRO_PAISE: '149900',
}

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  GOOGLE_PLACES_API_KEY: 'mock-key-not-secret',
  GOOGLE_PLACES_API_BASE_URL: MOCK,
  GOOGLE_GEOCODING_API_BASE_URL: MOCK,
  DISCOVERY_MAX_QUERIES: '3',
  DODO_PAYMENTS_API_KEY: 'test_dodo_key',
  DODO_PAYMENTS_ENVIRONMENT: 'test_mode',
  DODO_API_BASE_URL: MOCK,
  DODO_PRODUCT_STARTER: 'pdt_itStarter001',
  DODO_PRODUCT_PLUS: 'pdt_itPlus000002',
  DODO_PRODUCT_PRO: 'pdt_itPro0000003',
  NEXT_PUBLIC_BASE_URL: 'https://preview.example.test',
  ...RZP,
})
delete process.env.RAZORPAY_ENABLED

const checkout = await import('@/app/api/billing/checkout/route')
const verify = await import('@/app/api/billing/razorpay/verify/route')
const rzpWebhook = await import('@/app/api/webhooks/razorpay/route')
const catalog = await import('@/app/api/billing/catalog/route')
const zipRoute = await import('@/app/api/discovery/zip/route')
const search = await import('@/app/api/discovery/search/route')
const { getPartyPlan } = await import('@/lib/billing/server')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

let mock: ChildProcess
let U: TestUser
let V: TestUser
const admin = adminClient()
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

async function party(u: TestUser, over: Record<string, unknown> = {}) {
  const { data, error } = await u.client.from('parties').insert({ user_id: u.id, child_name: 'Aarav Sharma', child_age: 7, party_date: inDays(30), zip_code: '560001', guest_count: 20, budget: 15000, country_code: 'IN', timezone: 'Asia/Kolkata', latitude: 12.9762, longitude: 77.6033, ...over }).select('id').single()
  if (error) throw error
  return data!.id as string
}
const req = (url: string, token: string | null, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
const buy = (u: TestUser, plan: string, partyId: string, extra: Record<string, unknown> = {}) => checkout.POST(req('http://app.test/api/billing/checkout', u.accessToken, { plan, partyId, ...extra }))
const confirm = (u: TestUser, body: Record<string, unknown>) => verify.POST(req('http://app.test/api/billing/razorpay/verify', u.accessToken, body))
/** The mock Razorpay "pays" an order and returns the signed Checkout handler response. */
async function pay(orderId: string, outcome = 'captured', over: Record<string, unknown> = {}) {
  const r = await fetch(`${MOCK}/__razorpay/pay`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId, outcome, webhook: false, ...over }) })
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = (await r.json()) as Record<string, string>
  return { razorpay_payment_id, razorpay_order_id, razorpay_signature }
}
function hook(event: string, payment: Record<string, unknown>, opts: { id?: string; secret?: string; createdAt?: number; extra?: Record<string, unknown> } = {}) {
  const raw = JSON.stringify({ entity: 'event', account_id: 'acc_test', event, contains: ['payment'], payload: { payment: { entity: payment }, ...(opts.extra ?? {}) }, created_at: opts.createdAt ?? Math.floor(Date.now() / 1000) })
  return rzpWebhook.POST(new Request('http://app.test/api/webhooks/razorpay', { method: 'POST', headers: { 'x-razorpay-signature': createHmac('sha256', opts.secret ?? RZP.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex'), 'x-razorpay-event-id': opts.id ?? `evt_${randomUUID().slice(0, 12)}` }, body: raw }))
}
const purchasesFor = async (partyId: string) => (await admin.from('billing_purchases').select('provider, provider_ref, provider_order_ref, status, plan, amount_minor, currency, party_id, scope').eq('party_id', partyId)).data ?? []
const partyPurchase = async (u: TestUser, partyId: string) => (await getPartyPlan(admin, u.id, partyId)).partyPurchase

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  mock = spawn(process.execPath, ['tests/mock-google/server.mjs'], { env: { ...process.env, MOCK_GOOGLE_PORT: String(MOCK_PORT) }, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${MOCK}/health`)).ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  ;[U, V] = await Promise.all([createTestUser('india-u'), createTestUser('india-v')])
})

afterAll(async () => {
  mock?.kill()
  await Promise.all([deleteTestUser(U), deleteTestUser(V)])
})

beforeEach(() => {
  resetRateLimits()
  process.env.RAZORPAY_ENABLED = 'true'
})

describe('country data model', () => {
  it('a party created the old way is a US party with floating time (existing behaviour)', async () => {
    const id = await party(U, { country_code: undefined, timezone: undefined, zip_code: '48084', latitude: 42.56, longitude: -83.18 })
    const { data } = await U.client.from('parties').select('country_code, timezone').eq('id', id).single()
    expect(data).toEqual({ country_code: 'US', timezone: null })
  })
  it('stores an India party with its address; another user cannot see it', async () => {
    const id = await party(U, { address_line1: 'Flat 4B, Rose Apartments', locality: 'Koramangala', district: 'Bengaluru Urban', city: 'Bengaluru', state: 'Karnataka' })
    const { data } = await U.client.from('parties').select('country_code, timezone, zip_code, locality, district').eq('id', id).single()
    expect(data).toEqual({ country_code: 'IN', timezone: 'Asia/Kolkata', zip_code: '560001', locality: 'Koramangala', district: 'Bengaluru Urban' })
    expect((await V.client.from('parties').select('id, address_line1').eq('id', id).maybeSingle()).data).toBeNull()
    expect((await anonClient().from('parties').select('id').eq('id', id).maybeSingle()).data).toBeNull()
    // and cannot change it
    await V.client.from('parties').update({ country_code: 'US' }).eq('id', id)
    expect((await U.client.from('parties').select('country_code').eq('id', id).single()).data?.country_code).toBe('IN')
  })
  it('rejects unsupported countries', async () => {
    const { error } = await U.client.from('parties').insert({ user_id: U.id, child_name: 'X', child_age: 5, party_date: inDays(10), country_code: 'XX' })
    expect(error?.code).toBe('23514')
  })
  it('profile country is the user’s own, separate from any party', async () => {
    expect((await U.client.from('users').update({ country_code: 'IN' }).eq('id', U.id)).error).toBeNull()
    expect((await U.client.from('users').update({ country_code: 'FR' }).eq('id', U.id)).error?.code).toBe('23514')
    await V.client.from('users').update({ country_code: 'US' }).eq('id', U.id) // RLS: no effect
    expect((await admin.from('users').select('country_code').eq('id', U.id).single()).data?.country_code).toBe('IN')
  })
  it('an Indian user can plan a US party and a US user an India party', async () => {
    const us = await party(U, { country_code: 'US', timezone: null, zip_code: '10001', latitude: 40.75, longitude: -73.99 })
    await V.client.from('users').update({ country_code: 'US' }).eq('id', V.id)
    const inParty = await party(V)
    expect((await U.client.from('parties').select('country_code').eq('id', us).single()).data?.country_code).toBe('US')
    expect((await V.client.from('parties').select('country_code').eq('id', inParty).single()).data?.country_code).toBe('IN')
  })
})

describe('public invitation projection', () => {
  it('adds the event country and timezone, and still nothing private', async () => {
    const id = await party(U, { address_line1: 'Flat 4B, Rose Apartments' })
    const token = randomUUID().replace(/-/g, '') + 'abcdef0123456789'
    await admin.from('party_invitations').insert({ party_id: id, user_id: U.id, token, start_time: '16:00', end_time: '19:00', location_text: 'Jumping Jacks, Koramangala' })
    await admin.from('guests').insert({ party_id: id, user_id: U.id, name: 'The Iyers', phone: '+919845012345', email: 'iyer@example.test' })
    const { data } = await anonClient().rpc('get_invitation', { p_token: token })
    const inv = data as Record<string, unknown>
    expect(inv).toMatchObject({ child_name: 'Aarav', country_code: 'IN', timezone: 'Asia/Kolkata', location_text: 'Jumping Jacks, Koramangala' })
    const json = JSON.stringify(inv)
    for (const secret of ['Sharma', 'Rose Apartments', '560001', '+91', 'iyer@', 'Iyers', id]) expect(json).not.toContain(secret)
  })
})

describe('PIN lookup', () => {
  const get = (q: string) => zipRoute.GET(new Request(`http://app.test/api/discovery/zip?${q}`, { headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.1` } }))
  it('resolves an Indian PIN with Google coordinates and dataset details', async () => {
    const res = await get('country=IN&zip=560%20001')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ zip: '560001', country: 'IN', lat: 12.9762, lng: 77.6033, city: 'Bengaluru', district: 'Bengaluru', approximate: false })
    expect(body.localities.length).toBeGreaterThan(1)
  })
  it('uses Places to locate a PIN when the Geocoding API has no answer (or is not enabled on the key)', async () => {
    const body = await (await get('country=IN&zip=560034')).json()
    expect(body).toMatchObject({ zip: '560034', country: 'IN', lat: 12.9261, lng: 77.6221, city: 'Bengaluru', state: 'Karnataka', approximate: false })
  })
  it('falls back to the offline dataset when Google has no answer', async () => {
    const body = await (await get('country=IN&zip=411001')).json()
    expect(body).toMatchObject({ zip: '411001', country: 'IN', state: 'Maharashtra', approximate: true })
  })
  it('useful errors: malformed PIN, unknown PIN, unsupported country', async () => {
    const bad = await get('country=IN&zip=48084')
    expect(bad.status).toBe(422)
    expect((await bad.json()).error.message).toMatch(/6-digit PIN/)
    expect((await get('country=IN&zip=999999')).status).toBe(404)
    expect((await get('country=FR&zip=75001')).status).toBe(422)
  })
  it('US ZIP lookups are unchanged', async () => {
    const body = await (await get('zip=48084')).json()
    expect(body).toMatchObject({ zip: '48084', city: 'Troy', state: 'MI', country: 'US' })
  })
})

describe('venue discovery for an India party', () => {
  it('resolves the PIN, searches with regionCode IN and local phrasing, and returns real-shaped venues', async () => {
    const id = await party(U, { zip_code: '400050', latitude: null, longitude: null, interests: [], venue_type: 'indoor' })
    await fetch(`${MOCK}/__mock/reset`)
    const res = await search.POST(req('http://app.test/api/discovery/search', U.accessToken, { partyId: id, refresh: true }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.location).toMatchObject({ zip: '400050', country: 'IN', city: 'Mumbai' })
    expect(body.total).toBeGreaterThan(0)
    const stats = await (await fetch(`${MOCK}/__mock/stats`)).json()
    expect(stats.lastRegionCode).toBe('IN')
    // the PIN's coordinates were stored on the party
    const { data } = await U.client.from('parties').select('latitude, longitude, zip_code').eq('id', id).single()
    expect(data).toMatchObject({ latitude: 19.0596, longitude: 72.8295, zip_code: '400050' })
  })
  it('US parties still search with regionCode US', async () => {
    const id = await party(U, { country_code: 'US', timezone: null, zip_code: '48084', latitude: 30 + Math.random() * 10, longitude: -100 + Math.random() * 10 })
    await fetch(`${MOCK}/__mock/reset`)
    expect((await search.POST(req('http://app.test/api/discovery/search', U.accessToken, { partyId: id }))).status).toBe(200)
    expect((await (await fetch(`${MOCK}/__mock/stats`)).json()).lastRegionCode).toBe('US')
  })
})

describe('checkout provider selection', () => {
  it('US party → Dodo hosted checkout, exactly as before', async () => {
    const id = await party(U, { country_code: 'US', timezone: null, zip_code: '48084' })
    const res = await buy(U, 'starter', id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checkoutUrl).toMatch(/__dodo\/pay\/cks_/)
    const { data } = await admin.from('billing_checkouts').select('provider, amount_minor, currency').eq('party_id', id).single()
    expect(data).toEqual({ provider: 'dodo', amount_minor: null, currency: null })
  })
  it('India party with Razorpay switched off → clear 503, nothing created, never a USD fallback', async () => {
    delete process.env.RAZORPAY_ENABLED
    const id = await party(U)
    const res = await buy(U, 'starter', id)
    expect(res.status).toBe(503)
    expect((await res.json()).error.message).toMatch(/India aren’t available yet/)
    expect((await admin.from('billing_checkouts').select('id').eq('party_id', id)).data).toEqual([])
    const cat = await (await catalog.GET(new Request('http://app.test/api/billing/catalog?country=IN'))).json()
    expect(cat).toEqual({ country: 'IN', provider: 'razorpay', currency: 'INR', available: false, prices: null })
  })
  it('India party → a Razorpay order at the server’s INR price; the response has no secret', async () => {
    const id = await party(U)
    const res = await buy(U, 'starter', id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ provider: 'razorpay', razorpay: { keyId: RZP.RAZORPAY_KEY_ID, amount: 49900, currency: 'INR' } })
    expect(body.razorpay.orderId).toMatch(/^order_/)
    const text = JSON.stringify(body)
    expect(text).not.toContain(RZP.RAZORPAY_KEY_SECRET)
    expect(text).not.toContain(RZP.RAZORPAY_WEBHOOK_SECRET)
    const { data } = await admin.from('billing_checkouts').select('provider, amount_minor, currency, session_id, plan, status').eq('id', body.checkoutId).single()
    expect(data).toEqual({ provider: 'razorpay', amount_minor: 49900, currency: 'INR', session_id: body.razorpay.orderId, plan: 'STARTER', status: 'pending' })
    const cat = await (await catalog.GET(new Request('http://app.test/api/billing/catalog?country=IN'))).json()
    expect(cat).toEqual({ country: 'IN', provider: 'razorpay', currency: 'INR', available: true, prices: { STARTER: 49900, PLUS: 99900, PRO: 149900 } })
  })
  it('a double tap reuses the open order instead of creating another', async () => {
    const id = await party(U)
    const a = await (await buy(U, 'plus', id)).json()
    const b = await (await buy(U, 'plus', id)).json()
    expect(b.razorpay.orderId).toBe(a.razorpay.orderId)
    expect((await admin.from('billing_checkouts').select('id').eq('party_id', id)).data).toHaveLength(1)
  })
  it('client-supplied price, currency or provider is rejected; someone else’s party is 404', async () => {
    const id = await party(U)
    expect((await buy(U, 'starter', id, { amount: 100 })).status).toBe(400)
    expect((await buy(U, 'starter', id, { currency: 'USD' })).status).toBe(400)
    expect((await buy(U, 'starter', id, { provider: 'dodo' })).status).toBe(400)
    expect((await buy(V, 'starter', id)).status).toBe(404)
  })
})

describe('Razorpay verify → plan for that party only', () => {
  it('rejects a bad signature, a foreign order and another user; grants only after a verified captured payment', async () => {
    const id = await party(U)
    const other = await party(U)
    const c = await (await buy(U, 'starter', id)).json()
    const r = await pay(c.razorpay.orderId)

    expect((await confirm(U, { checkoutId: c.checkoutId, ...r, razorpay_signature: 'f'.repeat(64) })).status).toBe(400)
    expect((await confirm(U, { checkoutId: c.checkoutId, ...r, razorpay_order_id: 'order_SomeoneElse01' })).status).toBe(400)
    expect((await confirm(V, { checkoutId: c.checkoutId, ...r })).status).toBe(404)
    expect(await purchasesFor(id)).toEqual([])
    expect(await partyPurchase(U, id)).toBeNull()

    const ok = await confirm(U, { checkoutId: c.checkoutId, ...r })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ status: 'active', checkoutId: c.checkoutId })
    expect(await partyPurchase(U, id)).toBe('STARTER')
    expect(await partyPurchase(U, other)).toBeNull() // per party: the other party gains nothing
    expect(await purchasesFor(id)).toEqual([{ provider: 'razorpay', provider_ref: r.razorpay_payment_id, provider_order_ref: c.razorpay.orderId, status: 'active', plan: 'STARTER', amount_minor: 49900, currency: 'INR', party_id: id, scope: 'party' }])
    expect((await admin.from('billing_checkouts').select('status, payment_ref').eq('id', c.checkoutId).single()).data).toEqual({ status: 'completed', payment_ref: r.razorpay_payment_id })

    // replayed verify + the webhook for the same payment → still exactly one purchase
    await confirm(U, { checkoutId: c.checkoutId, ...r })
    const w = await hook('payment.captured', { id: r.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 49900, currency: 'INR', status: 'captured' })
    expect(w.status).toBe(200)
    expect(await purchasesFor(id)).toHaveLength(1)

    // the same plan again → 409; an upgrade is a new order
    expect((await buy(U, 'starter', id)).status).toBe(409)
    expect((await buy(U, 'pro', id)).status).toBe(200)
  })
  it('a payment that does not match the order’s amount or currency is held for review and unlocks nothing', async () => {
    for (const over of [{ amount: 100 }, { currency: 'USD' }]) {
      const id = await party(U)
      const c = await (await buy(U, 'plus', id)).json()
      const r = await pay(c.razorpay.orderId, 'captured', over)
      const res = await confirm(U, { checkoutId: c.checkoutId, ...r })
      expect((await res.json()).status).toBe('pending')
      expect((await purchasesFor(id))[0]).toMatchObject({ status: 'review' })
      expect(await partyPurchase(U, id)).toBeNull()
    }
  })
  it('a failed payment records the failure and grants nothing; the order can still be paid', async () => {
    const id = await party(U)
    const c = await (await buy(U, 'starter', id)).json()
    const f = await pay(c.razorpay.orderId, 'failed')
    const w = await hook('payment.failed', { id: f.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 49900, currency: 'INR', status: 'failed' })
    expect((await w.json()).outcome).toBe('processed')
    expect((await purchasesFor(id))[0]).toMatchObject({ status: 'failed' })
    expect(await partyPurchase(U, id)).toBeNull()
    expect((await admin.from('billing_checkouts').select('status').eq('id', c.checkoutId).single()).data?.status).toBe('pending')
    const ok = await pay(c.razorpay.orderId)
    expect((await (await confirm(U, { checkoutId: c.checkoutId, ...ok })).json()).status).toBe('active')
    expect(await partyPurchase(U, id)).toBe('STARTER')
  })
})

describe('Razorpay webhook', () => {
  it('needs a valid signature over the raw body (401), and its secret (503)', async () => {
    const p = { id: 'pay_NoSuchPayment1', order_id: 'order_NoSuchOrder01', amount: 49900, currency: 'INR', status: 'captured' }
    expect((await hook('payment.captured', p, { secret: 'wrong' })).status).toBe(401)
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET
    delete process.env.RAZORPAY_WEBHOOK_SECRET
    expect((await hook('payment.captured', p)).status).toBe(503)
    process.env.RAZORPAY_WEBHOOK_SECRET = saved
  })
  it('grants via webhook alone (browser closed), is idempotent per event id, and ignores unknown orders', async () => {
    const id = await party(U)
    const c = await (await buy(U, 'starter', id)).json()
    const r = await pay(c.razorpay.orderId)
    const p = { id: r.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 49900, currency: 'INR', status: 'captured' }
    const first = await hook('payment.captured', p, { id: 'evt_dup_test_0001' + id.slice(0, 4) })
    expect((await first.json()).outcome).toBe('processed')
    const again = await hook('payment.captured', p, { id: 'evt_dup_test_0001' + id.slice(0, 4) })
    expect((await again.json()).outcome).toBe('duplicate')
    expect(await partyPurchase(U, id)).toBe('STARTER')
    const unknown = await hook('order.paid', { ...p, id: 'pay_UnknownOrder01', order_id: 'order_NotOurs00001' })
    expect((await unknown.json()).outcome).toBe('unmatched')
  })
  it('a late, older "authorized" event never downgrades a captured payment', async () => {
    const id = await party(U)
    const c = await (await buy(U, 'starter', id)).json()
    const r = await pay(c.razorpay.orderId)
    await confirm(U, { checkoutId: c.checkoutId, ...r })
    await hook('payment.authorized', { id: r.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 49900, currency: 'INR', status: 'authorized' }, { createdAt: Math.floor(Date.now() / 1000) - 600 })
    expect((await purchasesFor(id))[0]).toMatchObject({ status: 'active' })
  })
  it('verify and webhook racing for one payment → exactly one purchase', async () => {
    const id = await party(U)
    const c = await (await buy(U, 'starter', id)).json()
    const r = await pay(c.razorpay.orderId)
    const p = { id: r.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 49900, currency: 'INR', status: 'captured' }
    await Promise.all([confirm(U, { checkoutId: c.checkoutId, ...r }), hook('payment.captured', p), hook('order.paid', p), confirm(U, { checkoutId: c.checkoutId, ...r })])
    expect(await purchasesFor(id)).toHaveLength(1)
    expect(await partyPurchase(U, id)).toBe('STARTER')
  })
  it('a full refund ends that party’s plan; a partial refund does not', async () => {
    const id = await party(U)
    const c = await (await buy(U, 'plus', id)).json()
    const r = await pay(c.razorpay.orderId)
    await confirm(U, { checkoutId: c.checkoutId, ...r })
    const refund = (full: boolean) => hook('refund.processed', { id: r.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 99900, currency: 'INR', status: 'captured', amount_refunded: full ? 99900 : 100, refund_status: full ? 'full' : 'partial' }, { extra: { refund: { entity: { id: `rfnd_${full}`, payment_id: r.razorpay_payment_id, amount: full ? 99900 : 100 } } } })
    await refund(false)
    expect(await partyPurchase(U, id)).toBe('PLUS')
    await refund(true)
    expect(await partyPurchase(U, id)).toBeNull()
    expect((await purchasesFor(id))[0]).toMatchObject({ status: 'refunded' })
  })
  it('a party deleted before the payment arrives gets nothing; the payment waits for reconciliation', async () => {
    const id = await party(U)
    const c = await (await buy(U, 'starter', id)).json()
    await U.client.from('parties').delete().eq('id', id)
    const r = await pay(c.razorpay.orderId)
    const w = await hook('payment.captured', { id: r.razorpay_payment_id, order_id: c.razorpay.orderId, amount: 49900, currency: 'INR', status: 'captured' })
    expect((await w.json()).outcome).toBe('unmatched')
    const { data } = await admin.from('billing_purchases').select('party_id, unresolved_reason, status').eq('provider_ref', r.razorpay_payment_id).single()
    expect(data).toEqual({ party_id: null, unresolved_reason: 'party_unavailable', status: 'active' })
  })
})
