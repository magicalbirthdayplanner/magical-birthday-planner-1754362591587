import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/server/admin'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { reportError } from '@/lib/observability/telemetry'
import { runPlan, runPrepare, runPublish } from '@/lib/marketing/agent'
import { generateDay } from '@/lib/marketing/batch'
import { autonomousEffective, readMarketingConfig, xUserIdFromEnv } from '@/lib/marketing/config'
import { approveDay, checkConnection, CONSOLE_PLATFORMS, generalOverview, platformOverview, writeNextDay } from '@/lib/marketing/console'
import { importHistory } from '@/lib/marketing/metrics'
import { getMarketingProvider } from '@/lib/marketing/providers'
import { getMarketingStore } from '@/lib/marketing/store'
import type { Platform } from '@/lib/marketing/types'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PLATFORM = z.enum(['x', 'instagram', 'facebook'])

/** GET /api/admin/marketing?tab=general|x|instagram|facebook → the marketing console data (Super Admin only). */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const tab = new URL(req.url).searchParams.get('tab') ?? 'general'
  try {
    const store = getMarketingStore()
    const cfg = readMarketingConfig()
    if ((CONSOLE_PLATFORMS as string[]).includes(tab)) return NextResponse.json(await platformOverview(store, cfg, tab as Platform))
    return NextResponse.json(await generalOverview(store, cfg))
  } catch (e) {
    reportError(e, { area: 'api', op: 'marketing_console', level: 'error' })
    return apiError(500, 'server_error', 'Could not load marketing data. Are the marketing migrations applied?')
  }
}

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settings'), autonomousEnabled: z.boolean() }).strict(),
  z.object({ action: z.literal('pause'), platform: PLATFORM, paused: z.boolean() }).strict(),
  z.object({ action: z.literal('check_connection'), platform: PLATFORM }).strict(),
  z.object({ action: z.literal('write_next_day'), platform: PLATFORM }).strict(),
  z.object({ action: z.literal('write_day'), platform: PLATFORM, date: DATE }).strict(),
  z.object({ action: z.literal('approve_day'), platform: PLATFORM, date: DATE }).strict(),
  z.object({ action: z.literal('import_history'), platform: PLATFORM }).strict(),
  z.object({ action: z.literal('run'), task: z.enum(['plan', 'prepare', 'publish']) }).strict(),
])

/**
 * POST /api/admin/marketing
 *   settings {autonomousEnabled} · pause {platform, paused} · check_connection {platform}
 *   write_next_day {platform} (earliest unwritten day; call repeatedly to fill 30 days) · write_day {platform, date}
 *   approve_day {platform, date} · import_history {platform} · run {task}
 * Post-level actions (approve, publish now, regenerate, edit, cancel, delete) live in /api/admin/marketing/posts/:id.
 */
export async function POST(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  if (!rateLimit(`admin-marketing:${auth.user.id}`, 120, 10 * 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests. Try again in a few minutes.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid request.')
  }
  const store = getMarketingStore()
  const cfg = readMarketingConfig()
  const actor = auth.user.id
  try {
    switch (body.action) {
      case 'settings': {
        const s = await store.setAutonomous(body.autonomousEnabled, actor)
        await store.audit(null, actor, body.autonomousEnabled ? 'autonomous_on' : 'autonomous_off', { envAllows: cfg.autonomousAllowed, dryRun: cfg.dryRun })
        return NextResponse.json({ ok: true, settings: s, autonomousEffective: autonomousEffective(cfg, s.autonomousEnabled) })
      }
      case 'pause': {
        const s = await store.setPaused(body.platform, body.paused, actor)
        await store.audit(null, actor, body.paused ? 'platform_paused' : 'platform_resumed', { platform: body.platform })
        return NextResponse.json({ ok: true, settings: s })
      }
      case 'check_connection':
        return NextResponse.json(await checkConnection(store, cfg, body.platform))
      case 'write_next_day':
        return NextResponse.json({ ok: true, ...(await writeNextDay(store, cfg, body.platform, actor)) })
      case 'write_day': {
        const insights = await store.latestInsights()
        const r = await generateDay(store, cfg, { date: body.date, platform: body.platform, actor, budgetMs: 52_000, weights: (insights?.data as { weights?: object } | undefined)?.weights ?? {}, learnings: insights?.recommendations.slice(0, 8) ?? [] })
        return NextResponse.json({ ok: true, result: r })
      }
      case 'approve_day':
        return NextResponse.json({ ok: true, ...(await approveDay(store, cfg, body.platform, body.date, actor)) })
      case 'import_history':
        return NextResponse.json({ ok: true, result: await importHistory(store, getMarketingProvider(body.platform, cfg), cfg, { userId: xUserIdFromEnv() }) })
      case 'run': {
        const result = body.task === 'plan' ? await runPlan() : body.task === 'prepare' ? await runPrepare() : await runPublish()
        return NextResponse.json({ ok: true, result })
      }
    }
  } catch (e) {
    reportError(e, { area: 'api', op: `marketing_${body.action}`, level: 'error' })
    return apiError(500, 'server_error', (e as Error)?.message?.startsWith('Budget:') ? (e as Error).message : 'Something went wrong.')
  }
}
