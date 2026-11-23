/** POST /api/santa/checkout {pack, quantity 1–3} → {checkoutUrl}. Product and price come from server config only. */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { BillingError } from '@/lib/billing/server'
import { createSantaCheckout } from '@/lib/santa/billing'
import { isSantaPack, MAX_QUANTITY } from '@/lib/santa/packs'
import { santaUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const Body = z.object({ pack: z.string().refine(isSantaPack), quantity: z.number().int().min(1).max(MAX_QUANTITY).default(1) }).strict()

export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in to continue.')
  if (!auth.user.email) return apiError(400, 'invalid_request', 'Your account needs an email address to check out.')
  if (!rateLimit(`santa-checkout:${auth.user.id}`, 10, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many checkout attempts. Please try again later.')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Please choose a Santa call.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Payments are not available right now.')
  try {
    const { checkoutUrl } = await createSantaCheckout(getSupabaseAdmin(), auth.user, parsed.data.pack as never, parsed.data.quantity, santaUrl())
    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    if (err instanceof BillingError) {
      const unavailable = err.code === 'not_configured' || err.code === 'live_disabled'
      return apiError(unavailable ? 503 : 502, unavailable ? 'not_configured' : 'server_error', unavailable ? 'Payments are not available right now.' : 'We couldn’t start checkout. Please try again.')
    }
    console.error('santa checkout error', (err as Error)?.name)
    return apiError(500, 'server_error', 'We couldn’t start checkout. Please try again.')
  }
}
