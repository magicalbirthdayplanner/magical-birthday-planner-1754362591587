import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { createRazorpayClient, isOrderId, isPaymentId, paymentStatusOf, verifyPaymentSignature } from '@/lib/billing/razorpay'
import { recordRazorpayPayment } from '@/lib/billing/razorpay-server'
import { razorpayVerified } from '@/lib/observability/billing'

// Never cache upstream fetches (Supabase, Razorpay) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const Body = z.object({
  checkoutId: z.string().uuid(),
  razorpay_order_id: z.string().max(64),
  razorpay_payment_id: z.string().max(64),
  razorpay_signature: z.string().max(128),
}).strict()

/**
 * POST /api/billing/razorpay/verify — called by the browser after Razorpay Checkout's success handler.
 * 1. The checkout must be the caller's own Razorpay checkout (RLS); its order id comes from OUR record.
 * 2. The handler signature is verified against our order id with the key secret (constant time).
 * 3. The payment is fetched from Razorpay server-side; only a captured payment of exactly our order's amount and
 *    currency grants the plan (via the same idempotent recorder the webhook uses).
 * The browser's word alone never unlocks anything.
 */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!rateLimit(`rzp-verify:${auth.user.id}`, 20, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many attempts. Please try again later.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid payment confirmation.')
  }
  if (!hasServiceRole() || !process.env.RAZORPAY_KEY_SECRET) return apiError(503, 'not_configured', 'Payments are not available right now.')
  // RLS: only the caller's own checkout is visible.
  const { data: checkout } = await auth.supabase.from('billing_checkouts').select('id, provider, session_id, status').eq('id', body.checkoutId).maybeSingle()
  if (!checkout || checkout.provider !== 'razorpay' || !isOrderId(checkout.session_id)) return apiError(404, 'not_found', 'Checkout not found.')
  if (body.razorpay_order_id !== checkout.session_id || !isPaymentId(body.razorpay_payment_id)) {
    razorpayVerified('mismatch')
    return apiError(400, 'invalid_request', 'This payment doesn’t belong to this checkout.')
  }
  if (!verifyPaymentSignature(checkout.session_id, body.razorpay_payment_id, body.razorpay_signature, process.env.RAZORPAY_KEY_SECRET)) {
    razorpayVerified('bad_signature')
    return apiError(400, 'invalid_request', 'We couldn’t verify this payment.')
  }

  let payment
  try {
    payment = await createRazorpayClient().fetchPayment(body.razorpay_payment_id)
  } catch {
    // Signature was valid: the webhook will settle it. The success page keeps polling.
    razorpayVerified('fetch_failed')
    return NextResponse.json({ status: 'pending', checkoutId: checkout.id })
  }
  const status = paymentStatusOf(payment)
  if (payment.order_id !== checkout.session_id || !status) {
    razorpayVerified('mismatch')
    return apiError(400, 'invalid_request', 'This payment doesn’t belong to this checkout.')
  }
  const outcome = await recordRazorpayPayment(getSupabaseAdmin(), {
    paymentId: payment.id,
    orderId: checkout.session_id,
    status,
    amountMinor: payment.amount,
    currency: payment.currency,
    eventAt: payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString(),
  })
  razorpayVerified(outcome.purchaseStatus ?? outcome.detail)
  const result = outcome.purchaseStatus === 'active' ? 'active' : outcome.purchaseStatus === 'failed' ? 'failed' : 'pending'
  return NextResponse.json({ status: result, checkoutId: checkout.id })
}
