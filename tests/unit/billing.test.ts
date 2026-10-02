import { describe, expect, it } from 'vitest'
import { signWebhook, verifyWebhook } from '@/lib/billing/webhook-signature'
import { decide, parseEvent, type DodoEvent } from '@/lib/billing/events'
import { dodoApiBase, liveChargingAllowed, planForProduct, productIdFor } from '@/lib/billing/plans'

const SECRET = 'whsec_' + Buffer.from('test-signing-key-0123456789abcdef').toString('base64')
const env = { DODO_PRODUCT_STARTER: 'pdt_starterTEST1', DODO_PRODUCT_PLUS: 'pdt_plusTEST22', DODO_PRODUCT_PRO: 'pdt_proTEST333' }
const now = 1_790_000_000

describe('Standard Webhooks signature', () => {
  const body = JSON.stringify({ type: 'payment.succeeded', data: {} })
  const h = (sig: string, ts = String(now), id = 'msg_1') => ({ id, timestamp: ts, signature: sig })

  it('accepts a correct signature', () => {
    expect(verifyWebhook(SECRET, h(signWebhook(SECRET, 'msg_1', now, body)), body, { nowSeconds: now })).toEqual({ ok: true })
  })
  it('accepts when any of several space-separated signatures matches (key rotation)', () => {
    const sig = `v1,AAAA ${signWebhook(SECRET, 'msg_1', now, body)}`
    expect(verifyWebhook(SECRET, h(sig), body, { nowSeconds: now }).ok).toBe(true)
  })
  it('rejects a tampered body, wrong secret, wrong id, missing headers', () => {
    const sig = signWebhook(SECRET, 'msg_1', now, body)
    expect(verifyWebhook(SECRET, h(sig), body.replace('succeeded', 'failed'), { nowSeconds: now })).toEqual({ ok: false, reason: 'bad_signature' })
    expect(verifyWebhook('whsec_' + Buffer.from('other').toString('base64'), h(sig), body, { nowSeconds: now }).ok).toBe(false)
    expect(verifyWebhook(SECRET, h(sig, String(now), 'msg_2'), body, { nowSeconds: now }).ok).toBe(false)
    expect(verifyWebhook(SECRET, { id: null, timestamp: null, signature: null }, body)).toEqual({ ok: false, reason: 'missing_headers' })
    expect(verifyWebhook(undefined, h(sig), body)).toEqual({ ok: false, reason: 'no_secret' })
  })
  it('rejects replays outside the 5 minute window and malformed timestamps', () => {
    const old = String(now - 301)
    expect(verifyWebhook(SECRET, h(signWebhook(SECRET, 'msg_1', old, body), old), body, { nowSeconds: now })).toEqual({ ok: false, reason: 'stale_timestamp' })
    expect(verifyWebhook(SECRET, h('v1,x', 'abc'), body, { nowSeconds: now })).toEqual({ ok: false, reason: 'bad_timestamp' })
    expect(verifyWebhook(SECRET, h('v2,' + signWebhook(SECRET, 'msg_1', now, body).slice(3)), body, { nowSeconds: now }).ok).toBe(false)
  })
})

describe('plan catalogue', () => {
  it('maps products to plans only from server config', () => {
    expect(productIdFor('PLUS', env)).toBe('pdt_plusTEST22')
    expect(planForProduct('pdt_proTEST333', env)).toBe('PRO')
    expect(planForProduct('pdt_attacker99', env)).toBeNull()
    expect(productIdFor('PLUS', { DODO_PRODUCT_PLUS: 'https://evil' })).toBeNull()
  })
  it('never charges live without both switches', () => {
    expect(liveChargingAllowed({})).toBe(false)
    expect(liveChargingAllowed({ DODO_PAYMENTS_ENVIRONMENT: 'live_mode' })).toBe(false)
    expect(liveChargingAllowed({ DODO_PAYMENTS_ENVIRONMENT: 'live_mode', DODO_LIVE_PAYMENTS_ENABLED: 'true' })).toBe(true)
    expect(dodoApiBase({})).toBe('https://test.dodopayments.com')
    expect(dodoApiBase({ DODO_PAYMENTS_ENVIRONMENT: 'live_mode' })).toBe('https://live.dodopayments.com')
  })
})

const pay = (type: string, data: Partial<DodoEvent['data']> = {}): DodoEvent => ({
  type,
  timestamp: '2026-10-01T12:00:00Z',
  data: { payload_type: 'Payment', payment_id: 'pay_1', total_amount: 1999, currency: 'USD', product_cart: [{ product_id: 'pdt_plusTEST22', quantity: 1 }], customer: { customer_id: 'cus_1', email: 'a@b.c' }, ...data },
})

describe('event decisions', () => {
  it('payment.succeeded grants the plan of the PRODUCT (metadata cannot upgrade)', () => {
    const a = decide(pay('payment.succeeded', { metadata: { mbp_plan: 'PRO' } }), env)
    expect(a).toMatchObject({ kind: 'upsert', plan: 'PLUS', status: 'active', providerRef: 'pay_1' })
  })
  it('a payment below the plan price is held for review (tampered price)', () => {
    expect(decide(pay('payment.succeeded', { total_amount: 1 }), env)).toMatchObject({ status: 'review', reason: 'amount_below_price' })
    expect(decide(pay('payment.succeeded', { total_amount: 1 }), { ...env, DODO_ALLOW_DISCOUNTS: 'true' })).toMatchObject({ status: 'active' })
  })
  it('failed/cancelled/processing payments never grant', () => {
    expect(decide(pay('payment.failed'), env)).toMatchObject({ status: 'failed' })
    expect(decide(pay('payment.cancelled'), env)).toMatchObject({ status: 'cancelled' })
    expect(decide(pay('payment.processing'), env)).toMatchObject({ status: 'pending' })
  })
  it('unknown products and unrelated events are ignored', () => {
    expect(decide(pay('payment.succeeded', { product_cart: [{ product_id: 'pdt_other0001' }] }), env)).toEqual({ kind: 'ignore', reason: 'unknown_product' })
    expect(decide({ type: 'dispute.opened', data: {} }, env)).toMatchObject({ kind: 'ignore' })
    expect(decide(pay('payment.succeeded', { subscription_id: 'sub_1' }), env)).toEqual({ kind: 'ignore', reason: 'subscription_payment' })
  })
  it('subscription lifecycle', () => {
    const sub = (type: string, extra = {}): DodoEvent => ({ type, data: { payload_type: 'Subscription', subscription_id: 'sub_1', product_id: 'pdt_proTEST333', next_billing_date: '2026-11-01T00:00:00Z', ...extra } })
    expect(decide(sub('subscription.active'), env)).toMatchObject({ kind: 'upsert', plan: 'PRO', status: 'active', currentPeriodEnd: '2026-11-01T00:00:00Z' })
    expect(decide(sub('subscription.on_hold'), env)).toMatchObject({ status: 'on_hold' })
    expect(decide(sub('subscription.cancelled'), env)).toMatchObject({ status: 'cancelled' })
    expect(decide(sub('subscription.expired'), env)).toMatchObject({ status: 'expired' })
    expect(decide(sub('subscription.updated', { status: 'past_due' }), env)).toMatchObject({ status: 'on_hold' })
  })
  it('refunds and malformed payloads', () => {
    expect(decide({ type: 'refund.succeeded', data: { payment_id: 'pay_9' } }, env)).toEqual({ kind: 'refund', providerRef: 'pay_9' })
    expect(parseEvent(null)).toBeNull()
    expect(parseEvent({ type: 1 })).toBeNull()
  })
})

describe('sandbox plan catalogue and environment guard', () => {
  it('prices are $4.99 / $9.99 / $14.99 and plan names are case-insensitive', async () => {
    const { expectedPriceCents, parsePlan } = await import('@/lib/billing/plans')
    expect([expectedPriceCents('STARTER', {}), expectedPriceCents('PLUS', {}), expectedPriceCents('PRO', {})]).toEqual([499, 999, 1499])
    expect([parsePlan('starter'), parsePlan('Plus'), parsePlan(' PRO ')]).toEqual(['STARTER', 'PLUS', 'PRO'])
    expect([parsePlan('enterprise'), parsePlan('pdt_x'), parsePlan(5), parsePlan(null)]).toEqual([null, null, null, null])
  })
  it('checkouts need an EXPLICIT environment: test_mode, or live_mode + the live switch', async () => {
    const { checkoutEnvironmentAllowed } = await import('@/lib/billing/plans')
    expect(checkoutEnvironmentAllowed({ DODO_PAYMENTS_ENVIRONMENT: 'test_mode' })).toBe(true)
    expect(checkoutEnvironmentAllowed({})).toBe(false) // missing → refuse (no silent default)
    expect(checkoutEnvironmentAllowed({ DODO_PAYMENTS_ENVIRONMENT: 'test' })).toBe(false)
    expect(checkoutEnvironmentAllowed({ DODO_PAYMENTS_ENVIRONMENT: 'live_mode' })).toBe(false)
    expect(checkoutEnvironmentAllowed({ DODO_PAYMENTS_ENVIRONMENT: 'live_mode', DODO_LIVE_PAYMENTS_ENABLED: 'true' })).toBe(true)
  })
})
