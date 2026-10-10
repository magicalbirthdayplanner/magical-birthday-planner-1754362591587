import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { apiError } from '@/lib/server/http'
import { hasServiceRole } from '@/lib/server/supabase-admin'
import { reportError } from '@/lib/observability/telemetry'
import { runMarketingTask, type MarketingTask } from '@/lib/marketing/agent'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. No secret configured → nothing runs. */
function authorized(req: Request): boolean | 'not_configured' {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 16) return 'not_configured'
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

function taskOf(req: Request): MarketingTask | null {
  const t = new URL(req.url).searchParams.get('task')
  return t === 'plan' || t === 'prepare' || t === 'publish' ? t : null
}

/**
 * GET /api/cron/marketing?task=plan|prepare|publish — the X growth engine's scheduled runs (vercel.json crons).
 * POST (same secret, same query) runs it by hand, e.g. from an external scheduler. Idempotent: running twice never
 * publishes twice; dry-run (MARKETING_DRY_RUN, default true) never reaches X. Returns a summary without secrets.
 */
async function handle(req: Request) {
  const ok = authorized(req)
  if (ok === 'not_configured') {
    reportError('Marketing cron not configured: CRON_SECRET', { area: 'api', op: 'marketing_cron', level: 'fatal', fingerprint: ['marketing-cron', 'not_configured'] })
    return apiError(503, 'not_configured', 'Not configured.')
  }
  if (!ok) return apiError(401, 'unauthorized', 'Unauthorized.')
  const task = taskOf(req)
  if (!task) return apiError(400, 'invalid_request', 'Use ?task=plan, ?task=prepare or ?task=publish.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Not configured.')
  try {
    return NextResponse.json(await runMarketingTask(task))
  } catch (e) {
    reportError(e, { area: 'api', op: `marketing_cron_${task}`, level: 'error', fingerprint: ['marketing-cron', task] })
    return apiError(500, 'server_error', 'Marketing run failed.')
  }
}

export const GET = handle
export const POST = handle
