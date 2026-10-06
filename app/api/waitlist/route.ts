import { NextResponse } from 'next/server'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { WaitlistRequest } from '@/lib/waitlist'
import { waitlistEvent, waitlistFailed } from '@/lib/observability/waitlist'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'

/**
 * POST /api/waitlist — anonymous launch-waitlist sign-up { email, firstName?, utm_*?, source? }.
 * The email is validated and normalized here and stored by the service-role-only join_launch_waitlist().
 * A new and an already-listed email get the same answer, so the endpoint can't be used to test who signed up.
 */
export async function POST(req: Request) {
  const ip = clientIp(req)
  if (!rateLimit(`waitlist:${ip}`, 5, 10 * 60_000).ok || !rateLimit(`waitlist-day:${ip}`, 30, 86_400_000).ok) {
    waitlistEvent('waitlist_signup_validation_error', { reason: 'rate_limited' })
    return apiError(429, 'rate_limited', 'Too many tries from this device. Please try again in a few minutes.')
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    raw = null
  }
  const parsed = WaitlistRequest.safeParse(raw)
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    waitlistEvent('waitlist_signup_validation_error', { reason: field === 'email' ? 'invalid_email' : 'invalid_request' })
    return apiError(400, 'invalid_request', 'Please enter a valid email address.')
  }
  const body = parsed.data
  const dims = { form: body.form, source: body.utm_source ?? body.source ?? 'direct', campaign: body.utm_campaign }

  // Bots that fill the hidden field get a normal-looking answer and nothing is stored.
  if (body.website) {
    waitlistEvent('waitlist_signup_validation_error', { ...dims, reason: 'honeypot' })
    return NextResponse.json({ ok: true })
  }
  if (!hasServiceRole()) {
    waitlistFailed('not_configured', dims)
    return apiError(503, 'not_configured', 'The waitlist is temporarily unavailable. Please try again soon.')
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc('join_launch_waitlist', {
      p_email: body.email,
      p_first_name: body.firstName,
      p_source: body.source,
      p_utm_source: body.utm_source,
      p_utm_medium: body.utm_medium,
      p_utm_campaign: body.utm_campaign,
      p_utm_content: body.utm_content,
    })
    // Only the code is reported: PostgREST messages and details can echo the submitted email.
    if (error) {
      waitlistFailed((typeof error.code === 'string' && error.code.slice(0, 16)) || 'unknown', dims)
      return apiError(500, 'server_error', 'We couldn’t add you just now. Please try again.')
    }
    waitlistEvent(data === 'duplicate' ? 'waitlist_signup_duplicate' : 'waitlist_signup_success', dims)
    return NextResponse.json({ ok: true })
  } catch {
    waitlistFailed('unreachable', dims)
    return apiError(500, 'server_error', 'We couldn’t add you just now. Please try again.')
  }
}
