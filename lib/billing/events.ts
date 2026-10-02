/**
 * Pure interpretation of Dodo webhook events → billing actions.
 * Plan is derived from the product id (server catalogue), never from metadata.
 */
import { expectedPriceCents, planForProduct, type PaidPlan } from './plans'

type Env = Record<string, string | undefined>

export interface DodoCustomer {
  customer_id?: string
  email?: string
  name?: string
}

export interface DodoEvent {
  business_id?: string
  type: string
  timestamp?: string
  data: {
    payload_type?: string
    payment_id?: string
    subscription_id?: string | null
    product_id?: string
    product_cart?: { product_id: string; quantity?: number }[] | null
    status?: string | null
    total_amount?: number
    currency?: string
    customer?: DodoCustomer
    metadata?: Record<string, string | number | boolean>
    next_billing_date?: string | null
    [k: string]: unknown
  }
}

export type PurchaseStatus = 'pending' | 'active' | 'failed' | 'cancelled' | 'refunded' | 'on_hold' | 'expired' | 'review'

export type BillingAction =
  | {
      kind: 'upsert'
      providerRef: string
      purchaseKind: 'payment' | 'subscription'
      plan: PaidPlan
      productId: string
      status: PurchaseStatus
      amountMinor: number | null
      currency: string | null
      currentPeriodEnd: string | null
      reason?: string
    }
  | { kind: 'refund'; providerRef: string }
  | { kind: 'ignore'; reason: string }

export function parseEvent(raw: unknown): DodoEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as DodoEvent
  if (typeof e.type !== 'string' || !e.data || typeof e.data !== 'object') return null
  return e
}

const SUB_STATUS: Record<string, PurchaseStatus> = {
  'subscription.active': 'active',
  'subscription.renewed': 'active',
  'subscription.updated': 'active',
  'subscription.plan_changed': 'active',
  'subscription.unpaused': 'active',
  'subscription.on_hold': 'on_hold',
  'subscription.past_due': 'on_hold',
  'subscription.paused': 'on_hold',
  'subscription.failed': 'failed',
  'subscription.cancelled': 'cancelled',
  'subscription.expired': 'expired',
}

/** Map a subscription's own status field (authoritative for `subscription.updated`). */
const FROM_DODO_STATUS: Record<string, PurchaseStatus> = {
  active: 'active',
  pending: 'pending',
  on_hold: 'on_hold',
  past_due: 'on_hold',
  paused: 'on_hold',
  failed: 'failed',
  cancelled: 'cancelled',
  expired: 'expired',
}

export function decide(e: DodoEvent, env: Env = process.env): BillingAction {
  const d = e.data
  if (e.type === 'refund.succeeded') {
    return d.payment_id ? { kind: 'refund', providerRef: d.payment_id } : { kind: 'ignore', reason: 'refund_without_payment' }
  }

  if (e.type.startsWith('subscription.')) {
    const status = e.type === 'subscription.updated' && d.status ? FROM_DODO_STATUS[d.status] : SUB_STATUS[e.type]
    if (!status) return { kind: 'ignore', reason: `unhandled_${e.type}` }
    if (!d.subscription_id) return { kind: 'ignore', reason: 'missing_subscription_id' }
    const plan = planForProduct(d.product_id, env)
    if (!plan) return { kind: 'ignore', reason: 'unknown_product' }
    return {
      kind: 'upsert',
      providerRef: d.subscription_id,
      purchaseKind: 'subscription',
      plan,
      productId: d.product_id!,
      status,
      amountMinor: null,
      currency: d.currency ?? null,
      currentPeriodEnd: d.next_billing_date ?? null,
    }
  }

  if (e.type.startsWith('payment.')) {
    // Subscription charges are governed by subscription.* events.
    if (d.subscription_id) return { kind: 'ignore', reason: 'subscription_payment' }
    if (!d.payment_id) return { kind: 'ignore', reason: 'missing_payment_id' }
    const productId = d.product_cart?.[0]?.product_id
    const plan = planForProduct(productId, env)
    if (!plan) return { kind: 'ignore', reason: 'unknown_product' }
    const status: PurchaseStatus | undefined =
      e.type === 'payment.succeeded' ? 'active' : e.type === 'payment.processing' ? 'pending' : e.type === 'payment.failed' || e.type === 'payment.cancelled' ? 'failed' : undefined
    if (!status) return { kind: 'ignore', reason: `unhandled_${e.type}` }
    const amount = typeof d.total_amount === 'number' ? d.total_amount : null
    let finalStatus: PurchaseStatus = status
    let reason: string | undefined
    // Price integrity: a USD payment below the plan price is held for review
    // (unless discounts are intentionally enabled).
    if (status === 'active' && d.currency === 'USD' && env.DODO_ALLOW_DISCOUNTS !== 'true' && (amount == null || amount < expectedPriceCents(plan, env))) {
      finalStatus = 'review'
      reason = 'amount_below_price'
    }
    return { kind: 'upsert', providerRef: d.payment_id, purchaseKind: 'payment', plan, productId: productId!, status: finalStatus, amountMinor: amount, currency: d.currency ?? null, currentPeriodEnd: null, reason }
  }

  return { kind: 'ignore', reason: `unhandled_${e.type}` }
}
