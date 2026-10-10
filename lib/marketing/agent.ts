/**
 * The autonomous loop, as idempotent scheduler tasks (Vercel Cron → /api/cron/marketing?task=…):
 *
 *   plan     (weekly)  — plan next week's 56 slots (no AI, no API calls) and write its first day.
 *   prepare  (daily)   — stale-claim sweep → X metrics (owned reads, 2 windows) → MBP attribution → business scores →
 *                        learning + decisions → make sure this week is planned → batch-write today/tomorrow (one AI
 *                        call per day) → daily brief.
 *   publish  (8×/day)  — autonomous only: publish the due post (claim + daily limit + gap + budget); if the slot is here
 *                        and the day was never written, write it now (batch) and publish.
 *
 * Generate once → store → reuse → publish → measure. All safe to run any number of times. Dry-run (default) simulates
 * the publish step. SERVER ONLY.
 */
import 'server-only'
import { escapeHtml, sendTransactional } from '@/lib/server/notifications'
import { reportError } from '@/lib/observability/telemetry'
import { generateDay } from './batch'
import { runDailyBrief } from './brief'
import { budgetSnapshot } from './budget'
import { autonomousEffective, readMarketingConfig, xUserIdFromEnv, type MarketingConfig } from './config'
import { runLearning } from './learning'
import { SupabaseAnalyticsAttribution, collectAttribution, collectOwnMetrics, countCampaignEvents, importHistory, type AttributionSource } from './metrics'
import { planWeek, weekStartOf, type PlanWeights } from './planner'
import { getMarketingProvider, type MarketingProvider } from './providers'
import { publishPost, recoverStalePublishing, type PublishOutcome } from './publish'
import { updateScores } from './scoring'
import { getMarketingStore, type MarketingStore } from './store'
import { addDays, localDate, slotsFrom, startOfLocalDay } from './time'
import type { Platform } from './types'

export type MarketingTask = 'plan' | 'prepare' | 'publish'

export interface AgentDeps {
  store?: MarketingStore
  provider?: MarketingProvider
  cfg?: MarketingConfig
  attribution?: AttributionSource | null
  now?: Date
  env?: Record<string, string | undefined>
  /** Total wall-clock budget for this run (route maxDuration is 60 s). */
  budgetMs?: number
  sendEmail?: ((to: string, subject: string, text: string, date: string) => Promise<boolean>) | null
  countCampaign?: ((start: Date, end: Date) => Promise<{ landingVisits: number; signups: number; partiesCreated: number; checkouts: number; purchases: number } | null>) | null
}

const PLATFORM: Platform = 'x'

async function sendBriefEmail(to: string, subject: string, text: string, date: string): Promise<boolean> {
  const r = await sendTransactional({
    to,
    subject,
    text,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    idempotencyKey: `marketing-brief:${date}`,
    log: { type: 'marketing_brief' },
  })
  return r.ok
}

/** Run a step; a failing step is reported and recorded, never fatal for the others. */
async function step<T>(name: string, out: Record<string, unknown>, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn()
    out[name] = r ?? 'skipped'
    return r
  } catch (e) {
    out[name] = { error: (e as Error)?.message?.slice(0, 200) ?? 'failed' }
    reportError(e, { area: 'api', op: `marketing_${name}`, level: 'error', fingerprint: ['marketing', name] })
    return null
  }
}

function deps(d: AgentDeps) {
  const env = d.env ?? process.env
  const cfg = d.cfg ?? readMarketingConfig(env)
  return { env, cfg, store: d.store ?? getMarketingStore(), provider: d.provider ?? getMarketingProvider(PLATFORM, cfg, env), now: d.now ?? new Date(), budgetMs: d.budgetMs ?? 55_000 }
}

async function learned(store: MarketingStore): Promise<{ weights: PlanWeights; learnings: string[] }> {
  const ins = await store.latestInsights()
  const w = (ins?.data as { weights?: PlanWeights } | undefined)?.weights ?? {}
  return { weights: w, learnings: ins?.recommendations.slice(0, 8) ?? [] }
}

/** Weekly: plan next week (or this week if it has no plan yet) and write its first day. */
export async function runPlan(d: AgentDeps = {}): Promise<Record<string, unknown>> {
  const { cfg, store, now, env, budgetMs } = deps(d)
  const started = Date.now()
  const out: Record<string, unknown> = { task: 'plan', at: now.toISOString() }
  const today = localDate(now, cfg.timezone)
  const thisWeek = weekStartOf(today)
  const target = (await store.getPlan(PLATFORM, thisWeek)) ? addDays(thisWeek, 7) : thisWeek
  const budget = await budgetSnapshot(store, cfg, now, env)
  const { weights, learnings } = await learned(store)
  const plan = await step('plan', out, async () => {
    const p = await planWeek(store, cfg, { weekStart: target, now, budget, weights })
    return { weekStart: p.week_start, slots: (p.slots as unknown[]).length, status: p.status }
  })
  if (plan) {
    const first = target > today ? target : today
    await step('generate', out, () => generateDay(store, cfg, { date: first, now, budget, weights, learnings, budgetMs: budgetMs - (Date.now() - started) - 5_000, env }))
  }
  out.durationMs = Date.now() - started
  return out
}

export async function runPrepare(d: AgentDeps = {}): Promise<Record<string, unknown>> {
  const { cfg, store, provider, now, env, budgetMs } = deps(d)
  const started = Date.now()
  const out: Record<string, unknown> = { task: 'prepare', at: now.toISOString(), dryRun: cfg.dryRun }
  const settings = await store.getSettings()
  const auto = autonomousEffective(cfg, settings.autonomousEnabled)
  out.autonomous = auto

  await step('staleClaims', out, () => recoverStalePublishing(store, now))
  // Once: bring the account's existing posts in (≤ 100 owned reads) so the engine never repeats them.
  await step('history', out, async () => {
    const userId = xUserIdFromEnv(env)
    if (!userId || !provider.configured()) return 'not_configured'
    const known = await store.listPosts({ platform: PLATFORM, limit: 5000 })
    if (known.some((p) => p.source === 'imported') || (await store.recentAudit(500)).some((a) => a.action === 'history_imported')) return 'done'
    return importHistory(store, provider, cfg, { userId, now, env })
  })
  await step('platformMetrics', out, () => collectOwnMetrics(store, provider, cfg, { now, userId: xUserIdFromEnv(env), env }))
  const attribution = d.attribution === undefined ? new SupabaseAnalyticsAttribution() : d.attribution
  if (attribution) await step('attribution', out, () => collectAttribution(store, attribution, now))
  await step('scores', out, () => updateScores(store, cfg.scoreWeights, now))
  await step('learning', out, async () => {
    const r = await runLearning(store, { tz: cfg.timezone, windowDays: cfg.learningWindowDays, intervalDays: cfg.learningIntervalDays, now })
    return r ? { id: r.id, sampleSize: r.sampleSize, recommendations: r.recommendations.length } : 'not_due'
  })

  // Content bank: this week planned; today (if anything is left) and tomorrow written — one AI call per day.
  const { weights, learnings } = await learned(store)
  await step('content', out, async () => {
    const today = localDate(now, cfg.timezone)
    const done: Record<string, unknown>[] = []
    for (const date of [today, addDays(today, 1)]) {
      const remaining = budgetMs - (Date.now() - started)
      if (remaining < 30_000) break
      const budget = await budgetSnapshot(store, cfg, now, env)
      const r = await generateDay(store, cfg, { date, now, budget, weights, learnings, budgetMs: remaining - 8_000, env })
      done.push({ date, generated: r.generated.length, library: r.library.length, skipped: r.skipped.length, aiCalls: r.aiCalls, aiSkipped: r.aiSkipped ?? null })
    }
    return done
  })

  // The brief goes last so it sees what the content step just prepared.
  await step('brief', out, async () => {
    const b = await runDailyBrief(store, cfg, {
      now,
      autonomous: auto,
      countCampaign: d.countCampaign === undefined ? countCampaignEvents : d.countCampaign ?? undefined,
      send: d.sendEmail === undefined ? sendBriefEmail : d.sendEmail ?? undefined,
      budget: await budgetSnapshot(store, cfg, now, env),
    })
    return b ? { date: b.date } : 'exists'
  })
  out.durationMs = Date.now() - started
  return out
}

export async function runPublish(d: AgentDeps = {}): Promise<Record<string, unknown>> {
  const { cfg, store, provider, now, env, budgetMs } = deps(d)
  const started = Date.now()
  const out: Record<string, unknown> = { task: 'publish', at: now.toISOString(), dryRun: cfg.dryRun }
  await step('staleClaims', out, () => recoverStalePublishing(store, now))
  const settings = await store.getSettings()
  const auto = autonomousEffective(cfg, settings.autonomousEnabled)
  out.autonomous = auto
  if (!auto) {
    out.publish = { skipped: cfg.autonomousAllowed ? 'autonomous_switch_off' : 'AUTONOMOUS_PUBLISHING_not_true' }
    return out
  }
  const horizon = now.getTime() + cfg.publishEarlyMinutes * 60_000
  const dueNow = async () =>
    (await store.listPosts({ platform: PLATFORM, statuses: ['scheduled'] })).filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() <= horizon).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
  let due = await dueNow()

  // The slot is here but the day was never written (prepare failed): write it now (one batch call), then publish.
  if (!due.length) {
    const dayStart = startOfLocalDay(now, cfg.timezone).getTime()
    const slotNow = slotsFrom(now, cfg.postTimes.slice(0, cfg.postsPerDay), cfg.timezone, 1).find((s) => s.getTime() >= now.getTime() - 3 * 3_600_000 && s.getTime() <= horizon)
    const aimedToday = (await store.listPosts({ platform: PLATFORM, statuses: ['published', 'publishing', 'dry_run', 'failed', 'scheduled', 'approved'], since: new Date(now.getTime() - 30 * 86_400_000).toISOString() }))
      .filter((p) => [p.publishedAt, p.dryRunAt, p.publishingStartedAt, p.scheduledAt].some((t) => t && new Date(t).getTime() >= dayStart && new Date(t).getTime() < dayStart + 86_400_000))
    if (slotNow && !aimedToday.length && budgetMs - (Date.now() - started) > 35_000) {
      const { weights, learnings } = await learned(store)
      await step('justInTime', out, () => generateDay(store, cfg, { date: localDate(now, cfg.timezone), now, weights, learnings, budgetMs: budgetMs - (Date.now() - started) - 15_000, env }))
      due = await dueNow()
    }
  }

  const results: (PublishOutcome & { id: string })[] = []
  for (const p of due) {
    const r = await publishPost(p.id, 'scheduled', { store, provider, cfg, env }, { now })
    results.push({ ...r, id: p.id })
    // One post per run; stop on limits/budget; skip over a post that failed its own checks.
    if (r.ok || r.status === 'requeued' || (r.status === 'skipped' && ['daily_limit', 'min_gap', 'x_budget_exhausted', 'x_daily_allowance', 'budget_link'].includes(r.reason))) break
  }
  out.publish = results.map((r) => ({ id: r.id, ok: r.ok, status: r.status, reason: r.ok ? undefined : r.reason }))
  out.durationMs = Date.now() - started
  return out
}

export function runMarketingTask(task: MarketingTask, d: AgentDeps = {}) {
  return task === 'plan' ? runPlan(d) : task === 'prepare' ? runPrepare(d) : runPublish(d)
}
