/**
 * Data + actions for the single marketing console (/admin/marketing): a General tab and one tab per platform (X,
 * Instagram, Facebook) with the 30-day schedule laid out slot by slot. Super Admin routes only. SERVER ONLY.
 */
import 'server-only'
import { aiConfig } from '@/lib/ai/config'
import { generateDay, daysToWrite } from './batch'
import { allowX, budgetSnapshot, xMeter } from './budget'
import { autonomousEffective, cadenceFor, hasFacebookCredentials, hasInstagramCredentials, hasXCredentials, xUserIdFromEnv, type MarketingConfig } from './config'
import { hookStyle } from './learning'
import { planSlots, planWeek, weekStartOf, type PlanSlot } from './planner'
import { getMarketingProvider, MarketingProviderError } from './providers'
import { engagements } from './scoring'
import type { MarketingStore } from './store'
import { addDays, localDate } from './time'
import { PILLAR_LABEL, SLOT_ROLE_LABEL, type MarketingPost, type Platform, type SlotRole } from './types'
import { forbiddenTermsFromEnv, platformRules, validatePost } from './validation'

export const CONSOLE_PLATFORMS: Platform[] = ['x', 'instagram', 'facebook']
const LABEL: Record<string, string> = { x: 'X', instagram: 'Instagram', facebook: 'Facebook' }

export function credentialsPresent(platform: Platform): boolean {
  return platform === 'x' ? hasXCredentials() && !!xUserIdFromEnv() : platform === 'instagram' ? hasInstagramCredentials() : platform === 'facebook' ? hasFacebookCredentials() : false
}

export interface ConsolePost {
  id: string
  platform: string
  status: string
  format: string
  role: string | null
  roleLabel: string | null
  pillarLabel: string
  topic: string
  scheduledAt: string | null
  publishedAt: string | null
  dryRunAt: string | null
  text: string
  poll: MarketingPost['poll']
  threadParts: string[] | null
  link: boolean
  source: string
  autonomous: boolean
  approved: boolean
  thumbs: { url: string | null; kind: string }[]
  externalPostUrl: string | null
  businessScore: number | null
  estCostUsd: number | null
  metrics: MarketingPost['metrics']
  attribution: MarketingPost['attribution']
  error: string | null
  errorCode: string | null
  validation: { ok: boolean; errors: string[]; warnings: string[]; length: number | null }
}

async function views(store: MarketingStore, cfg: MarketingConfig, posts: MarketingPost[]): Promise<ConsolePost[]> {
  const ids = [...new Set(posts.flatMap((p) => p.mediaIds))]
  const media = ids.length ? await store.listMedia({ ids }) : []
  const paths = media.filter((m) => m.storage_path && m.kind === 'image').map((m) => m.storage_path!)
  const urls = await store.signedMediaUrls(paths, 3600).catch(() => new Map<string, string>())
  const forbidden = forbiddenTermsFromEnv()
  return posts.map((p) => {
    const rules = platformRules(p.platform, cfg)
    const v = ['draft', 'approved', 'scheduled', 'failed'].includes(p.status) ? validatePost(p.text, { ...rules, pillar: p.pillar, allowedLink: p.linkUrl, forbiddenTerms: forbidden, minChars: p.format === 'poll' ? 10 : rules.minChars }) : null
    return {
      id: p.id,
      platform: p.platform,
      status: p.status,
      format: p.format,
      role: p.slotRole,
      roleLabel: p.slotRole && p.slotRole in SLOT_ROLE_LABEL ? SLOT_ROLE_LABEL[p.slotRole as SlotRole] : null,
      pillarLabel: PILLAR_LABEL[p.pillar],
      topic: p.topic,
      scheduledAt: p.scheduledAt,
      publishedAt: p.publishedAt,
      dryRunAt: p.dryRunAt,
      text: p.text,
      poll: p.poll,
      threadParts: p.threadParts,
      link: !!p.linkUrl,
      source: p.source,
      autonomous: p.autonomous,
      approved: !!p.approvedAt && !p.autonomous,
      thumbs: p.mediaIds.map((id) => {
        const m = media.find((x) => x.id === id)
        return { url: m?.storage_path ? urls.get(m.storage_path) ?? null : null, kind: m?.kind ?? 'image' }
      }),
      externalPostUrl: p.externalPostUrl,
      businessScore: p.businessScore,
      estCostUsd: p.estCostUsd,
      metrics: p.metrics,
      attribution: p.attribution,
      error: p.publishError,
      errorCode: p.publishErrorCode,
      validation: v ? { ok: v.ok, errors: v.errors.map((e) => e.message), warnings: v.warnings.map((e) => e.message), length: v.weightedLength } : { ok: true, errors: [], warnings: [], length: null },
    }
  })
}

export async function generalOverview(store: MarketingStore, cfg: MarketingConfig, now = new Date()) {
  const settings = await store.getSettings()
  const [budget, insights, briefs, audit] = await Promise.all([budgetSnapshot(store, cfg, now), store.latestInsights(), store.latestBriefs(1), store.recentAudit(30)])
  const platforms: { platform: Platform; label: string; enabled: boolean; paused: boolean; credentials: boolean; postsPerDay: number; postTimes: string[]; queued: number; drafts: number; daysWritten: number; bankDays: number }[] = []
  for (const p of CONSOLE_PLATFORMS) {
    const cad = cadenceFor(cfg, p)
    const unwritten = cfg.platforms.includes(p) ? await daysToWrite(store, cfg, { platform: p, now, limit: 60 }) : []
    const queued = (await store.listPosts({ platform: p, statuses: ['scheduled', 'approved', 'draft'], limit: 1000 })).filter((x) => x.scheduledAt && x.scheduledAt > now.toISOString())
    platforms.push({
      platform: p,
      label: LABEL[p],
      enabled: cfg.platforms.includes(p),
      paused: settings.pausedPlatforms.includes(p),
      credentials: credentialsPresent(p),
      postsPerDay: cad.postsPerDay,
      postTimes: cad.postTimes,
      queued: queued.filter((x) => x.status !== 'draft').length,
      drafts: queued.filter((x) => x.status === 'draft').length,
      daysWritten: cfg.bankDays - unwritten.length,
      bankDays: cfg.bankDays,
    })
  }
  return {
    config: { dryRun: cfg.dryRun, autonomousAllowed: cfg.autonomousAllowed, autonomousSwitch: settings.autonomousEnabled, autonomousEffective: autonomousEffective(cfg, settings.autonomousEnabled), timezone: cfg.timezone, aiConfigured: aiConfig().configured, bankDays: cfg.bankDays },
    platforms,
    budget,
    brief: briefs[0] ?? null,
    decisions: ((insights?.data as { decisions?: unknown[] } | undefined)?.decisions ?? []) as { dimension: string; key: string; action: string; reason: string }[],
    recommendations: insights?.recommendations ?? [],
    insightsAt: insights?.computedAt ?? null,
    audit,
  }
}

export interface ScheduleSlot { index: number | null; time: string; at: string; role: string | null; roleLabel: string | null; format: string; media: string; link: boolean; status: string; note: string | null; post: ConsolePost | null }
export interface ScheduleDay { date: string; weekday: string; slots: ScheduleSlot[]; unwritten: number }

export async function platformOverview(store: MarketingStore, cfg: MarketingConfig, platform: Platform, now = new Date(), days = 30) {
  const settings = await store.getSettings()
  const cad = cadenceFor(cfg, platform)
  const today = localDate(now, cfg.timezone)
  const end = addDays(today, days)
  const posts = await store.listPosts({ platform, since: new Date(now.getTime() - 60 * 86_400_000).toISOString(), limit: 5000 })
  const live = posts.filter((p) => p.status !== 'cancelled' && p.source !== 'imported')
  const at = (p: MarketingPost) => p.publishedAt ?? p.dryRunAt ?? p.scheduledAt ?? p.createdAt
  const upcomingPosts = live.filter((p) => { const d = localDate(new Date(at(p)), cfg.timezone); return d >= today && d < end })
  const byId = new Map((await views(store, cfg, upcomingPosts)).map((v) => [v.id, v]))

  // Plans for every week in the window → slots; posts fill their slots; posts outside a plan are listed too.
  const slots: PlanSlot[] = []
  for (let w = weekStartOf(today); w < end; w = addDays(w, 7)) slots.push(...planSlots(await store.getPlan(platform, w)))
  const dayMap = new Map<string, ScheduleDay>()
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i)
    dayMap.set(d, { date: d, weekday: new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }), slots: [], unwritten: 0 })
  }
  const used = new Set<string>()
  for (const s of slots) {
    const day = dayMap.get(s.date)
    if (!day) continue
    const post = upcomingPosts.find((p) => p.planId && p.slotIndex === s.index && p.status !== 'cancelled' && localDate(new Date(at(p)), cfg.timezone) === s.date)
    if (post) used.add(post.id)
    const unwritten = !post && s.status === 'planned' && new Date(s.at).getTime() > now.getTime()
    if (unwritten) day.unwritten++
    day.slots.push({ index: s.index, time: s.time, at: s.at, role: s.role, roleLabel: SLOT_ROLE_LABEL[s.role], format: s.format, media: s.media.source, link: s.link, status: post ? post.status : unwritten ? 'unwritten' : s.status, note: s.note ?? null, post: post ? byId.get(post.id) ?? null : null })
  }
  for (const p of upcomingPosts) {
    if (used.has(p.id)) continue
    const day = dayMap.get(localDate(new Date(at(p)), cfg.timezone))
    if (!day) continue
    day.slots.push({ index: null, time: new Date(at(p)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: cfg.timezone }), at: at(p), role: p.slotRole, roleLabel: null, format: p.format, media: p.mediaIds.length ? 'media' : 'none', link: !!p.linkUrl, status: p.status, note: null, post: byId.get(p.id) ?? null })
  }
  // Weeks that aren't planned yet count as unwritten too (writing a day plans its week first).
  for (const date of await daysToWrite(store, cfg, { platform, now, horizonDays: days, limit: 60 })) {
    const day = dayMap.get(date)
    if (day && !day.unwritten) day.unwritten = day.slots.length ? day.slots.filter((s) => s.status === 'unwritten').length || cad.postsPerDay : cad.postsPerDay
  }
  for (const d of dayMap.values()) d.slots.sort((a, b) => a.at.localeCompare(b.at))

  const recent = posts.filter((p) => ['published', 'dry_run', 'failed'].includes(p.status) && p.source !== 'imported' && now.getTime() - new Date(at(p)).getTime() < 14 * 86_400_000).sort((a, b) => at(b).localeCompare(at(a))).slice(0, 30)
  const published = posts.filter((p) => p.status === 'published' && p.source !== 'imported' && now.getTime() - new Date(p.publishedAt!).getTime() < 30 * 86_400_000)
  const sum = (f: (p: MarketingPost) => number) => published.reduce((a, p) => a + f(p), 0)
  const rank = (key: (p: MarketingPost) => string | null) => {
    const g = new Map<string, MarketingPost[]>()
    for (const p of published) { const k = key(p); if (k) g.set(k, [...(g.get(k) ?? []), p]) }
    return [...g.entries()].map(([k, ps]) => ({ key: k, posts: ps.length, avgScore: Math.round((ps.reduce((a, p) => a + (p.businessScore ?? 0), 0) / ps.length) * 100) / 100, signups: ps.reduce((a, p) => a + p.attribution.signups, 0) })).sort((a, b) => b.avgScore - a.avgScore)
  }
  return {
    platform,
    label: LABEL[platform],
    enabled: cfg.platforms.includes(platform),
    paused: settings.pausedPlatforms.includes(platform),
    credentials: credentialsPresent(platform),
    dryRun: cfg.dryRun,
    autonomousEffective: autonomousEffective(cfg, settings.autonomousEnabled),
    cadence: { postsPerDay: cad.postsPerDay, postTimes: cad.postTimes, timezone: cfg.timezone, maxChars: cad.maxChars },
    days: [...dayMap.values()],
    recent: await views(store, cfg, recent),
    performance: {
      posts: published.length,
      impressions: sum((p) => p.metrics.impressions ?? 0),
      engagements: sum(engagements),
      linkClicks: sum((p) => p.metrics.linkClicks ?? 0),
      websiteVisits: sum((p) => p.attribution.landingVisits),
      signups: sum((p) => p.attribution.signups),
      partiesCreated: sum((p) => p.attribution.partiesCreated),
      purchases: sum((p) => p.attribution.purchases),
      topFormats: rank((p) => p.format),
      topRoles: rank((p) => p.slotRole),
      topHooks: rank((p) => hookStyle(p.hook, p.text)),
    },
    budget: platform === 'x' ? await budgetSnapshot(store, cfg, now) : null,
  }
}

/** Live connection check. X: $0.01 user read (budget-gated, metered). Instagram/Facebook: free. */
export async function checkConnection(store: MarketingStore, cfg: MarketingConfig, platform: Platform): Promise<{ ok: boolean; message: string; account?: { username: string; name: string | null; accessLevel?: string | null } }> {
  if (!credentialsPresent(platform)) return { ok: false, message: `${LABEL[platform]} credentials are missing in the server environment.` }
  const provider = getMarketingProvider(platform, cfg)
  if (platform === 'x') {
    const b = await budgetSnapshot(store, cfg)
    if (!allowX(b, b.prices.user_read, 'discretionary').ok) return { ok: false, message: 'The X budget is too tight for a connection check right now.' }
    provider.setMeter(xMeter(store, b.prices))
  }
  try {
    const me = await provider.verify()
    const canPost = platform !== 'x' || !me.accessLevel || /write/.test(me.accessLevel)
    await store.audit(null, null, 'connection_checked', { platform, ok: canPost, username: me.username })
    return { ok: canPost, message: canPost ? `Connected as ${platform === 'facebook' ? me.name ?? me.username : `@${me.username}`}.` : `Connected as @${me.username}, but the token can't post (${me.accessLevel}).`, account: { username: me.username, name: me.name, accessLevel: me.accessLevel } }
  } catch (e) {
    return { ok: false, message: e instanceof MarketingProviderError ? e.message : 'Connection check failed.' }
  } finally {
    provider.setMeter(null)
  }
}

/** Approve every valid draft of one platform-day (each keeps its slot time). */
export async function approveDay(store: MarketingStore, cfg: MarketingConfig, platform: Platform, date: string, actor: string, now = new Date()) {
  const drafts = (await store.listPosts({ platform, statuses: ['draft'], limit: 500 })).filter((p) => p.scheduledAt && localDate(new Date(p.scheduledAt), cfg.timezone) === date && new Date(p.scheduledAt).getTime() > now.getTime())
  let approved = 0
  const invalid: string[] = []
  for (const p of drafts) {
    const rules = platformRules(platform, cfg)
    const v = validatePost(p.text, { ...rules, pillar: p.pillar, allowedLink: p.linkUrl, forbiddenTerms: forbiddenTermsFromEnv(), minChars: p.format === 'poll' ? 10 : rules.minChars })
    if (!v.ok) { invalid.push(p.id); continue }
    if (await store.updatePost(p.id, { status: 'scheduled', autonomous: false, approved_at: now.toISOString(), approved_by: actor }, ['draft'])) {
      approved++
      await store.audit(p.id, actor, 'approved', { bulk: date })
    }
  }
  return { approved, invalid }
}

/** Write the earliest unwritten day of a platform (one AI call). The console calls this repeatedly to fill 30 days. */
export async function writeNextDay(store: MarketingStore, cfg: MarketingConfig, platform: Platform, actor: string, now = new Date()) {
  const todo = await daysToWrite(store, cfg, { platform, now, limit: 60 })
  if (!todo.length) return { date: null, remaining: 0 }
  const insights = await store.latestInsights()
  const r = await generateDay(store, cfg, { date: todo[0], now, platform, actor, budgetMs: 52_000, weights: (insights?.data as { weights?: object } | undefined)?.weights ?? {}, learnings: insights?.recommendations.slice(0, 8) ?? [] })
  return { date: todo[0], remaining: todo.length - 1, result: { generated: r.generated.length, library: r.library.length, skipped: r.skipped.length, aiSkipped: r.aiSkipped ?? null } }
}

/** Re-plan a platform from today: cancels its unpublished future posts and re-plans those weeks (the bank refills). */
export async function replanFrom(store: MarketingStore, cfg: MarketingConfig, platform: Platform, actor: string, now = new Date()) {
  const cutoff = now.getTime() + 30 * 60_000
  const future = (await store.listPosts({ platform, statuses: ['draft', 'approved', 'scheduled'], limit: 5000 })).filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() > cutoff)
  for (const p of future) await store.updatePost(p.id, { status: 'cancelled' }, ['draft', 'approved', 'scheduled'])
  const today = localDate(now, cfg.timezone)
  const insights = await store.latestInsights()
  const budget = await budgetSnapshot(store, cfg, now)
  const weeks: string[] = []
  for (let w = weekStartOf(today); w < addDays(today, cfg.bankDays); w = addDays(w, 7)) {
    await planWeek(store, cfg, { weekStart: w, now, budget, platform, force: true, weights: (insights?.data as { weights?: object } | undefined)?.weights ?? {} })
    weeks.push(w)
  }
  await store.audit(null, actor, 'replanned', { platform, cancelled: future.length, weeks })
  return { cancelled: future.length, weeks }
}
