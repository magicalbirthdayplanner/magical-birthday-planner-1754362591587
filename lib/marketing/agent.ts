/**
 * The autonomous loop, as idempotent scheduler tasks (Vercel Cron → /api/cron/marketing?task=…):
 *
 *   plan     (weekly)  — plan next week's slots (no AI, no API calls) and write its first day.
 *   prepare  (daily)   — stale-claim sweep → batch-write today/tomorrow (one AI call per day) → X/Meta metrics →
 *                        MBP attribution → business scores → learning + decisions (each only while time is left) →
 *                        daily brief.
 *   publish  (every 5 min, pg_cron) — autonomous only: publish the due post (claim + daily limit + gap + budget); if
 *                        the slot is here and the day was never written, write it now (batch) and publish; then top
 *                        up the content bank by one day (topUpBank).
 *
 * Generate once → store → reuse → publish → measure. All safe to run any number of times. Dry-run (default) simulates
 * the publish step. SERVER ONLY.
 */
import 'server-only'
import { escapeHtml, sendTransactional } from '@/lib/server/notifications'
import { reportError } from '@/lib/observability/telemetry'
import { daysToWrite, generateDay } from './batch'
import { runDailyBrief } from './brief'
import { budgetSnapshot } from './budget'
import { autonomousEffective, cadenceFor, readMarketingConfig, xUserIdFromEnv, type MarketingConfig } from './config'
import { runLearning } from './learning'
import { SupabaseAnalyticsAttribution, collectAttribution, collectMetaMetrics, collectOwnMetrics, countCampaignEvents, importHistory, type AttributionSource } from './metrics'
import { planWeek, weekStartOf, type PlanWeights } from './planner'
import { getMarketingProvider, type MarketingProvider } from './providers'
import { publishPost, recoverStalePublishing, type PublishOutcome } from './publish'
import { updateScores } from './scoring'
import { getMarketingStore, type MarketingStore } from './store'
import { addDays, localDate, slotsFrom, startOfLocalDay, weekdayIndex } from './time'
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
  /** How many days ahead `prepare` writes itself (default 2: today and tomorrow; the publish ticks top up the rest). */
  contentHorizonDays?: number
  /** `publish` tops up the content bank after publishing (default true). */
  topUp?: boolean
}

const PLATFORM: Platform = 'x'
/** `prepare` writes only the urgent days; everything further out is the publish ticks' job. */
const URGENT_DAYS = 2
/** A measurement step in `prepare` needs at least this much of the run left, otherwise it waits for tomorrow. */
const MEASURE_MIN_MS = 12_000
/** One AI batch call can take ~20–40 s: the bank top-up only starts with this much of the run left. */
const TOP_UP_MIN_MS = 40_000
/** At most one bank write per this many minutes from the publish ticks (they fire every 5 minutes). */
const TOP_UP_EVERY_MINUTES = 10
/** After a failed AI call, wait this long before the ticks try the model again (library items still fill in). */
const AI_BACKOFF_MINUTES = 60

/**
 * Keep the content bank (MARKETING_BANK_DAYS ahead) written, one day per call: the earliest unwritten day across the
 * platforms. Runs from the 5-minute publish ticks, so the bank fills within hours and never depends on one long daily
 * run. Throttled through the audit log (one write per 10 minutes, an hour's pause after an AI failure).
 */
export async function topUpBank(store: MarketingStore, cfg: MarketingConfig, opts: { now: Date; budgetMs: number; env?: Record<string, string | undefined> }): Promise<Record<string, unknown> | string> {
  const recent = (await store.recentAudit(100)).filter((a) => a.action === 'batch_generated').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (recent) {
    const ago = (opts.now.getTime() - new Date(recent.createdAt).getTime()) / 60_000
    if (ago < TOP_UP_EVERY_MINUTES) return 'recently_written'
    const skipped = String((recent.detail as { aiSkipped?: unknown }).aiSkipped ?? '')
    if (skipped.startsWith('ai_') && ago < AI_BACKOFF_MINUTES) return 'ai_backoff'
  }
  let pick: { platform: Platform; date: string } | null = null
  for (const platform of cfg.platforms) {
    const [date] = await daysToWrite(store, cfg, { platform, now: opts.now, limit: 1 })
    if (date && (!pick || date < pick.date)) pick = { platform, date }
  }
  if (!pick) return 'bank_full'
  const { weights, learnings } = await learned(store)
  const r = await generateDay(store, cfg, { date: pick.date, now: opts.now, weights, learnings, budgetMs: opts.budgetMs, env: opts.env, platform: pick.platform })
  return { platform: pick.platform, date: pick.date, generated: r.generated.length, library: r.library.length, skipped: r.skipped.length, aiCalls: r.aiCalls, aiSkipped: r.aiSkipped ?? null }
}

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
  const target = (await store.getPlan(cfg.platforms[0] ?? PLATFORM, thisWeek)) ? addDays(thisWeek, 7) : thisWeek
  const budget = await budgetSnapshot(store, cfg, now, env)
  const { weights, learnings } = await learned(store)
  for (const platform of cfg.platforms) {
    const plan = await step(`plan_${platform}`, out, async () => {
      const p = await planWeek(store, cfg, { weekStart: target, now, budget, weights, platform })
      return { weekStart: p.week_start, slots: (p.slots as unknown[]).length, status: p.status }
    })
    if (plan && budgetMs - (Date.now() - started) > 25_000) {
      const first = target > today ? target : today
      await step(`generate_${platform}`, out, () => generateDay(store, cfg, { date: first, now, budget, weights, learnings, budgetMs: budgetMs - (Date.now() - started) - 5_000, env, platform }))
    }
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
  // Once per platform: bring the account's existing posts in so the engine never repeats them (X: ≤ 100 owned reads).
  for (const platform of cfg.platforms) {
    await step(`history_${platform}`, out, async () => {
      const prov = platform === 'x' ? provider : getMarketingProvider(platform, cfg, env)
      if (!prov.configured() || (platform === 'x' && !xUserIdFromEnv(env))) return 'not_configured'
      const done = (await store.recentAudit(500)).some((a) => a.action === 'history_imported' && ((a.detail as { platform?: string }).platform ?? 'x') === platform)
      if (done || (await store.listPosts({ platform, limit: 5000 })).some((p) => p.source === 'imported')) return 'done'
      return importHistory(store, prov, cfg, { userId: xUserIdFromEnv(env), now, env })
    })
  }
  // Content FIRST (2026-11 fix): it used to run after metrics + attribution + learning, which take ~45 s in production,
  // so it never had the 30 s it needs and the bank silently stopped being written (Oct 11 → Nov 9). Today and tomorrow
  // are written here; the rest of the 30-day bank is topped up by the 5-minute publish ticks (topUpBank).
  const { weights, learnings } = await learned(store)
  await step('content', out, async () => {
    const done: Record<string, unknown>[] = []
    const queues = new Map<Platform, string[]>()
    for (const platform of cfg.platforms) queues.set(platform, await daysToWrite(store, cfg, { platform, now, limit: 4, horizonDays: Math.min(cfg.bankDays, d.contentHorizonDays ?? URGENT_DAYS) }))
    // Most urgent first: the platform whose next unwritten day is earliest (then the one with the most missing days).
    const order = [...cfg.platforms].sort((a, b) => (queues.get(a)?.[0] ?? '9').localeCompare(queues.get(b)?.[0] ?? '9') || (queues.get(b)?.length ?? 0) - (queues.get(a)?.length ?? 0))
    for (let round = 0; round < 4; round++) {
      for (const platform of order) {
        const date = queues.get(platform)?.[round]
        if (!date) continue
        const remaining = budgetMs - (Date.now() - started)
        if (remaining < 30_000) return done
        const budget = await budgetSnapshot(store, cfg, now, env)
        const r = await generateDay(store, cfg, { date, now, budget, weights, learnings, budgetMs: remaining - 8_000, env, platform })
        done.push({ platform, date, generated: r.generated.length, library: r.library.length, skipped: r.skipped.length, aiCalls: r.aiCalls, aiSkipped: r.aiSkipped ?? null })
      }
    }
    return done
  })

  // Measurement and learning use what time is left; a step that can't fit waits for tomorrow's run.
  const timed = async <T>(name: string, fn: () => Promise<T>) => {
    if (budgetMs - (Date.now() - started) < MEASURE_MIN_MS) {
      out[name] = 'time_budget'
      return null
    }
    return step(name, out, fn)
  }
  if (cfg.platforms.includes('x')) await timed('platformMetrics', () => collectOwnMetrics(store, provider, cfg, { now, userId: xUserIdFromEnv(env), env }))
  for (const p of cfg.platforms.filter((x) => x !== 'x')) await timed(`${p}Metrics`, () => collectMetaMetrics(store, getMarketingProvider(p, cfg, env), { now }))
  const attribution = d.attribution === undefined ? new SupabaseAnalyticsAttribution() : d.attribution
  if (attribution) await timed('attribution', () => collectAttribution(store, attribution, now))
  await timed('scores', () => updateScores(store, cfg.scoreWeights, now))
  await timed('learning', async () => {
    const r = await runLearning(store, { tz: cfg.timezone, windowDays: cfg.learningWindowDays, intervalDays: cfg.learningIntervalDays, now })
    return r ? { id: r.id, sampleSize: r.sampleSize, recommendations: r.recommendations.length } : 'not_due'
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
  // AUTONOMOUS_PUBLISHING (env) is the scheduler's kill switch. With the admin switch ON the engine publishes its own
  // bank; with it OFF only posts a person approved go out at their time.
  if (!cfg.autonomousAllowed) {
    out.publish = { skipped: 'AUTONOMOUS_PUBLISHING_not_true' }
    return out
  }
  const horizon = now.getTime() + cfg.publishEarlyMinutes * 60_000
  const results: (PublishOutcome & { id: string; platform: Platform })[] = []
  for (const platform of cfg.platforms) {
    if (settings.pausedPlatforms.includes(platform)) {
      results.push({ ok: false, status: 'skipped', reason: 'platform_paused', id: '-', platform })
      continue
    }
    const prov = platform === 'x' ? provider : getMarketingProvider(platform, cfg, env)
    // Autonomous mode needs no approval: the bank's validated drafts (written while the switch was off) go to the queue.
    if (auto) for (const dr of await store.listPosts({ platform, statuses: ['draft'], limit: 200 })) {
      if (dr.origin !== 'agent' || !dr.planId || !dr.scheduledAt || new Date(dr.scheduledAt).getTime() > horizon) continue
      if (await store.updatePost(dr.id, { status: 'scheduled', autonomous: true, approved_at: now.toISOString() }, ['draft'])) await store.audit(dr.id, null, 'auto_approved', {})
    }
    const dueNow = async () =>
      (await store.listPosts({ platform, statuses: ['scheduled'] }))
        .filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() <= horizon && (auto || !p.autonomous))
        .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
    let due = await dueNow()

    // The slot is here but the day was never written (prepare failed): write it now (one batch call), then publish.
    if (!due.length) {
      const cad = cadenceFor(cfg, platform)
      const dayStart = startOfLocalDay(now, cfg.timezone).getTime()
      const postingDay = cad.postDays.includes(weekdayIndex(localDate(now, cfg.timezone)))
      const slotNow = postingDay ? slotsFrom(now, cad.postTimes, cfg.timezone, 1).find((s) => s.getTime() >= now.getTime() - 3 * 3_600_000 && s.getTime() <= horizon) : undefined
      const aimedToday = (await store.listPosts({ platform, statuses: ['published', 'publishing', 'dry_run', 'failed', 'scheduled', 'approved'], since: new Date(now.getTime() - 30 * 86_400_000).toISOString() }))
        .filter((p) => [p.publishedAt, p.dryRunAt, p.publishingStartedAt, p.scheduledAt].some((t) => t && new Date(t).getTime() >= dayStart && new Date(t).getTime() < dayStart + 86_400_000))
      if (auto && slotNow && !aimedToday.length && budgetMs - (Date.now() - started) > 35_000) {
        const { weights, learnings } = await learned(store)
        await step(`justInTime_${platform}`, out, () => generateDay(store, cfg, { date: localDate(now, cfg.timezone), now, weights, learnings, budgetMs: budgetMs - (Date.now() - started) - 15_000, env, platform }))
        due = await dueNow()
      }
    }

    for (const p of due) {
      if (budgetMs - (Date.now() - started) < 10_000) break
      const r = await publishPost(p.id, 'scheduled', { store, provider: prov, cfg, env }, { now })
      results.push({ ...r, id: p.id, platform })
      // One post per platform per run; stop on limits/budget; skip over a post that failed its own checks.
      if (r.ok || r.status === 'requeued' || (r.status === 'skipped' && ['daily_limit', 'min_gap', 'x_budget_exhausted', 'x_daily_allowance', 'budget_link', 'provider_not_configured'].includes(r.reason))) break
    }
  }
  out.publish = results.map((r) => ({ platform: r.platform, id: r.id, ok: r.ok, status: r.status, reason: r.ok ? undefined : r.reason }))
  // Most ticks publish nothing: use the rest of the run to keep the content bank written.
  if (d.topUp !== false) {
    const left = budgetMs - (Date.now() - started)
    if (left >= TOP_UP_MIN_MS) await step('bank', out, () => topUpBank(store, cfg, { now, budgetMs: left - 5_000, env }))
    else out.bank = 'time_budget'
  }
  out.durationMs = Date.now() - started
  return out
}

export function runMarketingTask(task: MarketingTask, d: AgentDeps = {}) {
  return task === 'plan' ? runPlan(d) : task === 'prepare' ? runPrepare(d) : runPublish(d)
}
