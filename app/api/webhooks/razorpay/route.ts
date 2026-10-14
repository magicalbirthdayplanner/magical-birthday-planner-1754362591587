import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { decideRazorpayEvent, verifyWebhookSignature } from '@/lib/billing/razorpay'
import { recordRazorpayPayment, recordRazorpayRefund } from '@/lib/billing/razorpay-server'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { razorpayWebhook } from '@/lib/observability/billing'

// Never cache upstream fetches (Supabase) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const MAX_BODY = 512 * 1024

/**
 * POST /api/webhooks/razorpay — Razorpay webhooks (payment.captured, order.paid, payment.failed,
 * payment.authorized, refund.processed).
 * 401 on a bad signature (HMAC-SHA256 of the RAW body with RAZORPAY_WEBHOOK_SECRET); 200 for processed, duplicate,
 * ignored and unmatched events; 500 on transient failures so Razorpay retries. Idempotent on x-razorpay-event-id.
 */
export async function POST(req: Request) {
  const started = Date.now()
  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    razorpayWebhook('not_configured', Date.now() - started)
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'), secret)) {
    razorpayWebhook('invalid_signature', Date.now() - started)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  if (!hasServiceRole()) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const header = req.headers.get('x-razorpay-event-id')
  // The documented event id; a body hash only if the header is ever missing (still unique per delivery content).
  const eventId = `razorpay:${header && /^[A-Za-z0-9_-]{1,100}$/.test(header) ? header : createHash('sha256').update(raw).digest('hex').slice(0, 40)}`
  const action = decideRazorpayEvent(payload)
  const admin = getSupabaseAdmin()
  const type = ((payload as { event?: unknown })?.event as string | undefined)?.slice(0, 64) ?? 'invalid'

  const { error: insertErr } = await admin.from('billing_webhook_events').insert({ event_id: eventId, event_type: type })
  if (insertErr) {
    const { data: prior } = await admin.from('billing_webhook_events').select('status, attempts').eq('event_id', eventId).maybeSingle()
    if (prior && prior.status !== 'error' && prior.status !== 'received') {
      razorpayWebhook('duplicate', Date.now() - started)
      return NextResponse.json({ received: true, outcome: 'duplicate' })
    }
    await admin.from('billing_webhook_events').update({ attempts: (prior?.attempts ?? 1) + 1, status: 'received' }).eq('event_id', eventId)
  }
  const mark = (status: string, detail: string, userId?: string | null) =>
    admin.from('billing_webhook_events').update({ status, detail: detail.slice(0, 200), user_id: userId ?? null, processed_at: new Date().toISOString() }).eq('event_id', eventId)

  try {
    if (action.kind === 'ignore') {
      await mark('ignored', action.reason)
      razorpayWebhook('ignored', Date.now() - started)
      return NextResponse.json({ received: true, outcome: 'ignored' })
    }
    const outcome = action.kind === 'refund' ? await recordRazorpayRefund(admin, action) : await recordRazorpayPayment(admin, action)
    await mark(outcome.status === 'unmatched' ? 'unmatched' : outcome.status === 'ignored' ? 'ignored' : 'processed', outcome.detail, outcome.userId)
    razorpayWebhook(outcome.status, Date.now() - started)
    return NextResponse.json({ received: true, outcome: outcome.status })
  } catch (err) {
    await mark('error', (err as Error)?.message ?? 'error')
    razorpayWebhook('error', Date.now() - started, err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
