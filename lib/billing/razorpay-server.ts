/**
 * Razorpay checkout creation and payment recording. SERVER ONLY, service role.
 *
 * The order is created by OUR server for a checkout row that already pins (user, party, plan, amount, currency).
 * A payment is tied to a party only through that row: Razorpay's payment carries our order id, and the order id is
 * looked up in billing_checkouts (session_id). Nothing from the browser — plan, price, currency, party or user — is
 * trusted. Recording is idempotent per payment id (unique provider + provider_ref) and safe when the checkout's
 * verify call and the webhook arrive together or out of order.
 */
import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'
import type { PaidPlan } from './plans'
import { razorpayPriceId } from './providers'
import { createRazorpayClient, type RazorpayClient, type RazorpayPaymentStatus } from './razorpay'
import { paymentUnresolved } from '@/lib/observability/billing'

type Admin = SupabaseClient<Database>

export class RazorpayCheckoutError extends Error {
  constructor(public code: 'not_configured' | 'provider_error', message: string) {
    super(message)
  }
}

/** A pending order younger than this, for the same party/plan/price, is reused instead of creating another. */
const REUSE_MS = 30 * 60_000

export interface RazorpayCheckout {
  checkoutId: string
  orderId: string
  amount: number
  currency: 'INR'
}

export async function createRazorpayCheckout(
  admin: Admin,
  user: User,
  plan: PaidPlan,
  partyId: string,
  price: { amountMinor: number; currency: 'INR' },
  client: RazorpayClient = createRazorpayClient(),
): Promise<RazorpayCheckout> {
  // Double taps / two tabs: one open order per party + plan + price.
  const since = new Date(Date.now() - REUSE_MS).toISOString()
  const { data: open } = await admin
    .from('billing_checkouts')
    .select('id, session_id, amount_minor, currency')
    .eq('user_id', user.id)
    .eq('party_id', partyId)
    .eq('plan', plan)
    .eq('provider', 'razorpay')
    .eq('status', 'pending')
    .eq('amount_minor', price.amountMinor)
    .eq('currency', price.currency)
    .not('session_id', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (open?.[0]?.session_id) return { checkoutId: open[0].id, orderId: open[0].session_id, amount: price.amountMinor, currency: price.currency }

  const { data: checkout, error } = await admin
    .from('billing_checkouts')
    .insert({ user_id: user.id, plan, product_id: razorpayPriceId(plan), customer_email: user.email ?? null, party_id: partyId, provider: 'razorpay', amount_minor: price.amountMinor, currency: price.currency })
    .select('id')
    .single()
  if (error || !checkout) throw new RazorpayCheckoutError('provider_error', 'Could not start checkout.')

  try {
    const order = await client.createOrder({
      amount: price.amountMinor,
      currency: price.currency,
      receipt: checkout.id,
      // Informational only (visible in the Razorpay dashboard): recording uses our checkout row, never these notes.
      notes: { mbp_checkout_id: checkout.id, mbp_party_id: partyId, mbp_plan: plan, application: 'magical-birthday-planner' },
    })
    await admin.from('billing_checkouts').update({ session_id: order.id }).eq('id', checkout.id)
    return { checkoutId: checkout.id, orderId: order.id, amount: price.amountMinor, currency: price.currency }
  } catch (err) {
    await admin.from('billing_checkouts').update({ status: 'failed' }).eq('id', checkout.id)
    throw new RazorpayCheckoutError((err as { kind?: string })?.kind === 'not_configured' ? 'not_configured' : 'provider_error', 'Could not start checkout.')
  }
}

export interface RazorpayPaymentFacts {
  paymentId: string
  orderId: string
  status: RazorpayPaymentStatus
  amountMinor: number
  currency: string
  eventAt: string
}

export type RecordOutcome = { status: 'processed' | 'ignored' | 'unmatched'; detail: string; userId?: string | null; purchaseStatus?: string }

/**
 * Record one Razorpay payment state (from the verify endpoint's server-side Fetch Payment, or from a webhook).
 * Grants a plan only for a captured payment whose order, amount and currency match our checkout exactly.
 */
export async function recordRazorpayPayment(admin: Admin, p: RazorpayPaymentFacts): Promise<RecordOutcome> {
  const { data: checkout } = await admin
    .from('billing_checkouts')
    .select('id, user_id, plan, party_id, product_id, amount_minor, currency, status')
    .eq('provider', 'razorpay')
    .eq('session_id', p.orderId)
    .maybeSingle()
  // An order we did not create (or a deleted checkout): nothing to grant.
  if (!checkout) return { status: 'unmatched', detail: 'unknown_order' }
  const plan = checkout.plan as PaidPlan
  const userId = checkout.user_id

  // Price integrity: the exact amount and currency of OUR order, or the payment is held for review.
  let status: string = p.status
  let detail = `payment:${p.status}`
  if (p.status === 'active' && (p.amountMinor !== checkout.amount_minor || p.currency !== checkout.currency)) {
    status = 'review'
    detail = 'amount_mismatch'
  }

  const { data: existing } = await admin.from('billing_purchases').select('user_id, last_event_at, status').eq('provider', 'razorpay').eq('provider_ref', p.paymentId).maybeSingle()
  if (existing && existing.user_id !== userId) return { status: 'ignored', detail: 'owner_mismatch', userId }
  if (existing?.last_event_at && Date.parse(existing.last_event_at) > Date.parse(p.eventAt)) return { status: 'ignored', detail: 'stale_event', userId, purchaseStatus: existing.status }
  // Never downgrade a settled purchase with a late "authorized"/"failed" view of the same payment.
  if (existing && (existing.status === 'active' || existing.status === 'refunded' || existing.status === 'review') && status !== 'active' && status !== 'review') {
    return { status: 'ignored', detail: 'already_settled', userId, purchaseStatus: existing.status }
  }
  if (existing?.status === status) return { status: 'ignored', detail: 'unchanged', userId, purchaseStatus: status }

  const fields = { kind: 'payment', plan, product_id: checkout.product_id, status, amount_minor: p.amountMinor, currency: p.currency, provider_order_ref: p.orderId, last_event_at: p.eventAt }
  let partyId: string | null = null
  let reason: 'party_unavailable' | null = null
  if (existing) {
    const { error } = await admin.from('billing_purchases').update(fields).eq('provider', 'razorpay').eq('provider_ref', p.paymentId)
    if (error) throw error
  } else {
    // The party is the checkout's party, provided it still exists and still belongs to the payer.
    if (checkout.party_id) {
      const { data: party } = await admin.from('parties').select('id').eq('id', checkout.party_id).eq('user_id', userId).maybeSingle()
      partyId = party?.id ?? null
    }
    if (!partyId) reason = 'party_unavailable'
    const { error } = await admin.from('billing_purchases').insert({ user_id: userId, provider: 'razorpay', provider_ref: p.paymentId, scope: 'party', party_id: partyId, unresolved_reason: reason, ...fields })
    if (error?.code === '23505') {
      // The verify call and the webhook raced: the other one inserted first. Apply this view as an update.
      const { error: e2 } = await admin.from('billing_purchases').update(fields).eq('provider', 'razorpay').eq('provider_ref', p.paymentId).eq('user_id', userId)
      if (e2) throw e2
    } else if (error) throw error
  }

  if (status === 'active') {
    await admin
      .from('billing_checkouts')
      .update({ status: 'completed', completed_at: new Date().toISOString(), payment_ref: p.paymentId })
      .eq('id', checkout.id)
      .eq('status', 'pending')
  }
  const { error: rpcErr } = await admin.rpc('recompute_entitlement', { p_user: userId })
  if (rpcErr) throw rpcErr
  if (reason && status === 'active') {
    paymentUnresolved(plan, reason)
    return { status: 'unmatched', detail: `party_unresolved:${reason}`, userId, purchaseStatus: status }
  }
  return { status: 'processed', detail, userId, purchaseStatus: status }
}

/** A refund processed in Razorpay: a full refund ends that party's plan (as with Dodo); a partial one is logged only. */
export async function recordRazorpayRefund(admin: Admin, r: { paymentId: string; full: boolean; eventAt: string }): Promise<RecordOutcome> {
  const { data: p } = await admin.from('billing_purchases').select('user_id, status').eq('provider', 'razorpay').eq('provider_ref', r.paymentId).maybeSingle()
  if (!p) return { status: 'unmatched', detail: 'refund_unknown_payment' }
  if (!r.full) return { status: 'ignored', detail: 'partial_refund', userId: p.user_id }
  if (p.status === 'refunded') return { status: 'ignored', detail: 'already_refunded', userId: p.user_id }
  await admin.from('billing_purchases').update({ status: 'refunded', last_event_at: r.eventAt }).eq('provider', 'razorpay').eq('provider_ref', r.paymentId)
  await admin.rpc('recompute_entitlement', { p_user: p.user_id })
  return { status: 'processed', detail: 'refunded', userId: p.user_id }
}
