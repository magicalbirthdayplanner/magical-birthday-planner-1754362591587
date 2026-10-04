import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { BillingError, createCheckout, getPartyPlan } from '@/lib/billing/server'
import { parsePlan } from '@/lib/billing/plans'
import { appBaseUrl } from '@/lib/server/notifications'
import { checkoutFailed, checkoutStarted } from '@/lib/observability/billing'

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

/** POST /api/billing/checkout { plan, partyId } → { checkoutUrl } (Dodo hosted checkout). Plans are bought per party. */
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
  const { data: party } = await auth.supabase.from('parties').select('id').eq('id', body.partyId).maybeSingle()
  if (!party) return apiError(404, 'not_found', 'Party not found.')
  const started = Date.now()
  if (!hasServiceRole()) {
    checkoutFailed(body.plan, 0, 'no_service_role')
    return apiError(503, 'not_configured', 'Payments are not available right now.')
  }
  // Never sell a party a plan it already has (or exceeds).
  const current = await getPartyPlan(getSupabaseAdmin(), auth.user.id, body.partyId)
  if (current.source !== 'trial' && RANK[current.plan] >= RANK[body.plan]) return apiError(409, 'already_owned', 'This party already has this plan.')
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
