import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { BillingError, createCheckout, getPartyPlan } from '@/lib/billing/server'
import { parsePlan, type PaidPlan } from '@/lib/billing/plans'
import { providerPolicy, type ProviderPolicy } from '@/lib/billing/providers'
import { createRazorpayCheckout, RazorpayCheckoutError } from '@/lib/billing/razorpay-server'
import { PLAN_INFO } from '@/lib/entitlements'
import type { User } from '@supabase/supabase-js'
import { appBaseUrl } from '@/lib/server/notifications'
import { checkoutFailed, checkoutStarted, razorpayCheckoutUnavailable } from '@/lib/observability/billing'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

// Only the plan NAME and the party come from the client. Product, price and customer are resolved server-side,
// the party must belong to the caller (RLS); any extra field (productId, price, userId…) is rejected.
const Body = z.object({
  plan: z.string().max(20).transform((v, ctx) => parsePlan(v) ?? (ctx.addIssue({ code: 'custom' }), z.NEVER)),
  partyId: z.string().uuid(),
}).strict()

const RANK = { FREE: 0, STARTER: 1, PLUS: 2, PRO: 3, PROFESSIONAL: 3 } as const

/**
 * POST /api/billing/checkout { plan, partyId } → US party: { checkoutUrl } (Dodo hosted checkout, unchanged);
 * India party: { provider: 'razorpay', checkoutId, razorpay: {…} } when Razorpay is enabled, else 503. Per party.
 */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in to upgrade.')
  if (!auth.user.email) return apiError(400, 'invalid_request', 'Your account needs an email address to check out.')
  if (!rateLimit(`checkout:${auth.user.id}`, 10, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many checkout attempts. Please try again later.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Please choose a valid plan and party.')
  }
  const { data: party } = await auth.supabase.from('parties').select('id, country_code').eq('id', body.partyId).maybeSingle()
  if (!party) return apiError(404, 'not_found', 'Party not found.')
  // The provider follows the party's stored event country (never a client parameter). No cross-provider fallback.
  const policy = providerPolicy(party.country_code)
  const started = Date.now()
  if (!hasServiceRole()) {
    checkoutFailed(body.plan, 0, 'no_service_role')
    return apiError(503, 'not_configured', 'Payments are not available right now.')
  }
  // Never sell a party a plan it already has (or exceeds).
  const current = await getPartyPlan(getSupabaseAdmin(), auth.user.id, body.partyId)
  if (current.source !== 'trial' && RANK[current.plan] >= RANK[body.plan]) return apiError(409, 'already_owned', 'This party already has this plan.')
  if (policy.provider === 'razorpay') return razorpayCheckout(auth.user, body.plan, body.partyId, policy, started)
  try {
    const { checkoutUrl } = await createCheckout(getSupabaseAdmin(), auth.user, body.plan, body.partyId, appBaseUrl())
    checkoutStarted(body.plan, Date.now() - started)
    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    checkoutFailed(body.plan, Date.now() - started, err instanceof BillingError ? err.code : 'unexpected', err instanceof BillingError ? undefined : err)
    if (err instanceof BillingError) {
      const status = err.code === 'not_configured' || err.code === 'live_disabled' ? 503 : 502
      return apiError(status, err.code === 'live_disabled' ? 'not_configured' : 'server_error', err.code === 'live_disabled' || err.code === 'not_configured' ? 'Payments are not available right now.' : 'We couldn’t start checkout. Please try again.')
    }
    console.error('checkout error', (err as Error)?.name)
    return apiError(500, 'server_error', 'We couldn’t start checkout. Please try again.')
  }
}

/** India: a Razorpay order for the party's plan at the approved INR price, opened by Razorpay Checkout in the browser. */
async function razorpayCheckout(user: User, plan: PaidPlan, partyId: string, policy: ProviderPolicy, started: number) {
  const amount = policy.prices[plan]
  if (!policy.available || amount == null) {
    razorpayCheckoutUnavailable(plan, policy.reason ?? 'unavailable')
    return apiError(503, 'not_configured', 'Paid plans for parties in India aren’t available yet. Everything free keeps working — we’ll let you know when you can upgrade.')
  }
  try {
    const order = await createRazorpayCheckout(getSupabaseAdmin(), user, plan, partyId, { amountMinor: amount, currency: 'INR' })
    checkoutStarted(plan, Date.now() - started)
    const name = (user.user_metadata?.display_name || user.user_metadata?.full_name || '').toString().slice(0, 80)
    return NextResponse.json({
      provider: 'razorpay',
      checkoutId: order.checkoutId,
      // Everything Razorpay Checkout needs. The key id is public by design; the secret never leaves the server.
      razorpay: { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.orderId, amount: order.amount, currency: order.currency, name: 'Magical Birthday Planner', description: `${PLAN_INFO[plan].name} plan for one party`, prefill: { email: user.email ?? '', name } },
    })
  } catch (err) {
    checkoutFailed(plan, Date.now() - started, err instanceof RazorpayCheckoutError ? `razorpay_${err.code}` : 'unexpected', err instanceof RazorpayCheckoutError ? undefined : err)
    return apiError(err instanceof RazorpayCheckoutError && err.code === 'not_configured' ? 503 : 502, 'server_error', 'We couldn’t start checkout. Please try again.')
  }
}
