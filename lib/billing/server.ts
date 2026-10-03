/**
 * Dodo Payments — checkout creation and webhook processing. SERVER ONLY.
 * All writes use the service role; entitlement changes only via recompute_entitlement().
 */
import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'
import { decide, parseEvent, type DodoEvent } from './events'
import { checkoutEnvironmentAllowed, dodoApiBase, dodoMode, liveChargingAllowed, productIdFor, type PaidPlan } from './plans'

type Admin = SupabaseClient<Database>

/** Sandbox and live customer ids live in separate Dodo accounts; never reuse one across modes. */
const customerProvider = () => (dodoMode() === 'live_mode' ? 'dodo_live' : 'dodo')

export class BillingError extends Error {
  constructor(
    public code: 'not_configured' | 'live_disabled' | 'provider_error' | 'invalid_response',
    message: string,
  ) {
    super(message)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ------------------------------------------------------------------ checkout
export async function createCheckout(admin: Admin, user: User, plan: PaidPlan, returnBase: string, fetchImpl: typeof fetch = fetch) {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const productId = productIdFor(plan)
  if (!apiKey || !productId) throw new BillingError('not_configured', 'Payments are not configured.')
  // Explicit environment only (test_mode, or live_mode + the live switch). No silent defaults.
  if (!checkoutEnvironmentAllowed()) throw new BillingError(dodoMode() === 'live_mode' && !liveChargingAllowed() ? 'live_disabled' : 'not_configured', 'Payments are not configured.')

  const { data: checkout, error } = await admin
    .from('billing_checkouts')
    .insert({ user_id: user.id, plan, product_id: productId, customer_email: user.email ?? null })
    .select('id')
    .single()
  if (error || !checkout) throw new BillingError('provider_error', 'Could not start checkout.')

  const { data: known } = await admin.from('billing_customers').select('provider_customer_id').eq('user_id', user.id).eq('provider', customerProvider()).maybeSingle()
  const name = (user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer').toString().slice(0, 80)
  const body = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: known?.provider_customer_id ? { customer_id: known.provider_customer_id } : { email: user.email, name },
    return_url: `${returnBase}/checkout-success?ref=${checkout.id}`,
    // Informational only: the webhook derives the plan from the PRODUCT, and the user from
    // the known customer / this checkout record, never from client input.
    metadata: { mbp_user_id: user.id, mbp_checkout_id: checkout.id, mbp_plan: plan, application: 'magical-birthday-planner', environment: dodoMode() === 'live_mode' ? 'live' : 'test' },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetchImpl(`${dodoApiBase()}/checkouts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    await admin.from('billing_checkouts').update({ status: 'failed' }).eq('id', checkout.id)
    throw new BillingError('provider_error', 'Payment provider unreachable.')
  } finally {
    clearTimeout(timer)
  }
  const json = (await res.json().catch(() => null)) as { session_id?: string; checkout_url?: string | null } | null
  if (!res.ok || !json?.checkout_url || !json.session_id) {
    console.error('dodo checkout failed', res.status)
    await admin.from('billing_checkouts').update({ status: 'failed' }).eq('id', checkout.id)
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

  await admin.from('billing_checkouts').update({ session_id: json.session_id }).eq('id', checkout.id)
  return { checkoutUrl: url.toString(), checkoutId: checkout.id }
}

// ------------------------------------------------------------------ webhook processing
export type ProcessOutcome = { status: 'processed' | 'ignored' | 'unmatched' | 'duplicate'; detail?: string; userId?: string | null }

async function userExists(admin: Admin, id: string): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(id)
  return !!data?.user
}

/** Who paid? metadata → known customer id → recent pending checkout with the same email. */
async function resolveUser(admin: Admin, e: DodoEvent): Promise<string | null> {
  const meta = e.data.metadata ?? {}
  const metaUser = typeof meta.mbp_user_id === 'string' && UUID.test(meta.mbp_user_id) ? meta.mbp_user_id : null
  const customerId = e.data.customer?.customer_id
  if (customerId) {
    const { data } = await admin.from('billing_customers').select('user_id').eq('provider', customerProvider()).eq('provider_customer_id', customerId).maybeSingle()
    if (data?.user_id) {
      // A known customer always maps to its original user, whatever the metadata says.
      return data.user_id
    }
  }
  if (metaUser && (await userExists(admin, metaUser))) {
    const checkoutId = typeof meta.mbp_checkout_id === 'string' && UUID.test(meta.mbp_checkout_id) ? meta.mbp_checkout_id : null
    if (checkoutId) {
      const { data: c } = await admin.from('billing_checkouts').select('user_id').eq('id', checkoutId).maybeSingle()
      if (c && c.user_id !== metaUser) return null // inconsistent metadata
    }
    return metaUser
  }
  const email = e.data.customer?.email?.toLowerCase()
  if (email) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data } = await admin
      .from('billing_checkouts')
      .select('user_id')
      .ilike('customer_email', email)
      .eq('status', 'pending')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.[0]?.user_id) return data[0].user_id
  }
  return null
}

async function markEvent(admin: Admin, id: string, status: string, detail?: string, userId?: string | null) {
  await admin
    .from('billing_webhook_events')
    .update({ status, detail: detail?.slice(0, 200) ?? null, user_id: userId ?? null, processed_at: new Date().toISOString() })
    .eq('event_id', id)
}

/**
 * Idempotent: the webhook-id is recorded first; events already processed (or
 * deliberately ignored) are acknowledged without re-applying. Events that
 * previously errored are retried.
 */
export async function processWebhookEvent(admin: Admin, eventId: string, raw: unknown): Promise<ProcessOutcome> {
  const event = parseEvent(raw)
  const type = event?.type ?? 'invalid'

  const { error: insertErr } = await admin.from('billing_webhook_events').insert({ event_id: eventId, event_type: type.slice(0, 64) })
  if (insertErr) {
    const { data: prior } = await admin.from('billing_webhook_events').select('status, attempts').eq('event_id', eventId).maybeSingle()
    if (prior && prior.status !== 'error' && prior.status !== 'received') return { status: 'duplicate' }
    await admin.from('billing_webhook_events').update({ attempts: (prior?.attempts ?? 1) + 1, status: 'received' }).eq('event_id', eventId)
  }

  if (!event) {
    await markEvent(admin, eventId, 'rejected', 'invalid_payload')
    return { status: 'ignored', detail: 'invalid_payload' }
  }

  try {
    const action = decide(event)
    if (action.kind === 'ignore') {
      await markEvent(admin, eventId, 'ignored', action.reason)
      return { status: 'ignored', detail: action.reason }
    }

    if (action.kind === 'refund') {
      const { data: p } = await admin.from('billing_purchases').select('user_id').eq('provider', 'dodo').eq('provider_ref', action.providerRef).maybeSingle()
      if (!p) {
        await markEvent(admin, eventId, 'unmatched', 'refund_unknown_payment')
        return { status: 'unmatched', detail: 'refund_unknown_payment' }
      }
      await admin.from('billing_purchases').update({ status: 'refunded', last_event_at: event.timestamp ?? new Date().toISOString() }).eq('provider', 'dodo').eq('provider_ref', action.providerRef)
      await admin.rpc('recompute_entitlement', { p_user: p.user_id })
      await markEvent(admin, eventId, 'processed', 'refunded', p.user_id)
      return { status: 'processed', detail: 'refunded', userId: p.user_id }
    }

    const userId = await resolveUser(admin, event)
    if (!userId) {
      await markEvent(admin, eventId, 'unmatched', 'unknown_customer')
      return { status: 'unmatched', detail: 'unknown_customer' }
    }

    const customerId = event.data.customer?.customer_id
    if (customerId) {
      // One row per user: a customer id from the other mode (sandbox ↔ live) is replaced, never reused.
      await admin.from('billing_customers').delete().eq('user_id', userId).neq('provider', customerProvider())
      await admin
        .from('billing_customers')
        .upsert({ user_id: userId, provider: customerProvider(), provider_customer_id: customerId, email: event.data.customer?.email ?? null }, { onConflict: 'user_id', ignoreDuplicates: true })
    }

    // Out-of-order protection: never let an older event overwrite a newer one.
    const eventAt = event.timestamp && !Number.isNaN(Date.parse(event.timestamp)) ? event.timestamp : new Date().toISOString()
    const { data: existing } = await admin.from('billing_purchases').select('user_id, last_event_at, status').eq('provider', 'dodo').eq('provider_ref', action.providerRef).maybeSingle()
    if (existing && existing.user_id !== userId) {
      await markEvent(admin, eventId, 'rejected', 'owner_mismatch', userId)
      return { status: 'ignored', detail: 'owner_mismatch' }
    }
    if (existing?.last_event_at && Date.parse(existing.last_event_at) > Date.parse(eventAt)) {
      await markEvent(admin, eventId, 'ignored', 'stale_event', userId)
      return { status: 'ignored', detail: 'stale_event', userId }
    }
    // A failed retry must not downgrade an already-paid one-time purchase.
    if (existing?.status === 'active' && action.purchaseKind === 'payment' && action.status !== 'active') {
      await markEvent(admin, eventId, 'ignored', 'already_active', userId)
      return { status: 'ignored', detail: 'already_active', userId }
    }

    const { error: upsertErr } = await admin.from('billing_purchases').upsert(
      {
        user_id: userId,
        provider: 'dodo',
        provider_ref: action.providerRef,
        kind: action.purchaseKind,
        plan: action.plan,
        product_id: action.productId,
        status: action.status,
        amount_minor: action.amountMinor,
        currency: action.currency,
        customer_ref: customerId ?? null,
        current_period_end: action.currentPeriodEnd,
        last_event_at: eventAt,
      },
      { onConflict: 'provider,provider_ref' },
    )
    if (upsertErr) throw upsertErr

    if (action.status === 'active') {
      const checkoutId = event.data.metadata?.mbp_checkout_id
      const q = admin.from('billing_checkouts').update({ status: 'completed', completed_at: new Date().toISOString(), payment_ref: action.providerRef }).eq('user_id', userId).eq('status', 'pending')
      await (typeof checkoutId === 'string' && UUID.test(checkoutId) ? q.eq('id', checkoutId) : q.eq('plan', action.plan))
    }
    const { error: rpcErr } = await admin.rpc('recompute_entitlement', { p_user: userId })
    if (rpcErr) throw rpcErr
    await markEvent(admin, eventId, 'processed', action.reason ?? `${action.purchaseKind}:${action.status}`, userId)
    return { status: 'processed', detail: action.reason ?? action.status, userId }
  } catch (err) {
    await markEvent(admin, eventId, 'error', (err as Error)?.message ?? 'error')
    throw err
  }
}

// ------------------------------------------------------------------ entitlement (read)
export type AppPlan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO' | 'PROFESSIONAL'
export type PlanSource = 'admin_override' | 'purchase' | 'trial' | 'free'
export interface UserPlan {
  plan: AppPlan
  source: PlanSource
  trialActive: boolean
  override: { plan: string; expiresAt: string | null } | null
}

const APP_PLANS = ['FREE', 'STARTER', 'PLUS', 'PRO', 'PROFESSIONAL'] as const

/**
 * THE answer to "what plan does this user have, and why?". users.current_plan is
 * written only by recompute_entitlement (service role): admin override → verified
 * Dodo purchase → one-time trial → FREE. Lapsed overrides and trials are expired here.
 */
export async function getUserPlan(admin: Admin, userId: string): Promise<UserPlan> {
  const now = new Date()
  const read = () =>
    Promise.all([
      admin.from('users').select('email, current_plan, is_trial_active, trial_expires_at').eq('id', userId).maybeSingle(),
      admin.from('plan_overrides').select('plan, expires_at').eq('user_id', userId).maybeSingle(),
    ])
  let [{ data: profile }, { data: override }] = await read()
  let recompute = false
  if (override?.expires_at && new Date(override.expires_at) <= now) {
    // Conditional delete: only the request that actually removes it records the expiry.
    const { data: removed } = await admin.from('plan_overrides').delete().eq('user_id', userId).lte('expires_at', now.toISOString()).select('user_id')
    if (removed?.length) await admin.from('admin_audit_log').insert({ target_user_id: userId, target_email: profile?.email ?? null, action: 'override_expired', old_plan: override.plan, override_expires_at: override.expires_at })
    recompute = true
  }
  if (profile?.is_trial_active && (!profile.trial_expires_at || new Date(profile.trial_expires_at) <= now)) recompute = true
  if (recompute) {
    const { error } = await admin.rpc('recompute_entitlement', { p_user: userId })
    if (!error) [{ data: profile }, { data: override }] = await read()
  }
  const plan = APP_PLANS.find((p) => p === profile?.current_plan) ?? 'FREE'
  const trialActive = !!profile?.is_trial_active && !!profile.trial_expires_at && new Date(profile.trial_expires_at) > now
  let source: PlanSource
  if (override) source = 'admin_override'
  else if (plan !== 'FREE' && !trialActive) source = 'purchase'
  else if (plan !== 'FREE' && trialActive) {
    const { count } = await admin.from('billing_purchases').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active')
    source = count ? 'purchase' : 'trial'
  } else source = 'free'
  return { plan, source, trialActive, override: override ? { plan: override.plan, expiresAt: override.expires_at } : null }
}
