/**
 * Dodo Payments observability. Safe metadata only: event type, plan, product id, status, environment, latency.
 * Never the payload, customer, card, amounts tied to a person, API key or webhook secret.
 */
import 'server-only'
import { dodoMode, planForProduct } from '@/lib/billing/plans'
import { reportError, timing, track } from './telemetry'

const env = () => (dodoMode() === 'live_mode' ? 'live' : 'test')

const PAYMENT_EVENT: Record<string, string> = {
  'payment.processing': 'PAYMENT_PROCESSING',
  'payment.succeeded': 'PAYMENT_SUCCEEDED',
  'payment.failed': 'PAYMENT_FAILED',
  'payment.cancelled': 'PAYMENT_CANCELLED',
  'refund.succeeded': 'REFUND_SUCCEEDED',
  'refund.failed': 'REFUND_FAILED',
}

/** Pull only the event type and product id out of a (verified) payload. */
export function webhookSummary(payload: unknown): { type: string; productId?: string } {
  const p = payload as { type?: unknown; data?: { product_id?: unknown; product_cart?: { product_id?: unknown }[] | null } } | null
  const type = typeof p?.type === 'string' && /^[a-z_.]{1,64}$/.test(p.type) ? p.type : 'unknown'
  const raw = p?.data?.product_cart?.[0]?.product_id ?? p?.data?.product_id
  const productId = typeof raw === 'string' && /^pdt_[A-Za-z0-9]{6,64}$/.test(raw) ? raw : undefined
  return { type, productId }
}

export function checkoutStarted(plan: string, ms: number) {
  track('CHECKOUT_STARTED', { plan, environment: env() })
  timing('CHECKOUT_LATENCY', ms, { plan, environment: env(), success: true })
}

/** Checkout could not be created. Every case here is a system problem (validation/401/429 never reach it). */
export function checkoutFailed(plan: string, ms: number, code: string, err?: unknown) {
  track('CHECKOUT_FAILED', { plan, environment: env(), code }, undefined, 'warn')
  timing('CHECKOUT_LATENCY', ms, { plan, environment: env(), success: false })
  reportError(err instanceof Error ? err : `Dodo checkout failed: ${code}`, { area: 'billing', op: 'checkout', tags: { plan, code, environment: env() }, fingerprint: ['dodo-checkout', code] })
}

export function webhookReceived() {
  track('WEBHOOK_RECEIVED', { environment: env() })
}

export function webhookInvalidSignature(reason: string) {
  // Security signal (forged or misconfigured sender): a warning log + metric; alerting is on the metric.
  track('WEBHOOK_INVALID_SIGNATURE', { environment: env(), reason }, undefined, 'warn')
}

export function webhookNotConfigured(what: 'secret' | 'service_role') {
  reportError(`Dodo webhook not configured: ${what}`, { area: 'billing', op: 'webhook_config', level: 'fatal', fingerprint: ['dodo-webhook-config', what] })
}

export function webhookOutcome(summary: { type: string; productId?: string }, outcome: { status: string; detail?: string }, ms: number) {
  const plan = planForProduct(summary.productId) ?? undefined
  const dims = { environment: env(), event_type: summary.type, outcome: outcome.status }
  timing('dodo.webhook.latency', ms, dims)
  if (outcome.status === 'duplicate') return track('WEBHOOK_DUPLICATE', dims)
  track('WEBHOOK_PROCESSED', { ...dims, detail: outcome.detail })
  const payment = PAYMENT_EVENT[summary.type]
  if (payment) track(payment, { environment: env(), plan, product_id: summary.productId, outcome: outcome.status, detail: outcome.detail }, undefined, /failed/.test(summary.type) ? 'warn' : 'info')

  // Money moved but nobody got the plan → someone must look now.
  if (outcome.status === 'unmatched' && /^(payment\.succeeded|refund\.succeeded)$/.test(summary.type)) {
    reportError('Dodo event could not be matched to a user', { area: 'billing', op: 'webhook_processing', level: 'error', tags: { event_type: summary.type, plan, detail: outcome.detail, environment: env() }, fingerprint: ['dodo-unmatched', summary.type] })
  }
  if (outcome.detail === 'amount_below_price') {
    reportError('Dodo payment below plan price held for review', { area: 'billing', op: 'webhook_processing', level: 'warning', tags: { plan, environment: env() }, fingerprint: ['dodo-price-review'] })
  }
}

export function webhookFailed(summary: { type: string }, err: unknown, ms: number) {
  track('WEBHOOK_PROCESSING_FAILED', { environment: env(), event_type: summary.type }, undefined, 'warn')
  timing('dodo.webhook.latency', ms, { environment: env(), event_type: summary.type, outcome: 'error' })
  reportError(err instanceof Error ? sanitizedError(err) : 'Dodo webhook processing failed', { area: 'billing', op: 'webhook_processing', level: 'error', tags: { event_type: summary.type, environment: env() }, fingerprint: ['dodo-webhook-failed', summary.type] })
}

/** Supabase/Postgres errors can echo row values in `details`; keep only name, code and a scrubbed message. */
function sanitizedError(err: Error): Error {
  const e = new Error(err.message)
  e.name = err.name || 'Error'
  e.stack = err.stack
  return e
}
