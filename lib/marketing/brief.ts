/**
 * Daily founder brief: yesterday's posts and real numbers, the best recent post and the data behind it, and what to
 * post next. Metrics the API didn't return are shown as "n/a" — never invented. Stored per local date; optionally
 * emailed to MARKETING_BRIEF_EMAIL.
 */
import type { BudgetSnapshot } from './budget'
import type { MarketingConfig } from './config'
import { groupStats, hookStyle, timeBucket } from './learning'
import { PILLAR_SPECS } from './pillars'
import type { Brief, MarketingStore } from './store'
import { selectPillar, selectTopic, toStrategyPost } from './strategy'
import { addDays, localDate, zonedToUtc } from './time'
import { PILLAR_LABEL, type MarketingPost } from './types'

export interface CampaignCounts { landingVisits: number; signups: number; partiesCreated: number; checkouts: number; purchases: number }
export type CampaignCounter = (start: Date, end: Date) => Promise<CampaignCounts | null>

const n = (v: number | null) => (v === null ? 'n/a' : v.toLocaleString('en-US'))
const total = (posts: MarketingPost[], f: (p: MarketingPost) => number | null) => {
  const vals = posts.map(f).filter((v): v is number => v !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}
const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`)

export async function buildDailyBrief(store: MarketingStore, cfg: MarketingConfig, opts: { now?: Date; autonomous: boolean; countCampaign?: CampaignCounter; budget?: BudgetSnapshot }) {
  const now = opts.now ?? new Date()
  const today = localDate(now, cfg.timezone)
  const yesterday = addDays(today, -1)
  const [start, end] = [zonedToUtc(yesterday, '00:00', cfg.timezone), zonedToUtc(today, '00:00', cfg.timezone)]
  const all = await store.listPosts({ since: new Date(now.getTime() - 75 * 86_400_000).toISOString(), limit: 1000 })
  const inWindow = (iso: string | null) => !!iso && new Date(iso) >= start && new Date(iso) < end
  const posted = all.filter((p) => p.status === 'published' && inWindow(p.publishedAt))
  const simulated = all.filter((p) => p.status === 'dry_run' && inWindow(p.dryRunAt))
  const campaign = opts.countCampaign ? await opts.countCampaign(start, end).catch(() => null) : null

  const totals = {
    posts: posted.length,
    impressions: total(posted, (p) => p.metrics.impressions),
    likes: total(posted, (p) => p.metrics.likes),
    reposts: total(posted, (p) => p.metrics.reposts),
    replies: total(posted, (p) => p.metrics.replies),
    bookmarks: total(posted, (p) => p.metrics.bookmarks),
    profileVisits: total(posted, (p) => p.metrics.profileVisits),
    linkClicks: total(posted, (p) => p.metrics.linkClicks),
    websiteVisits: campaign?.landingVisits ?? null,
    signups: campaign?.signups ?? null,
    partiesCreated: campaign?.partiesCreated ?? null,
    checkouts: campaign?.checkouts ?? null,
    purchases: campaign?.purchases ?? null,
  }

  // Best post: yesterday's if any had impressions, else the best of the last 7 days.
  const published30 = all.filter((p) => p.status === 'published' && p.publishedAt && now.getTime() - new Date(p.publishedAt).getTime() < 30 * 86_400_000)
  const candidates = (posted.some((p) => (p.metrics.impressions ?? 0) > 0) ? posted : published30.filter((p) => now.getTime() - new Date(p.publishedAt!).getTime() < 7 * 86_400_000)).filter((p) => (p.metrics.impressions ?? 0) > 0)
  const er = (p: MarketingPost) => groupStats('', [p]).engagementRate ?? 0
  const best = candidates.sort((a, b) => er(b) - er(a) || (b.metrics.impressions ?? 0) - (a.metrics.impressions ?? 0))[0] ?? null
  const avg = groupStats('all', published30)
  const why: string[] = []
  if (best) {
    const g = groupStats('', [best])
    why.push(`Engagement rate ${pct(g.engagementRate)} vs ${pct(avg.engagementRate)} average over the last 30 days (${published30.length} posts).`)
    if (g.profileVisitRate !== null && avg.profileVisitRate !== null) why.push(`Profile-visit rate ${pct(g.profileVisitRate)} vs ${pct(avg.profileVisitRate)} average.`)
    why.push(`Pillar: ${PILLAR_LABEL[best.pillar]}; hook style: ${hookStyle(best.hook, best.text)}; posted in the ${timeBucket(best.publishedAt!, cfg.timezone)}${best.imagePath ? '; with an image' : ''}${best.linkUrl ? '; with the link' : ''}.`)
    if (best.attribution.signups) why.push(`It brought ${best.attribution.signups} sign-up${best.attribution.signups === 1 ? '' : 's'}.`)
  }

  // Tomorrow: what's queued, else what the strategy would pick.
  const tomorrow = addDays(today, 1)
  const queued = all.filter((p) => ['scheduled', 'approved'].includes(p.status) && p.scheduledAt && localDate(new Date(p.scheduledAt), cfg.timezone) === tomorrow)
  const insights = await store.latestInsights()
  const history = all.map(toStrategyPost)
  const next = selectPillar(history, { now: zonedToUtc(tomorrow, cfg.postTimes[0], cfg.timezone), tz: cfg.timezone, launchDate: cfg.launchDate, multipliers: insights?.pillarMultipliers })
  const topic = selectTopic(next.pillar, history, now)
  const drafts = all.filter((p) => p.status === 'draft').length

  const data = {
    date: yesterday,
    timezone: cfg.timezone,
    mode: { dryRun: cfg.dryRun, autonomous: opts.autonomous },
    totals,
    simulatedPosts: simulated.length,
    best: best ? { id: best.id, text: best.text, url: best.externalPostUrl, pillar: best.pillar } : null,
    why,
    queuedTomorrow: queued.map((p) => ({ id: p.id, pillar: p.pillar, scheduledAt: p.scheduledAt, hook: p.hook })),
    recommendation: { pillar: next.pillar, reason: next.reason, topic: topic.angle },
    insights: insights?.recommendations ?? [],
    draftsAwaitingReview: drafts,
    budget: opts.budget ? { month: opts.budget.month, x: { spent: opts.budget.x.spent, budget: opts.budget.x.budget, projected: opts.budget.x.projected, status: opts.budget.x.status }, ai: { spent: opts.budget.ai.spent, budget: opts.budget.ai.budget, status: opts.budget.ai.status } } : null,
  }

  const lines = [
    'MBP MARKETING BRIEF',
    `${yesterday} (${cfg.timezone})${cfg.dryRun ? ' · DRY-RUN mode (nothing is posted)' : ''} · autonomous publishing ${opts.autonomous ? 'ON' : 'OFF'}`,
    '',
    'Yesterday:',
    `Posts: ${totals.posts}${simulated.length ? ` (+${simulated.length} simulated in dry-run)` : ''}`,
    `Impressions: ${n(totals.impressions)}`,
    `Likes: ${n(totals.likes)}`,
    `Reposts: ${n(totals.reposts)}`,
    `Replies: ${n(totals.replies)}`,
    `Bookmarks: ${n(totals.bookmarks)}`,
    `Profile visits: ${n(totals.profileVisits)}`,
    `Link clicks (X): ${n(totals.linkClicks)}`,
    `Website visits (from X links): ${n(totals.websiteVisits)}`,
    `Signups: ${n(totals.signups)}`,
    `Parties created: ${n(totals.partiesCreated)}`,
    `Checkouts started: ${n(totals.checkouts)}`,
    `Purchases: ${n(totals.purchases)}`,
    '',
    'Best post:',
    best ? `"${best.text}"${best.externalPostUrl ? `\n${best.externalPostUrl}` : ''}` : 'No published post with metrics yet.',
    ...(why.length ? ['', 'Why it worked (data):', ...why.map((w) => `- ${w}`)] : []),
    '',
    'Recommended content tomorrow:',
    queued.length
      ? queued.map((p) => `- Already scheduled: ${PILLAR_LABEL[p.pillar]} — "${p.hook ?? p.text.slice(0, 80)}"`).join('\n')
      : `- ${PILLAR_LABEL[next.pillar]}: ${topic.angle}. ${next.reason}`,
    ...(PILLAR_SPECS[next.pillar].link === 'always' ? ['- Carries the product link.'] : []),
    ...(data.insights.length ? ['', 'What the data says:', ...data.insights.map((r) => `- ${r}`)] : []),
    ...(opts.budget
      ? ['', `Budget ${opts.budget.month}: X $${opts.budget.x.spent.toFixed(2)} of $${opts.budget.x.budget.toFixed(2)} (projected $${opts.budget.x.projected.toFixed(2)}, ${opts.budget.x.status}) · AI $${opts.budget.ai.spent.toFixed(2)} of $${opts.budget.ai.budget.toFixed(2)} (${opts.budget.ai.status})`]
      : []),
    ...(drafts ? ['', `${drafts} draft${drafts === 1 ? '' : 's'} waiting for review in /admin/marketing.`] : []),
  ]
  return { date: today, data, text: lines.join('\n') }
}

/** Build (once per local day) and optionally email the brief. */
export async function runDailyBrief(store: MarketingStore, cfg: MarketingConfig, opts: { now?: Date; autonomous: boolean; countCampaign?: CampaignCounter; send?: (to: string, subject: string, text: string, date: string) => Promise<boolean>; force?: boolean; budget?: BudgetSnapshot }): Promise<Brief | null> {
  const now = opts.now ?? new Date()
  const today = localDate(now, cfg.timezone)
  const existing = await store.getBrief(today)
  if (existing && !opts.force) return null
  const b = await buildDailyBrief(store, cfg, opts)
  const saved = await store.saveBrief({ date: b.date, timezone: cfg.timezone, data: b.data, text: b.text })
  if (cfg.briefEmail && opts.send && !existing?.emailedAt) {
    if (await opts.send(cfg.briefEmail, `MBP marketing brief — ${b.data.date}`, b.text, b.date)) await store.markBriefEmailed(b.date)
  }
  return saved
}
