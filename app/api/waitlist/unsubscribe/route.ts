import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { escapeHtml } from '@/lib/server/notifications'
import { reportDbError, track } from '@/lib/observability/telemetry'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function page(title: string, body: string, status = 200) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · Magical Birthday Planner</title></head>
<body style="margin:0;background:#fbf8f3;font-family:Nunito,'Segoe UI',Arial,sans-serif;color:#221b3a">
<main style="max-width:440px;margin:0 auto;padding:56px 20px;text-align:center">
<img src="/icons/icon-192.png" width="48" height="48" alt="" style="border-radius:12px">
<h1 style="font-size:24px;margin:16px 0 8px">${escapeHtml(title)}</h1>${body}
</main></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}

/**
 * Waitlist email unsubscribe. GET only shows a confirmation button (mail scanners that pre-open links change
 * nothing); POST — the button, or an RFC 8058 one-click request from the mail client — unsubscribes.
 * The token is a random per-row id: the email address is never in the link.
 */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? ''
  if (!UUID.test(t)) return page('Link not recognised', '<p>This unsubscribe link isn’t valid.</p>', 400)
  return page(
    'Unsubscribe from launch emails?',
    `<p style="line-height:1.6">You won’t get any more Magical Birthday Planner waitlist emails.</p>
<form method="post" action="/api/waitlist/unsubscribe?t=${escapeHtml(t)}"><button type="submit" style="margin-top:12px;min-height:48px;padding:0 24px;border-radius:999px;border:0;background:#5b2fb8;color:#fff;font-size:16px;font-weight:700">Unsubscribe</button></form>`,
  )
}

export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? ''
  if (!UUID.test(t)) return page('Link not recognised', '<p>This unsubscribe link isn’t valid.</p>', 400)
  if (!rateLimit(`waitlist-unsub:${clientIp(req)}`, 20, 10 * 60_000).ok) return page('Please try again later', '<p>Too many requests from this device.</p>', 429)
  if (!hasServiceRole()) return page('Please try again later', '<p>We couldn’t update your preferences just now.</p>', 503)
  const { error } = await getSupabaseAdmin().rpc('unsubscribe_launch_waitlist', { p_token: t })
  if (error) {
    reportDbError('waitlist_unsubscribe', error)
    return page('Please try again later', '<p>We couldn’t update your preferences just now.</p>', 500)
  }
  track('waitlist_unsubscribed')
  return page('You’re unsubscribed', '<p style="line-height:1.6">You won’t get any more Magical Birthday Planner waitlist emails.</p>')
}
