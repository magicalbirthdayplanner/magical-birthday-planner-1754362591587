import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/billing/webhook-signature'
import { processWebhookEvent } from '@/lib/billing/server'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const MAX_BODY = 512 * 1024

/**
 * POST /api/webhooks/dodo — Dodo Payments webhooks (Standard Webhooks signing).
 * 401 on bad/old signatures; 200 for processed, duplicate, ignored and
 * unmatched events (no pointless retries); 500 on transient failures so Dodo retries.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  const headers = {
    id: req.headers.get('webhook-id'),
    timestamp: req.headers.get('webhook-timestamp'),
    signature: req.headers.get('webhook-signature'),
  }
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET
  const verified = verifyWebhook(secret, headers, raw)
  if (!verified.ok) {
    if (verified.reason === 'no_secret') return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  if (!headers.id || headers.id.length > 200) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })
  if (!hasServiceRole()) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  try {
    const outcome = await processWebhookEvent(getSupabaseAdmin(), headers.id, payload)
    return NextResponse.json({ received: true, outcome: outcome.status })
  } catch (err) {
    console.error('dodo webhook processing failed', (err as Error)?.name)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
