import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { apiError } from '@/lib/server/http'
import { normalizeEmail } from '@/lib/waitlist'
import { sendLaunchReminders } from '@/lib/server/waitlist-email'
import { reportError } from '@/lib/observability/telemetry'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. No secret configured → nothing runs. */
function authorized(req: Request): boolean | 'not_configured' {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 16) return 'not_configured'
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

function guard(req: Request) {
  const ok = authorized(req)
  if (ok === 'not_configured') {
    reportError('Launch reminder cron not configured: CRON_SECRET', { area: 'api', op: 'launch_reminder_cron', level: 'fatal', fingerprint: ['launch-reminder-cron', 'not_configured'] })
    return apiError(503, 'not_configured', 'Not configured.')
  }
  return ok ? null : apiError(401, 'unauthorized', 'Unauthorized.')
}

/**
 * GET — the scheduled run (vercel.json: Oct 12 04:00 UTC = 00:00 EDT). Sends the "opens tomorrow" reminder to every
 * subscribed waitlist member who hasn't had it; outside Oct 12 00:00 ET → launch it does nothing. Safe to re-run.
 */
export async function GET(req: Request) {
  const denied = guard(req)
  if (denied) return denied
  return NextResponse.json(await sendLaunchReminders())
}

/**
 * POST — manual runs with the same secret. `{ "testEmail": "…" }` runs the exact reminder path for that ONE existing
 * waitlist row, at any time (pre-launch testing); `{ "all": true }` repeats the scheduled run (same time window).
 */
export async function POST(req: Request) {
  const denied = guard(req)
  if (denied) return denied
  const body = (await req.json().catch(() => null)) as { testEmail?: unknown; all?: unknown } | null
  if (typeof body?.testEmail === 'string' && body.testEmail.includes('@')) return NextResponse.json(await sendLaunchReminders({ onlyEmail: normalizeEmail(body.testEmail) }))
  if (body?.all === true) return NextResponse.json(await sendLaunchReminders())
  return apiError(400, 'invalid_request', 'Send { "testEmail": "…" } or { "all": true }.')
}
