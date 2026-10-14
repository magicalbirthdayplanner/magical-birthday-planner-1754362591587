/**
 * Razorpay (India) — Orders API, payment/webhook signature verification, Fetch Payment API and webhook parsing.
 * Pure helpers + a small HTTP client. Docs used (2026-10): Standard Checkout integration steps, Orders API, Fetch a
 * Payment, payment/order/refund webhooks, "Validate and test webhooks".
 *
 *   payment signature = hex(HMAC_SHA256(key_secret, `${our order_id}|${razorpay_payment_id}`))
 *   webhook signature = hex(HMAC_SHA256(webhook_secret, raw request body))   header X-Razorpay-Signature
 *   webhook idempotency: header x-razorpay-event-id (unique per event)
 *
 * The key secret and webhook secret never leave the server; only the key id goes to the browser (Checkout needs it).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

type Env = Record<string, string | undefined>

function safeEqualHex(expectedHex: string, received: string | null | undefined): boolean {
  if (!received || !/^[0-9a-f]{64}$/i.test(received.trim())) return false
  const a = Buffer.from(expectedHex, 'hex')
  const b = Buffer.from(received.trim().toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export const hmacHex = (secret: string, message: string) => createHmac('sha256', secret).update(message).digest('hex')

/** Checkout handler signature. `orderId` MUST be the order id from our own records, not the one the browser sent. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string | null | undefined, keySecret: string | undefined): boolean {
  if (!keySecret || !orderId || !paymentId) return false
  return safeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature)
}

/** Webhook signature over the RAW body (never a re-serialized JSON object). */
export function verifyWebhookSignature(rawBody: string, signature: string | null | undefined, webhookSecret: string | undefined): boolean {
  if (!webhookSecret) return false
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature)
}

export const isOrderId = (x: unknown): x is string => typeof x === 'string' && /^order_[A-Za-z0-9]{6,40}$/.test(x)
export const isPaymentId = (x: unknown): x is string => typeof x === 'string' && /^pay_[A-Za-z0-9]{6,40}$/.test(x)

// ---------------------------------------------------------------- HTTP client
export interface RazorpayOrder { id: string; amount: number; currency: string; status: string; receipt?: string | null }
export interface RazorpayPayment { id: string; order_id: string | null; amount: number; currency: string; status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed' | string; captured?: boolean; amount_refunded?: number; refund_status?: string | null; created_at?: number }

export class RazorpayError extends Error {
  constructor(public kind: 'not_configured' | 'provider_error' | 'invalid_response', message: string, public status?: number) {
    super(message)
    this.name = 'RazorpayError'
  }
}

export function razorpayApiBase(env: Env = process.env): string {
  return (env.RAZORPAY_API_BASE_URL || 'https://api.razorpay.com').replace(/\/$/, '')
}

export function createRazorpayClient(opts: { keyId?: string; keySecret?: string; baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {
  const keyId = opts.keyId ?? process.env.RAZORPAY_KEY_ID ?? ''
  const keySecret = opts.keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? ''
  const base = opts.baseUrl ?? razorpayApiBase()
  const doFetch = opts.fetchImpl ?? fetch

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    if (!keyId || !keySecret) throw new RazorpayError('not_configured', 'Razorpay keys are not set')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000)
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, {
        ...init,
        signal: controller.signal,
        cache: 'no-store',
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      })
    } catch {
      throw new RazorpayError('provider_error', 'Razorpay unreachable')
    } finally {
      clearTimeout(timer)
    }
    const json = (await res.json().catch(() => null)) as T | null
    // Never surface Razorpay's error text to users or logs verbatim (it can echo request details).
    if (!res.ok) throw new RazorpayError('provider_error', `Razorpay HTTP ${res.status}`, res.status)
    if (!json || typeof json !== 'object') throw new RazorpayError('invalid_response', 'Razorpay returned no JSON', res.status)
    return json
  }

  return {
    /** POST /v1/orders — amount in the currency's smallest unit (paise). */
    async createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
      const o = await call<RazorpayOrder>('/v1/orders', { method: 'POST', body: JSON.stringify({ amount: input.amount, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes }) })
      if (!isOrderId(o.id) || o.amount !== input.amount || o.currency !== input.currency) throw new RazorpayError('invalid_response', 'Unexpected order')
      return o
    },
    /** GET /v1/payments/:id — the trusted, server-side view of a payment. */
    async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
      if (!isPaymentId(paymentId)) throw new RazorpayError('invalid_response', 'Invalid payment id')
      const p = await call<RazorpayPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' })
      if (p.id !== paymentId || typeof p.amount !== 'number' || typeof p.currency !== 'string') throw new RazorpayError('invalid_response', 'Unexpected payment')
      return p
    },
  }
}
export type RazorpayClient = ReturnType<typeof createRazorpayClient>

// ---------------------------------------------------------------- webhook events → actions
export type RazorpayPaymentStatus = 'active' | 'pending' | 'failed'

export type RazorpayAction =
  | { kind: 'payment'; paymentId: string; orderId: string; status: RazorpayPaymentStatus; amountMinor: number; currency: string; eventAt: string }
  | { kind: 'refund'; paymentId: string; full: boolean; eventAt: string }
  | { kind: 'ignore'; reason: string }

/** Map a Razorpay payment status to ours: captured = paid; authorized = waiting for (auto) capture. */
export function paymentStatusOf(p: Pick<RazorpayPayment, 'status'>): RazorpayPaymentStatus | null {
  if (p.status === 'captured') return 'active'
  if (p.status === 'authorized' || p.status === 'created') return 'pending'
  if (p.status === 'failed') return 'failed'
  return null
}

const iso = (unix: unknown) => (typeof unix === 'number' && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : new Date().toISOString())

interface RawEvent {
  event?: string
  created_at?: number
  payload?: {
    payment?: { entity?: Partial<RazorpayPayment> }
    order?: { entity?: { id?: string; status?: string } }
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } }
  }
}

/** Pure interpretation of a verified webhook body. Unknown/irrelevant events are ignored (and acknowledged). */
export function decideRazorpayEvent(raw: unknown): RazorpayAction {
  if (!raw || typeof raw !== 'object') return { kind: 'ignore', reason: 'invalid_payload' }
  const e = raw as RawEvent
  const type = typeof e.event === 'string' ? e.event : ''
  const eventAt = iso(e.created_at)
  const pay = e.payload?.payment?.entity
  if (type === 'refund.processed') {
    const paymentId = e.payload?.refund?.entity?.payment_id ?? pay?.id
    if (!isPaymentId(paymentId)) return { kind: 'ignore', reason: 'refund_without_payment' }
    const full = pay?.refund_status === 'full' || (typeof pay?.amount === 'number' && typeof pay?.amount_refunded === 'number' && pay.amount_refunded >= pay.amount)
    return { kind: 'refund', paymentId, full, eventAt }
  }
  if (type !== 'payment.captured' && type !== 'payment.failed' && type !== 'payment.authorized' && type !== 'order.paid') return { kind: 'ignore', reason: `unhandled_${type || 'event'}` }
  if (!pay || !isPaymentId(pay.id)) return { kind: 'ignore', reason: 'missing_payment' }
  if (!isOrderId(pay.order_id)) return { kind: 'ignore', reason: 'payment_without_order' }
  if (typeof pay.amount !== 'number' || typeof pay.currency !== 'string') return { kind: 'ignore', reason: 'missing_amount' }
  const status = type === 'payment.failed' ? 'failed' : type === 'payment.authorized' ? 'pending' : paymentStatusOf({ status: pay.status ?? '' }) ?? 'pending'
  return { kind: 'payment', paymentId: pay.id, orderId: pay.order_id, status, amountMinor: pay.amount, currency: pay.currency, eventAt }
}
