/** Data for /admin/marketing/x (Super Admin only): budget, schedule, content bank, performance, decisions. SERVER ONLY. */
import 'server-only'
import { aiConfig } from '@/lib/ai/config'
import { budgetSnapshot } from './budget'
import { autonomousEffective, hasXCredentials, xUserIdFromEnv, type MarketingConfig } from './config'
import { hookStyle } from './learning'
import { planSlots, weekStartOf } from './planner'
import { engagements } from './scoring'
import type { MarketingStore } from './store'
import { addDays, localDate } from './time'
import { SLOT_ROLE_LABEL, type MarketingPost, type SlotRole } from './types'

export interface XPostView {
  id: string
  status: string
  format: string
  role: string | null
  roleLabel: string | null
  category: string | null
  scheduledAt: string | null
  publishedAt: string | null
  dryRunAt: string | null
  text: string
  poll: MarketingPost['poll']
  threadParts: string[] | null
  link: boolean
  source: string
  thumbs: { url: string | null; kind: string }[]
  externalPostUrl: string | null
  businessScore: number | null
  estCostUsd: number | null
  metrics: MarketingPost['metrics']
  attribution: MarketingPost['attribution']
  error: string | null
}

async function views(store: MarketingStore, posts: MarketingPost[]): Promise<XPostView[]> {
  const ids = [...new Set(posts.flatMap((p) => p.mediaIds))]
  const media = ids.length ? await store.listMedia({ ids }) : []
  const urls = new Map<string, string | null>()
  for (const m of media) urls.set(m.id, m.storage_path && m.kind === 'image' ? await store.signedMediaUrl(m.storage_path, 3600).catch(() => null) : null)
  return posts.map((p) => ({
    id: p.id,
    status: p.status,
    format: p.format,
    role: p.slotRole,
    roleLabel: p.slotRole && p.slotRole in SLOT_ROLE_LABEL ? SLOT_ROLE_LABEL[p.slotRole as SlotRole] : null,
    category: p.category,
    scheduledAt: p.scheduledAt,
    publishedAt: p.publishedAt,
    dryRunAt: p.dryRunAt,
    text: p.text,
    poll: p.poll,
    threadParts: p.threadParts,
    link: !!p.linkUrl,
    source: p.source,
    thumbs: p.mediaIds.map((id) => ({ url: urls.get(id) ?? null, kind: media.find((m) => m.id === id)?.kind ?? 'image' })),
    externalPostUrl: p.externalPostUrl,
    businessScore: p.businessScore,
    estCostUsd: p.estCostUsd,
    metrics: p.metrics,
    attribution: p.attribution,
    error: p.publishError,
  }))
}

function rankBy<T extends string>(posts: MarketingPost[], key: (p: MarketingPost) => T | null) {
  const g = new Map<string, MarketingPost[]>()
  for (const p of posts) {
    const k = key(p)
    if (k) g.set(k, [...(g.get(k) ?? []), p])
  }
  return [...g.entries()]
    .map(([k, ps]) => ({
      key: k,
      posts: ps.length,
      avgScore: Math.round((ps.reduce((a, p) => a + (p.businessScore ?? 0), 0) / ps.length) * 100) / 100,
      impressions: ps.reduce((a, p) => a + (p.metrics.impressions ?? 0), 0),
      clicks: ps.reduce((a, p) => a + (p.metrics.linkClicks ?? 0), 0),
      signups: ps.reduce((a, p) => a + p.attribution.signups, 0),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
}

export async function xOverview(store: MarketingStore, cfg: MarketingConfig, now = new Date()) {
  const settings = await store.getSettings()
  const budget = await budgetSnapshot(store, cfg, now)
  const today = localDate(now, cfg.timezone)
  const posts = await store.listPosts({ platform: 'x', since: new Date(now.getTime() - 45 * 86_400_000).toISOString(), limit: 3000 })
  const at = (p: MarketingPost) => p.publishedAt ?? p.dryRunAt ?? p.scheduledAt ?? p.createdAt
  const day = (p: MarketingPost) => localDate(new Date(at(p)), cfg.timezone)
  const live = posts.filter((p) => p.status !== 'cancelled')
  const todays = live.filter((p) => day(p) === today).sort((a, b) => at(a).localeCompare(at(b)))
  const upcoming = live.filter((p) => ['scheduled', 'approved', 'draft'].includes(p.status) && day(p) > today && day(p) <= addDays(today, 3)).sort((a, b) => at(a).localeCompare(at(b)))
  const published = posts.filter((p) => p.status === 'published' && p.source !== 'imported' && now.getTime() - new Date(p.publishedAt!).getTime() < 30 * 86_400_000)
  const sum = (f: (p: MarketingPost) => number) => published.reduce((a, p) => a + f(p), 0)

  const weeks = [weekStartOf(today), addDays(weekStartOf(today), 7)]
  const plans: { weekStart: string; status: string; slots: { index: number; date: string; time: string; role: string; format: string; media: string; link: boolean; status: string; postId: string | null; note: string | null }[] }[] = []
  for (const w of weeks) {
    const p = await store.getPlan('x', w)
    if (p) plans.push({ weekStart: w, status: p.status, slots: planSlots(p).map((s) => ({ index: s.index, date: s.date, time: s.time, role: s.role, format: s.format, media: s.media.source, link: s.link, status: s.status, postId: s.postId ?? null, note: s.note ?? null })) })
  }
  const media = await store.listMedia({})
  const insights = await store.latestInsights()
  const ai = aiConfig()
  return {
    config: {
      dryRun: cfg.dryRun,
      autonomousAllowed: cfg.autonomousAllowed,
      autonomousSwitch: settings.autonomousEnabled,
      autonomousEffective: autonomousEffective(cfg, settings.autonomousEnabled),
      postsPerDay: cfg.postsPerDay,
      postTimes: cfg.postTimes.slice(0, cfg.postsPerDay),
      timezone: cfg.timezone,
      utmCampaign: cfg.utmCampaign,
      altText: cfg.altText,
      xConfigured: hasXCredentials(),
      xUserIdKnown: !!xUserIdFromEnv(),
      aiConfigured: ai.configured,
    },
    budget,
    today: await views(store, todays),
    upcoming: await views(store, upcoming),
    plans,
    bank: {
      queued: live.filter((p) => ['scheduled', 'approved'].includes(p.status) && at(p) >= now.toISOString()).length,
      drafts: live.filter((p) => p.status === 'draft').length,
      byFormat: rankBy(live.filter((p) => ['scheduled', 'approved', 'draft'].includes(p.status)), (p) => p.format).map((g) => ({ key: g.key, count: g.posts })),
      library: {
        approved: media.filter((m) => m.source === 'library' && m.privacy_status === 'approved').length,
        rejected: media.filter((m) => m.privacy_status === 'rejected').length,
        videos: media.filter((m) => m.source === 'library' && m.kind === 'video' && m.privacy_status === 'approved').length,
        carousels: new Set(media.filter((m) => m.source === 'library' && m.set_key && m.privacy_status === 'approved').map((m) => m.set_key)).size,
        templatesRendered: media.filter((m) => m.source === 'template').length,
        neverUsed: media.filter((m) => m.source === 'library' && m.privacy_status === 'approved' && m.used_count === 0).length,
      },
    },
    performance: {
      posts: published.length,
      impressions: sum((p) => p.metrics.impressions ?? 0),
      engagements: sum(engagements),
      profileVisits: sum((p) => p.metrics.profileVisits ?? 0),
      linkClicks: sum((p) => p.metrics.linkClicks ?? 0),
      websiteVisits: sum((p) => p.attribution.landingVisits),
      signups: sum((p) => p.attribution.signups),
      partiesCreated: sum((p) => p.attribution.partiesCreated),
      checkouts: sum((p) => p.attribution.checkouts),
      purchases: sum((p) => p.attribution.purchases),
      revenueMinor: sum((p) => p.attribution.revenueMinor),
      topPosts: (await views(store, [...published].sort((a, b) => (b.businessScore ?? 0) - (a.businessScore ?? 0)).slice(0, 5))),
      topFormats: rankBy(published, (p) => p.format),
      topRoles: rankBy(published, (p) => p.slotRole),
      topHooks: rankBy(published, (p) => hookStyle(p.hook, p.text)),
      topCtas: rankBy(published, (p) => p.cta),
    },
    decisions: ((insights?.data as { decisions?: unknown[] } | undefined)?.decisions ?? []) as { dimension: string; key: string; action: string; multiplier: number; reason: string }[],
    recommendations: insights?.recommendations ?? [],
    insightsAt: insights?.computedAt ?? null,
  }
}
