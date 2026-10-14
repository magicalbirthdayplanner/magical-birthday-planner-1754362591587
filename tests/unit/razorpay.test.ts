/**
 * Razorpay: signatures (payment + webhook), webhook event decisions, provider policy and price configuration.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decideRazorpayEvent, paymentStatusOf, verifyPaymentSignature, verifyWebhookSignature } from '@/lib/billing/razorpay'
import { providerPolicy, razorpayMode, razorpayPricePaise, razorpayStatus } from '@/lib/billing/providers'

const KEY_SECRET = 'test_key_secret_for_unit_tests'
const WH_SECRET = 'test_webhook_secret_for_unit_tests'
const sig = (secret: string, msg: string) => createHmac('sha256', secret).update(msg).digest('hex')

describe('payment signature (checkout handler)', () => {
  const order = 'order_ABCdef123456'
  const pay = 'pay_XYZabc987654'
  it('accepts HMAC_SHA256(order_id|payment_id, key_secret)', () => {
    expect(verifyPaymentSignature(order, pay, sig(KEY_SECRET, `${order}|${pay}`), KEY_SECRET)).toBe(true)
  })
  it('rejects tampering, the wrong order, the wrong secret and malformed input', () => {
    const good = sig(KEY_SECRET, `${order}|${pay}`)
    expect(verifyPaymentSignature('order_OTHER0000000', pay, good, KEY_SECRET)).toBe(false)
    expect(verifyPaymentSignature(order, 'pay_OTHER00000000', good, KEY_SECRET)).toBe(false)
    expect(verifyPaymentSignature(order, pay, sig('wrong', `${order}|${pay}`), KEY_SECRET)).toBe(false)
    expect(verifyPaymentSignature(order, pay, good.slice(0, -2) + (good.endsWith('00') ? '11' : '00'), KEY_SECRET)).toBe(false)
    expect(verifyPaymentSignature(order, pay, 'not-hex', KEY_SECRET)).toBe(false)
    expect(verifyPaymentSignature(order, pay, good, undefined)).toBe(false)
    expect(verifyPaymentSignature(order, pay, '', KEY_SECRET)).toBe(false)
  })
})

describe('webhook signature', () => {
  const raw = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1"}}}}'
  it('verifies the RAW body', () => {
    expect(verifyWebhookSignature(raw, sig(WH_SECRET, raw), WH_SECRET)).toBe(true)
  })
  it('a re-serialized body, another secret or no secret fails', () => {
    const reserialized = JSON.stringify(JSON.parse(raw), null, 1)
    expect(verifyWebhookSignature(reserialized, sig(WH_SECRET, raw), WH_SECRET)).toBe(false)
    expect(verifyWebhookSignature(raw, sig('other', raw), WH_SECRET)).toBe(false)
    expect(verifyWebhookSignature(raw, sig(WH_SECRET, raw), undefined)).toBe(false)
    expect(verifyWebhookSignature(raw, null, WH_SECRET)).toBe(false)
  })
})

describe('webhook events → actions', () => {
  const payment = (over: Record<string, unknown> = {}) => ({ id: 'pay_AAAAAAAAAAAA', order_id: 'order_BBBBBBBBBBBB', amount: 49900, currency: 'INR', status: 'captured', ...over })
  const ev = (event: string, pay: unknown, extra: Record<string, unknown> = {}) => ({ entity: 'event', event, created_at: 1_790_000_000, payload: { payment: { entity: pay }, ...extra } })

  it('payment.captured and order.paid → active with amount, currency, order and event time', () => {
    for (const type of ['payment.captured', 'order.paid']) {
      expect(decideRazorpayEvent(ev(type, payment()))).toEqual({ kind: 'payment', paymentId: 'pay_AAAAAAAAAAAA', orderId: 'order_BBBBBBBBBBBB', status: 'active', amountMinor: 49900, currency: 'INR', eventAt: new Date(1_790_000_000_000).toISOString() })
    }
  })
  it('payment.failed → failed; payment.authorized → pending (never a grant)', () => {
    expect(decideRazorpayEvent(ev('payment.failed', payment({ status: 'failed' })))).toMatchObject({ kind: 'payment', status: 'failed' })
    expect(decideRazorpayEvent(ev('payment.authorized', payment({ status: 'authorized' })))).toMatchObject({ kind: 'payment', status: 'pending' })
  })
  it('refund.processed → refund (full only when the whole amount was refunded)', () => {
    const full = ev('refund.processed', payment({ amount_refunded: 49900, refund_status: 'full' }), { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_AAAAAAAAAAAA', amount: 49900 } } })
    const partial = ev('refund.processed', payment({ amount_refunded: 100, refund_status: 'partial' }), { refund: { entity: { id: 'rfnd_2', payment_id: 'pay_AAAAAAAAAAAA', amount: 100 } } })
    expect(decideRazorpayEvent(full)).toMatchObject({ kind: 'refund', paymentId: 'pay_AAAAAAAAAAAA', full: true })
    expect(decideRazorpayEvent(partial)).toMatchObject({ kind: 'refund', full: false })
  })
  it('ignores unknown events and payments without an order or amount', () => {
    expect(decideRazorpayEvent(ev('payment.downtime.started', payment()))).toMatchObject({ kind: 'ignore' })
    expect(decideRazorpayEvent(ev('payment.captured', payment({ order_id: null })))).toEqual({ kind: 'ignore', reason: 'payment_without_order' })
    expect(decideRazorpayEvent(ev('payment.captured', payment({ amount: '499' })))).toEqual({ kind: 'ignore', reason: 'missing_amount' })
    expect(decideRazorpayEvent(ev('payment.captured', payment({ id: 'bogus' })))).toEqual({ kind: 'ignore', reason: 'missing_payment' })
    expect(decideRazorpayEvent(null)).toEqual({ kind: 'ignore', reason: 'invalid_payload' })
  })
  it('maps fetched payment statuses', () => {
    expect(paymentStatusOf({ status: 'captured' })).toBe('active')
    expect(paymentStatusOf({ status: 'authorized' })).toBe('pending')
    expect(paymentStatusOf({ status: 'failed' })).toBe('failed')
    expect(paymentStatusOf({ status: 'refunded' })).toBeNull()
  })
})

describe('provider policy (server-side, from the party country)', () => {
  const rzp = { RAZORPAY_ENABLED: 'true', RAZORPAY_KEY_ID: 'rzp_test_abcdef123456', RAZORPAY_KEY_SECRET: 's', RAZORPAY_PRICE_STARTER_PAISE: '49900', RAZORPAY_PRICE_PLUS_PAISE: '99900', RAZORPAY_PRICE_PRO_PAISE: '149900' }
  const dodo = { DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_ENVIRONMENT: 'test_mode', DODO_PRODUCT_STARTER: 'pdt_aaaaaa01', DODO_PRODUCT_PLUS: 'pdt_aaaaaa02', DODO_PRODUCT_PRO: 'pdt_aaaaaa03' }

  it('US parties stay on Dodo at the existing USD prices, whatever Razorpay says', () => {
    const p = providerPolicy('US', { ...dodo, ...rzp })
    expect(p).toMatchObject({ provider: 'dodo', currency: 'USD', available: true, prices: { STARTER: 999, PLUS: 1999, PRO: 2999 } })
    expect(providerPolicy(null, dodo).provider).toBe('dodo') // pre-India parties
  })
  it('India parties use Razorpay only — never a USD fallback — and only when switched on, keyed and priced', () => {
    expect(providerPolicy('IN', { ...dodo })).toMatchObject({ provider: 'razorpay', currency: 'INR', available: false, reason: 'disabled', prices: { STARTER: null, PLUS: null, PRO: null } })
    expect(providerPolicy('IN', { ...rzp, RAZORPAY_KEY_SECRET: '' })).toMatchObject({ available: false, reason: 'not_configured' })
    expect(providerPolicy('IN', { ...rzp, RAZORPAY_PRICE_PRO_PAISE: '' })).toMatchObject({ available: false, reason: 'prices_not_set' })
    expect(providerPolicy('IN', rzp)).toMatchObject({ provider: 'razorpay', currency: 'INR', available: true, prices: { STARTER: 49900, PLUS: 99900, PRO: 149900 } })
  })
  it('a live key needs the separate live switch', () => {
    const live = { ...rzp, RAZORPAY_KEY_ID: 'rzp_live_abcdef123456' }
    expect(razorpayStatus(live)).toEqual({ available: false, reason: 'live_disabled' })
    expect(razorpayStatus({ ...live, RAZORPAY_LIVE_PAYMENTS_ENABLED: 'true' })).toEqual({ available: true, reason: null })
    expect(razorpayMode(live)).toBe('live')
    expect(razorpayMode(rzp)).toBe('test')
    expect(razorpayMode({ RAZORPAY_KEY_ID: 'sk_test_x' })).toBeNull()
  })
  it('prices must be whole paise in a sane range — no defaults, no floats', () => {
    expect(razorpayPricePaise('STARTER', {})).toBeNull()
    expect(razorpayPricePaise('STARTER', { RAZORPAY_PRICE_STARTER_PAISE: '499.00' })).toBeNull()
    expect(razorpayPricePaise('STARTER', { RAZORPAY_PRICE_STARTER_PAISE: '99' })).toBeNull()
    expect(razorpayPricePaise('STARTER', { RAZORPAY_PRICE_STARTER_PAISE: '99999999' })).toBeNull()
    expect(razorpayPricePaise('STARTER', { RAZORPAY_PRICE_STARTER_PAISE: '49900' })).toBe(49900)
  })
})
