/**
 * Santa call packs — one-time Dodo purchases that grant Santa visits. SERVER ONLY.
 *
 * Kept apart from the birthday party plans: own products, own ledger (santa_checkouts / santa_orders), so nothing in
 * billing_purchases / recompute_entitlement changes. Shared: Dodo account, webhook signature check, the
 * billing_webhook_events idempotency ledger and billing_customers.
 *
 * The pack comes from the PRODUCT id (server config), never from metadata. The buyer comes from OUR checkout row
 * (referenced in metadata), cross-checked against a known customer id. URL parameters never grant anything.
 */
import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'
import type { DodoEvent } from '@/lib/billing/events'
import { checkoutEnvironmentAllowed, dodoApiBase, dodoMode, liveChargingAllowed } from '@/lib/billing/plans'
import { BillingError, type ProcessOutcome } from '@/lib/billing/server'
import { MAX_QUANTITY, SANTA_PACKS, type SantaPack } from './packs'

type Admin = SupabaseClient<Database>
type Env = Record<string, string | undefined>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const customerProvider = () => (dodoMode() === 'live_mode' ? 'dodo_live' : 'dodo')

export function santaProductId(pack: SantaPack, env: Env = process.env): string | null {
  const v = env[`DODO_PRODUCT_${pack}`]?.trim()
  return v && /^pdt_[A-Za-z0-9]{6,64}$/.test(v) ? v : null
}

export function santaPackForProduct(productId: string | null | undefined, env: Env = process.env): SantaPack | null {
  if (!productId) return null
  return (Object.keys(SANTA_PACKS) as SantaPack[]).find((p) => santaProductId(p, env) === productId) ?? null
}

export function santaPriceCents(pack: SantaPack, env: Env = process.env): number {
  const n = Number(env[`DODO_PRICE_${pack}_CENTS`])
  return Number.isInteger(n) && n > 0 ? n : SANTA_PACKS[pack].priceCents
}

export function santaCheckoutAvailable(env: Env = process.env): boolean {
  return !!env.DODO_PAYMENTS_API_KEY && checkoutEnvironmentAllowed(env) && (Object.keys(SANTA_PACKS) as SantaPack[]).every((p) => santaProductId(p, env))
}

// ---------------------------------------------------------------- checkout
export async function createSantaCheckout(admin: Admin, user: User, pack: SantaPack, quantity: number, returnBase: string, fetchImpl: typeof fetch = fetch) {
  const qty = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity)))
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const productId = santaProductId(pack)
  if (!apiKey || !productId) throw new BillingError('not_configured', 'Payments are not configured.')
  if (!checkoutEnvironmentAllowed()) throw new BillingError(dodoMode() === 'live_mode' && !liveChargingAllowed() ? 'live_disabled' : 'not_configured', 'Payments are not configured.')

  const { data: checkout, error } = await admin
    .from('santa_checkouts')
    .insert({ user_id: user.id, pack, quantity: qty, product_id: productId, amount_minor: santaPriceCents(pack) * qty, currency: 'USD' })
    .select('id')
    .single()
  if (error || !checkout) throw new BillingError('provider_error', 'Could not start checkout.')

  const { data: known } = await admin.from('billing_customers').select('provider_customer_id').eq('user_id', user.id).eq('provider', customerProvider()).maybeSingle()
  const name = (user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer').toString().slice(0, 80)
  const body = {
    product_cart: [{ product_id: productId, quantity: qty }],
    customer: known?.provider_customer_id ? { customer_id: known.provider_customer_id } : { email: user.email, name },
    return_url: `${returnBase}/santa/ready?ref=${checkout.id}`,
    metadata: { mbp_user_id: user.id, santa_checkout_id: checkout.id, santa_pack: pack, santa_quantity: qty, application: 'magical-santa', environment: dodoMode() === 'live_mode' ? 'live' : 'test' },
  }
  let res: Response
  try {
    res = await fetchImpl(`${dodoApiBase()}/checkouts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    await admin.from('santa_checkouts').update({ status: 'failed' }).eq('id', checkout.id)
    throw new BillingError('provider_error', 'Payment provider unreachable.')
  }
  const json = (await res.json().catch(() => null)) as { session_id?: string; checkout_url?: string | null } | null
  if (!res.ok || !json?.checkout_url || !json.session_id) {
    console.error('dodo santa checkout failed', res.status)
    await admin.from('santa_checkouts').update({ status: 'failed' }).eq('id', checkout.id)
    throw new BillingError(res.ok ? 'invalid_response' : 'provider_error', 'Could not start checkout.')
  }
  let url: URL
  try {
    url = new URL(json.checkout_url)
  } catch {
    throw new BillingError('invalid_response', 'Could not start checkout.')
  }
  const trusted = url.protocol === 'https:' && (url.hostname === 'dodopayments.com' || url.hostname.endsWith('.dodopayments.com'))
  if (!trusted && !process.env.DODO_API_BASE_URL) throw new BillingError('invalid_response', 'Could not start checkout.')
  await admin.from('santa_checkouts').update({ session_id: json.session_id }).eq('id', checkout.id)
  return { checkoutUrl: url.toString(), checkoutId: checkout.id }
}

// ---------------------------------------------------------------- webhook
type OrderStatus = 'pending' | 'active' | 'failed' | 'refunded' | 'review'

async function mark(admin: Admin, id: string, status: string, detail: string, userId: string | null = null) {
  await admin.from('billing_webhook_events').update({ status, detail: detail.slice(0, 200), user_id: userId, processed_at: new Date().toISOString() }).eq('event_id', id)
}

/**
 * Handle a verified Dodo event if it concerns a Santa pack. Returns null when it doesn't (the birthday billing path
 * then handles it). The event id is already recorded in billing_webhook_events by the caller.
 */
export async function processSantaEvent(admin: Admin, eventId: string, e: DodoEvent, env: Env = process.env): Promise<ProcessOutcome | null> {
  const d = e.data
  const eventAt = e.timestamp && !Number.isNaN(Date.parse(e.timestamp)) ? e.timestamp : new Date().toISOString()

  if (e.type === 'refund.succeeded') {
    if (!d.payment_id) return null
    const { data: o } = await admin.from('santa_orders').select('id, user_id').eq('provider', 'dodo').eq('provider_ref', d.payment_id).maybeSingle()
    if (!o) return null
    await admin.from('santa_orders').update({ status: 'refunded', last_event_at: eventAt }).eq('id', o.id)
    await mark(admin, eventId, 'processed', 'santa_refunded', o.user_id)
    return { status: 'processed', detail: 'santa_refunded', userId: o.user_id }
  }

  if (!e.type.startsWith('payment.') || d.subscription_id) return null
  const productId = d.product_cart?.[0]?.product_id
  const pack = santaPackForProduct(productId, env)
  if (!pack) return null
  if (!d.payment_id) {
    await mark(admin, eventId, 'ignored', 'santa_missing_payment_id')
    return { status: 'ignored', detail: 'santa_missing_payment_id' }
  }
  const status: OrderStatus | undefined =
    e.type === 'payment.succeeded' ? 'active' : e.type === 'payment.processing' ? 'pending' : e.type === 'payment.failed' || e.type === 'payment.cancelled' ? 'failed' : undefined
  if (!status) {
    await mark(admin, eventId, 'ignored', `santa_unhandled_${e.type}`)
    return { status: 'ignored', detail: `santa_unhandled_${e.type}` }
  }

  // Who paid: OUR checkout row named in the metadata; a known customer id must agree with it.
  const meta = d.metadata ?? {}
  const checkoutId = typeof meta.santa_checkout_id === 'string' && UUID.test(meta.santa_checkout_id) ? meta.santa_checkout_id : null
  const { data: checkout } = checkoutId ? await admin.from('santa_checkouts').select('id, user_id, pack, quantity').eq('id', checkoutId).maybeSingle() : { data: null }
  if (!checkout || checkout.pack !== pack) {
    await mark(admin, eventId, 'unmatched', 'santa_no_checkout')
    return { status: 'unmatched', detail: 'santa_no_checkout' }
  }
  const userId = checkout.user_id
  const customerId = d.customer?.customer_id
  if (customerId) {
    const { data: known } = await admin.from('billing_customers').select('user_id').eq('provider', customerProvider()).eq('provider_customer_id', customerId).maybeSingle()
    if (known && known.user_id !== userId) {
      await mark(admin, eventId, 'rejected', 'santa_owner_mismatch', userId)
      return { status: 'ignored', detail: 'santa_owner_mismatch' }
    }
    await admin.from('billing_customers').delete().eq('user_id', userId).neq('provider', customerProvider())
    await admin.from('billing_customers').upsert({ user_id: userId, provider: customerProvider(), provider_customer_id: customerId, email: d.customer?.email ?? null }, { onConflict: 'user_id', ignoreDuplicates: true })
  }

  // Quantity: what Dodo says was bought, never more than our checkout asked for.
  const paidQty = Math.max(1, Math.min(checkout.quantity, Math.floor(Number(d.product_cart?.[0]?.quantity ?? 1)) || 1))
  const amount = typeof d.total_amount === 'number' ? d.total_amount : null
  let finalStatus: OrderStatus = status
  if (status === 'active' && d.currency === 'USD' && env.DODO_ALLOW_DISCOUNTS !== 'true' && (amount == null || amount < santaPriceCents(pack, env) * paidQty)) finalStatus = 'review'

  const { data: existing } = await admin.from('santa_orders').select('id, user_id, status, last_event_at').eq('provider', 'dodo').eq('provider_ref', d.payment_id).maybeSingle()
  if (existing && existing.user_id !== userId) {
    await mark(admin, eventId, 'rejected', 'santa_owner_mismatch', userId)
    return { status: 'ignored', detail: 'santa_owner_mismatch' }
  }
  if (existing?.last_event_at && Date.parse(existing.last_event_at) > Date.parse(eventAt)) {
    await mark(admin, eventId, 'ignored', 'santa_stale_event', userId)
    return { status: 'ignored', detail: 'santa_stale_event', userId }
  }
  if (existing && (existing.status === 'active' || existing.status === 'refunded') && finalStatus !== existing.status) {
    await mark(admin, eventId, 'ignored', 'santa_already_settled', userId)
    return { status: 'ignored', detail: 'santa_already_settled', userId }
  }

  const info = SANTA_PACKS[pack]
  const fields = { status: finalStatus, amount_minor: amount, currency: d.currency ?? null, product_id: productId ?? null, last_event_at: eventAt }
  if (existing) {
    const { error } = await admin.from('santa_orders').update(fields).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await admin.from('santa_orders').insert({
      user_id: userId, checkout_id: checkout.id, provider: 'dodo', provider_ref: d.payment_id, pack,
      quantity: paidQty, seconds_granted: info.seconds * paidQty, ...fields,
    })
    if (error?.code === '23505') {
      const { error: e2 } = await admin.from('santa_orders').update(fields).eq('provider', 'dodo').eq('provider_ref', d.payment_id).eq('user_id', userId)
      if (e2) throw e2
    } else if (error) throw error
  }
  if (finalStatus === 'active') {
    await admin.from('santa_checkouts').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', checkout.id).eq('status', 'pending')
  }
  await mark(admin, eventId, 'processed', `santa_${finalStatus}`, userId)
  return { status: 'processed', detail: `santa_${finalStatus}`, userId }
}
