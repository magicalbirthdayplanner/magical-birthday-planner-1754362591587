import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/server/admin'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { reportError } from '@/lib/observability/telemetry'
import { adminContext, generateDraft, overview } from '@/lib/marketing/admin'
import { runPrepare, runPublish } from '@/lib/marketing/agent'
import { runDailyBrief } from '@/lib/marketing/brief'
import { autonomousEffective } from '@/lib/marketing/config'
import { runLearning } from '@/lib/marketing/learning'
import { SupabaseAnalyticsAttribution, collectAttribution, collectOwnMetrics, countCampaignEvents } from '@/lib/marketing/metrics'
import { budgetSnapshot, xMeter, allowX } from '@/lib/marketing/budget'
import { xUserIdFromEnv } from '@/lib/marketing/config'
import { MarketingProviderError } from '@/lib/marketing/providers'
import { PILLARS } from '@/lib/marketing/types'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET /api/admin/marketing → everything the founder marketing dashboard shows (Super Admin only). */
export async function GET(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  try {
    return NextResponse.json(await overview(adminContext(auth.user.id)))
  } catch (e) {
    reportError(e, { area: 'api', op: 'marketing_overview', level: 'error' })
    return apiError(500, 'server_error', 'Could not load marketing data. Is the migration applied?')
  }
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), pillar: z.enum(PILLARS).nullable().optional() }).strict(),
  z.object({ action: z.literal('settings'), autonomousEnabled: z.boolean() }).strict(),
  z.object({ action: z.literal('run'), task: z.enum(['refresh', 'prepare', 'publish']) }).strict(),
  z.object({ action: z.literal('verify_x') }).strict(),
])

/**
 * POST /api/admin/marketing
 *   { action: 'generate', pillar? }                — new draft (never published by this call)
 *   { action: 'settings', autonomousEnabled }      — the AUTONOMOUS PUBLISHING switch (env must also allow it)
 *   { action: 'run', task: refresh|prepare|publish } — run a scheduler step now (publish honours dry-run + switches)
 *   { action: 'verify_x' }                         — check the X credentials (returns the handle only)
 */
export async function POST(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  if (!rateLimit(`admin-marketing:${auth.user.id}`, 30, 10 * 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests. Try again in a few minutes.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid request.')
  }
  const ctx = adminContext(auth.user.id)
  try {
    switch (body.action) {
      case 'generate': {
        const r = await generateDraft(ctx, body.pillar ?? null)
        return r.ok ? NextResponse.json(r) : NextResponse.json({ error: { code: 'invalid_request', message: r.message }, detail: r.detail }, { status: r.status })
      }
      case 'settings': {
        const s = await ctx.store.setAutonomous(body.autonomousEnabled, auth.user.id)
        await ctx.store.audit(null, auth.user.id, body.autonomousEnabled ? 'autonomous_on' : 'autonomous_off', { envAllows: ctx.cfg.autonomousAllowed, dryRun: ctx.cfg.dryRun })
        return NextResponse.json({ ok: true, settings: s, autonomousEffective: autonomousEffective(ctx.cfg, s.autonomousEnabled) })
      }
      case 'run': {
        if (body.task === 'prepare') return NextResponse.json({ ok: true, result: await runPrepare({ store: ctx.store, cfg: ctx.cfg, provider: ctx.provider }) })
        if (body.task === 'publish') return NextResponse.json({ ok: true, result: await runPublish({ store: ctx.store, cfg: ctx.cfg, provider: ctx.provider }) })
        const settings = await ctx.store.getSettings()
        const result = {
          platformMetrics: await collectOwnMetrics(ctx.store, ctx.provider, ctx.cfg, { userId: xUserIdFromEnv() }).catch((e: Error) => ({ error: e.message.slice(0, 200) })),
          attribution: await collectAttribution(ctx.store, new SupabaseAnalyticsAttribution()).catch((e: Error) => ({ error: e.message.slice(0, 200) })),
          learning: (await runLearning(ctx.store, { tz: ctx.cfg.timezone, windowDays: ctx.cfg.learningWindowDays, intervalDays: ctx.cfg.learningIntervalDays, force: true }))?.recommendations ?? [],
          brief: (await runDailyBrief(ctx.store, ctx.cfg, { autonomous: autonomousEffective(ctx.cfg, settings.autonomousEnabled), countCampaign: countCampaignEvents, force: true }))?.date ?? null,
        }
        return NextResponse.json({ ok: true, result })
      }
      case 'verify_x': {
        if (!ctx.provider.configured()) return apiError(503, 'not_configured', 'X credentials are not configured (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET).')
        const budget = await budgetSnapshot(ctx.store, ctx.cfg)
        if (!allowX(budget, budget.prices.user_read, 'discretionary').ok) return apiError(429, 'quota', 'The X budget is too tight for a connection check right now.')
        ctx.provider.setMeter(xMeter(ctx.store, budget.prices))
        try {
          const me = await ctx.provider.verify()
          await ctx.store.audit(null, auth.user.id, 'verified_x', { username: me.username, accessLevel: me.accessLevel ?? null })
          const canPost = !me.accessLevel || /write/.test(me.accessLevel)
          return NextResponse.json({ ok: true, account: { username: me.username, name: me.name, accessLevel: me.accessLevel ?? null, canPost } })
        } catch (e) {
          const msg = e instanceof MarketingProviderError ? e.message : 'X check failed.'
          return apiError(502, 'server_error', msg.slice(0, 200))
        } finally {
          ctx.provider.setMeter(null)
        }
      }
    }
  } catch (e) {
    reportError(e, { area: 'api', op: `marketing_${body.action}`, level: 'error' })
    return apiError(500, 'server_error', 'Something went wrong.')
  }
}
