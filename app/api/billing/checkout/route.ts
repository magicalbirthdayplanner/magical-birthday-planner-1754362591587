import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { BillingError, createCheckout } from '@/lib/billing/server'
import { PAID_PLANS } from '@/lib/billing/plans'
import { appBaseUrl } from '@/lib/server/notifications'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

// Only the plan NAME comes from the client. Product, price and customer are server-side.
const Body = z.object({ plan: z.enum(PAID_PLANS) }).strict()

/** POST /api/billing/checkout { plan } → { checkoutUrl } (Dodo hosted checkout) */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in to upgrade.')
  if (!auth.user.email) return apiError(400, 'invalid_request', 'Your account needs an email address to check out.')
  if (!rateLimit(`checkout:${auth.user.id}`, 10, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many checkout attempts. Please try again later.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Please choose a valid plan.')
  }
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Payments are not available right now.')
  try {
    const { checkoutUrl } = await createCheckout(getSupabaseAdmin(), auth.user, body.plan, appBaseUrl())
    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    if (err instanceof BillingError) {
      const status = err.code === 'not_configured' || err.code === 'live_disabled' ? 503 : 502
      return apiError(status, err.code === 'live_disabled' ? 'not_configured' : 'server_error', err.code === 'live_disabled' || err.code === 'not_configured' ? 'Payments are not available right now.' : 'We couldn’t start checkout. Please try again.')
    }
    console.error('checkout error', (err as Error)?.name)
    return apiError(500, 'server_error', 'We couldn’t start checkout. Please try again.')
  }
}
