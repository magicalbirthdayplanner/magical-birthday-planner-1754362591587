import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/server/admin'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { reportError } from '@/lib/observability/telemetry'
import { runPlan, runPrepare, runPublish } from '@/lib/marketing/agent'
import { generateDay } from '@/lib/marketing/batch'
import { budgetSnapshot } from '@/lib/marketing/budget'
import { readMarketingConfig, xUserIdFromEnv } from '@/lib/marketing/config'
import { importHistory } from '@/lib/marketing/metrics'
import { planWeek, weekStartOf } from '@/lib/marketing/planner'
import { getMarketingProvider } from '@/lib/marketing/providers'
import { getMarketingStore } from '@/lib/marketing/store'
import { localDate } from '@/lib/marketing/time'
import { xOverview } from '@/lib/marketing/xdashboard'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET /api/admin/marketing/x → the X growth dashboard (Super Admin only). */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  try {
    return NextResponse.json(await xOverview(getMarketingStore(), readMarketingConfig()))
  } catch (e) {
    reportError(e, { area: 'api', op: 'marketing_x_overview', level: 'error' })
    return apiError(500, 'server_error', 'Could not load the X dashboard. Are the marketing migrations applied?')
  }
}

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plan_week'), weekStart: DATE.optional(), force: z.boolean().optional() }).strict(),
  z.object({ action: z.literal('generate_day'), date: DATE }).strict(),
  z.object({ action: z.literal('import_history') }).strict(),
  z.object({ action: z.literal('run'), task: z.enum(['plan', 'prepare', 'publish']) }).strict(),
])

/**
 * POST /api/admin/marketing/x
 *   { action: 'plan_week', weekStart?, force? } — (re)plan a week's slots (no AI, no X calls)
 *   { action: 'generate_day', date }           — write that day's posts in one batch (AI, budget-gated)
 *   { action: 'import_history' }               — one owned read of the account's last 100 posts (~$0.10 max)
 *   { action: 'run', task }                    — run a scheduler task now (publish honours dry-run + switches)
 */
export async function POST(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  if (!rateLimit(`admin-marketing-x:${auth.user.id}`, 40, 10 * 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests. Try again in a few minutes.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid request.')
  }
  const store = getMarketingStore()
  const cfg = readMarketingConfig()
  try {
    switch (body.action) {
      case 'plan_week': {
        const weekStart = body.weekStart ? weekStartOf(body.weekStart) : weekStartOf(localDate(new Date(), cfg.timezone))
        const insights = await store.latestInsights()
        const plan = await planWeek(store, cfg, { weekStart, budget: await budgetSnapshot(store, cfg), weights: (insights?.data as { weights?: object } | undefined)?.weights ?? {}, force: body.force })
        await store.audit(null, auth.user.id, 'plan_week', { weekStart, force: !!body.force })
        return NextResponse.json({ ok: true, weekStart: plan.week_start, slots: (plan.slots as unknown[]).length })
      }
      case 'generate_day': {
        const insights = await store.latestInsights()
        const r = await generateDay(store, cfg, { date: body.date, actor: auth.user.id, weights: (insights?.data as { weights?: object } | undefined)?.weights ?? {}, learnings: insights?.recommendations.slice(0, 8) ?? [], budgetMs: 52_000 })
        return NextResponse.json({ ok: true, result: r })
      }
      case 'import_history': {
        const r = await importHistory(store, getMarketingProvider('x', cfg), cfg, { userId: xUserIdFromEnv() })
        return NextResponse.json({ ok: true, result: r })
      }
      case 'run': {
        const result = body.task === 'plan' ? await runPlan() : body.task === 'prepare' ? await runPrepare() : await runPublish()
        return NextResponse.json({ ok: true, result })
      }
    }
  } catch (e) {
    reportError(e, { area: 'api', op: `marketing_x_${body.action}`, level: 'error' })
    return apiError(500, 'server_error', (e as Error)?.message?.startsWith('Budget:') ? (e as Error).message : 'Something went wrong.')
  }
}
