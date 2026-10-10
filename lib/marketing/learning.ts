/**
 * The learning loop. From stored metrics only (platform + MBP attribution) it computes what works — by pillar, topic,
 * hook style, CTA, posting time, link and image — writes plain-language recommendations that quote the real numbers
 * and sample sizes, and turns them into gentle pillar-weight multipliers (0.75–1.35) for the next posts.
 * With too little data it says so and changes nothing. Pure functions (no I/O) except runLearning().
 */
import type { MarketingStore, Insights } from './store'
import { localHour } from './time'
import { PILLAR_LABEL, type MarketingPost, type Pillar } from './types'

export const LEARNING = { minPostsForInsights: 3, minPostsPerGroup: 2, minImpressionsPerGroup: 100, minPostsForWeights: 6, ratioWorthMentioning: 1.3 } as const

export type HookStyle = 'question' | 'story' | 'tip' | 'statement'
export function hookStyle(hook: string | null, text: string): HookStyle {
  const h = (hook || text.split('\n')[0] || '').trim()
  if (/\?\s*$/.test(h)) return 'question'
  if (/^(i|i'm|i’m|i've|i’ve|my|we|we're|we’re)\b/i.test(h)) return 'story'
  if (/^(\d|before|don't|don’t|here's|here’s|how|try|tip|one (simple|easy|small))/i.test(h)) return 'tip'
  return 'statement'
}

export function timeBucket(iso: string, tz: string): 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' {
  const h = localHour(new Date(iso), tz)
  return h < 5 ? 'night' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'
}

export interface GroupStats {
  key: string
  posts: number
  impressions: number
  postsWithImpressions: number
  engagements: number
  profileVisits: number
  linkClicks: number
  landingVisits: number
  signups: number
  partiesCreated: number
  purchases: number
  revenueMinor: number
  engagementRate: number | null
  profileVisitRate: number | null
  linkClickRate: number | null
  signupsPerPost: number
  /** sign-ups per attributed landing visit */
  signupConversion: number | null
  partyConversion: number | null
  paidConversion: number | null
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
const rate = (num: number, den: number) => (den > 0 ? num / den : null)

export function groupStats(key: string, posts: MarketingPost[]): GroupStats {
  const withImp = posts.filter((p) => (p.metrics.impressions ?? 0) > 0)
  const impressions = sum(withImp.map((p) => p.metrics.impressions))
  const engagements = sum(withImp.flatMap((p) => [p.metrics.likes, p.metrics.reposts, p.metrics.replies, p.metrics.quotes, p.metrics.bookmarks]))
  const pvPosts = withImp.filter((p) => p.metrics.profileVisits !== null)
  const lcPosts = withImp.filter((p) => p.linkUrl && p.metrics.linkClicks !== null)
  const a = (f: (p: MarketingPost) => number) => sum(posts.map(f))
  const landingVisits = a((p) => p.attribution.landingVisits)
  const signups = a((p) => p.attribution.signups)
  const partiesCreated = a((p) => p.attribution.partiesCreated)
  const purchases = a((p) => p.attribution.purchases)
  return {
    key,
    posts: posts.length,
    impressions,
    postsWithImpressions: withImp.length,
    engagements,
    profileVisits: sum(pvPosts.map((p) => p.metrics.profileVisits)),
    linkClicks: sum(lcPosts.map((p) => p.metrics.linkClicks)),
    landingVisits,
    signups,
    partiesCreated,
    purchases,
    revenueMinor: a((p) => p.attribution.revenueMinor),
    engagementRate: rate(engagements, impressions),
    profileVisitRate: pvPosts.length ? rate(sum(pvPosts.map((p) => p.metrics.profileVisits)), sum(pvPosts.map((p) => p.metrics.impressions))) : null,
    linkClickRate: lcPosts.length ? rate(sum(lcPosts.map((p) => p.metrics.linkClicks)), sum(lcPosts.map((p) => p.metrics.impressions))) : null,
    signupsPerPost: posts.length ? signups / posts.length : 0,
    signupConversion: rate(signups, landingVisits),
    partyConversion: rate(partiesCreated, signups),
    paidConversion: rate(purchases, signups),
  }
}

function groupBy(posts: MarketingPost[], key: (p: MarketingPost) => string | null): GroupStats[] {
  const m = new Map<string, MarketingPost[]>()
  for (const p of posts) {
    const k = key(p)
    if (!k) continue
    m.set(k, [...(m.get(k) ?? []), p])
  }
  return [...m.entries()].map(([k, ps]) => groupStats(k, ps))
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`)
const label = (k: string) => (k in PILLAR_LABEL ? PILLAR_LABEL[k as Pillar] : k)
const eligible = (g: GroupStats) => g.posts >= LEARNING.minPostsPerGroup && g.impressions >= LEARNING.minImpressionsPerGroup

/** "A got 2.4× the X of B" — only between eligible groups and only when the gap is meaningful. */
function compare(groups: GroupStats[], metric: 'engagementRate' | 'profileVisitRate' | 'linkClickRate', metricName: string, noun: string): string | null {
  const ok = groups.filter((g) => eligible(g) && g[metric] !== null)
  if (ok.length < 2) return null
  ok.sort((a, b) => b[metric]! - a[metric]!)
  const [best, worst] = [ok[0], ok[ok.length - 1]]
  if (!worst[metric] || best[metric]! / worst[metric]! < LEARNING.ratioWorthMentioning) {
    if (worst[metric] === 0 && best[metric]! > 0) return `${label(best.key)} ${noun} had the best ${metricName} (${pct(best[metric])}, ${best.posts} posts); ${label(worst.key)} ${noun} got none (${worst.posts} posts).`
    return null
  }
  return `${label(best.key)} ${noun} got ${(best[metric]! / worst[metric]!).toFixed(1)}× the ${metricName} of ${label(worst.key)} ${noun} (${pct(best[metric])} vs ${pct(worst[metric])}; ${best.posts} vs ${worst.posts} posts).`
}

export interface LearningResult {
  sampleSize: number
  data: Record<string, unknown>
  recommendations: string[]
  pillarMultipliers: Partial<Record<Pillar, number>>
}

export function computeInsights(published: MarketingPost[], opts: { tz: string; windowDays: number; now?: Date }): LearningResult {
  const now = opts.now ?? new Date()
  const since = now.getTime() - opts.windowDays * 86_400_000
  const posts = published.filter((p) => p.status === 'published' && p.publishedAt && new Date(p.publishedAt).getTime() >= since)
  const overall = groupStats('all', posts)
  const byPillar = groupBy(posts, (p) => p.pillar)
  const byHook = groupBy(posts, (p) => hookStyle(p.hook, p.text))
  const byTime = groupBy(posts, (p) => timeBucket(p.publishedAt!, opts.tz))
  const byLink = groupBy(posts, (p) => (p.linkUrl ? 'with link' : 'no link'))
  const byImage = groupBy(posts, (p) => (p.imagePath ? 'with image' : 'text only'))
  const byTopic = groupBy(posts, (p) => p.topicKey)
  const byCta = groupBy(posts, (p) => p.cta)
  const topPosts = [...posts]
    .filter((p) => (p.metrics.impressions ?? 0) > 0)
    .sort((a, b) => groupStats('', [b]).engagementRate! - groupStats('', [a]).engagementRate! || (b.metrics.impressions ?? 0) - (a.metrics.impressions ?? 0))
    .slice(0, 5)
    .map((p) => ({ id: p.id, pillar: p.pillar, hook: p.hook, impressions: p.metrics.impressions, engagementRate: groupStats('', [p]).engagementRate, signups: p.attribution.signups }))
  const rank = (gs: GroupStats[], f: (g: GroupStats) => number | null) => gs.filter((g) => f(g) !== null).sort((a, b) => f(b)! - f(a)!).slice(0, 5).map((g) => ({ key: g.key, posts: g.posts, value: f(g) }))

  const data = {
    windowDays: opts.windowDays,
    overall,
    byPillar,
    byHookStyle: byHook,
    byTime,
    byLink,
    byImage,
    topPillars: rank(byPillar, (g) => g.engagementRate),
    topTopics: rank(byTopic, (g) => g.engagementRate),
    topCtas: rank(byCta, (g) => g.linkClickRate ?? g.engagementRate),
    bestTimes: rank(byTime, (g) => g.engagementRate),
    topPosts,
    averages: { engagementRate: overall.engagementRate, profileVisitRate: overall.profileVisitRate, linkClickRate: overall.linkClickRate, signupConversion: overall.signupConversion, partyConversion: overall.partyConversion, paidConversion: overall.paidConversion },
  }

  const recommendations: string[] = []
  const multipliers: Partial<Record<Pillar, number>> = {}
  if (posts.length < LEARNING.minPostsForInsights || overall.postsWithImpressions < LEARNING.minPostsForInsights) {
    if (posts.length && !overall.postsWithImpressions) recommendations.push('X returned no impression data for these posts (API access level), so learning uses MBP-side attribution only.')
    recommendations.push(`Not enough data yet (${posts.length} published post${posts.length === 1 ? '' : 's'} in ${opts.windowDays} days) — keep the default mix.`)
    return { sampleSize: posts.length, data, recommendations, pillarMultipliers: multipliers }
  }

  for (const r of [
    compare(byPillar, 'profileVisitRate', 'profile-visit rate', 'posts'),
    compare(byPillar, 'linkClickRate', 'link-click rate', 'posts'),
    compare(byPillar, 'engagementRate', 'engagement rate', 'posts'),
    compare(byHook, 'engagementRate', 'engagement rate', 'hooks'),
    compare(byTime, 'engagementRate', 'engagement rate', 'posts'),
    compare(byImage, 'engagementRate', 'engagement rate', 'posts'),
  ]) if (r) recommendations.push(r)

  const converting = byPillar.filter((g) => g.signups > 0).sort((a, b) => b.signupsPerPost - a.signupsPerPost)
  if (converting.length) {
    const g = converting[0]
    const lowEngagement = g.engagementRate !== null && overall.engagementRate !== null && g.engagementRate < overall.engagementRate
    recommendations.push(`${label(g.key)} posts drove the most sign-ups (${g.signups} from ${g.posts} posts${g.landingVisits ? `, ${pct(g.signupConversion)} of ${g.landingVisits} visits` : ''})${lowEngagement ? ' despite below-average engagement' : ''}.`)
  }
  if (overall.partiesCreated) recommendations.push(`Attributed so far: ${overall.signups} sign-ups → ${overall.partiesCreated} parties created → ${overall.purchases} purchases.`)
  if (!recommendations.length) recommendations.push('No pillar, hook or time clearly outperforms the others yet — keep the default mix.')

  if (posts.length >= LEARNING.minPostsForWeights) {
    const comps: (keyof GroupStats)[] = ['profileVisitRate', 'engagementRate', 'linkClickRate', 'signupsPerPost']
    const weights: Record<string, number> = { profileVisitRate: 0.3, engagementRate: 0.3, linkClickRate: 0.2, signupsPerPost: 0.2 }
    const elig = byPillar.filter(eligible)
    for (const g of elig) {
      let score = 0
      let used = 0
      for (const c of comps) {
        const vals = elig.map((x) => x[c] as number | null).filter((v): v is number => v !== null)
        const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
        const v = g[c] as number | null
        if (v === null || !mean) continue
        score += weights[c] * (v / mean)
        used += weights[c]
      }
      if (used) multipliers[g.key as Pillar] = Math.round(Math.min(1.35, Math.max(0.75, 1 + 0.5 * (score / used - 1))) * 100) / 100
    }
  }
  return { sampleSize: posts.length, data, recommendations, pillarMultipliers: multipliers }
}

/** Recompute insights when the last run is older than the interval (or when forced). */
export async function runLearning(store: MarketingStore, opts: { tz: string; windowDays: number; intervalDays: number; now?: Date; force?: boolean }): Promise<Insights | null> {
  const now = opts.now ?? new Date()
  const last = await store.latestInsights()
  if (!opts.force && last && now.getTime() - new Date(last.computedAt).getTime() < opts.intervalDays * 86_400_000 - 3_600_000) return null
  const posts = await store.listPosts({ statuses: ['published'], since: new Date(now.getTime() - (opts.windowDays + 7) * 86_400_000).toISOString(), limit: 1000 })
  const r = computeInsights(posts, { tz: opts.tz, windowDays: opts.windowDays, now })
  const d = computeDecisions(posts, { now, windowDays: opts.windowDays })
  const recommendations = [...d.decisions.map((x) => x.reason), ...r.recommendations]
  return store.saveInsights({ windowDays: opts.windowDays, sampleSize: r.sampleSize, data: { ...r.data, decisions: d.decisions, weights: d.weights, businessScore: d.overall }, recommendations, pillarMultipliers: r.pillarMultipliers })
}

// ---- decision engine (growth engine) --------------------------------------------------------------------------------

export interface Decision { dimension: 'role' | 'format' | 'category' | 'hook' | 'time'; key: string; action: 'increase' | 'decrease' | 'keep'; multiplier: number; reason: string }
export interface DecisionResult { decisions: Decision[]; weights: { roles: Record<string, number>; formats: Record<string, number> }; overall: { posts: number; avgScore: number; costPerPost: number | null } }

const ROLE_NAME: Record<string, string> = { founder_story: 'Founder stories', parent_tip: 'Parent tips', conversation: 'Conversation posts', visual: 'Visual posts', educational: 'Educational posts', product: 'Product posts', poll: 'Polls', soft_conversion: 'Soft-conversion posts' }
const FORMAT_NAME: Record<string, string> = { text: 'Text posts', image: 'Image posts', carousel: 'Carousels', poll: 'Polls', video: 'Videos', thread: 'Threads' }
const nameOf = (dim: Decision['dimension'], k: string) => (dim === 'role' ? ROLE_NAME[k] : dim === 'format' ? FORMAT_NAME[k] : undefined) ?? (k in PILLAR_LABEL ? `${PILLAR_LABEL[k as Pillar]} posts` : `“${k}” posts`)
const fmt = (n: number) => (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(2))

/**
 * "Founder stories are converting better than feature posts → increase founder stories." From stored business scores
 * only; groups need ≥ 3 scored posts. Engagement without demand (likes, no clicks/sign-ups) is called out, not rewarded;
 * formats whose score per dollar is poor are reduced. Multipliers are bounded (0.5–1.5) and feed the weekly planner.
 */
export function computeDecisions(published: MarketingPost[], opts: { now?: Date; windowDays: number }): DecisionResult {
  const now = opts.now ?? new Date()
  const posts = published.filter((p) => p.status === 'published' && p.source !== 'imported' && p.publishedAt && p.businessScore !== null && now.getTime() - new Date(p.publishedAt).getTime() <= opts.windowDays * 86_400_000)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const overallScore = avg(posts.map((p) => p.businessScore!))
  const costs = posts.map((p) => p.estCostUsd).filter((c): c is number => c !== null && c > 0)
  const overall = { posts: posts.length, avgScore: Math.round(overallScore * 1000) / 1000, costPerPost: costs.length ? Math.round(avg(costs) * 10_000) / 10_000 : null }
  const decisions: Decision[] = []
  const weights = { roles: {} as Record<string, number>, formats: {} as Record<string, number> }
  if (posts.length < 6 || overallScore <= 0) return { decisions, weights, overall }
  const overallEng = avg(posts.map((p) => groupStats('', [p]).engagementRate ?? 0))
  const scorePerDollar = (ps: MarketingPost[]) => {
    const c = ps.reduce((a, p) => a + (p.estCostUsd ?? 0), 0)
    return c > 0 ? ps.reduce((a, p) => a + (p.businessScore ?? 0), 0) / c : null
  }
  const overallSPD = scorePerDollar(posts)

  const dims: [Decision['dimension'], (p: MarketingPost) => string | null][] = [
    ['role', (p) => p.slotRole],
    ['format', (p) => p.format],
    ['category', (p) => p.category],
    ['hook', (p) => hookStyle(p.hook, p.text)],
  ]
  for (const [dim, key] of dims) {
    const groups = new Map<string, MarketingPost[]>()
    for (const p of posts) {
      const k = key(p)
      if (k) groups.set(k, [...(groups.get(k) ?? []), p])
    }
    for (const [k, ps] of groups) {
      if (ps.length < 3) continue
      const score = avg(ps.map((p) => p.businessScore!))
      const ratio = score / overallScore
      const conversions = ps.reduce((a, p) => a + p.attribution.signups + p.attribution.landingVisits + (p.metrics.linkClicks ?? 0), 0)
      const eng = avg(ps.map((p) => groupStats('', [p]).engagementRate ?? 0))
      const spd = scorePerDollar(ps)
      const label = nameOf(dim, k)
      if (eng >= overallEng * 1.3 && conversions === 0 && overallEng > 0) {
        decisions.push({ dimension: dim, key: k, action: 'keep', multiplier: 1, reason: `${label} get engagement (${(eng * 100).toFixed(1)}% vs ${(overallEng * 100).toFixed(1)}% average, ${ps.length} posts) but no clicks or sign-ups — keep them for reach, don’t expect conversions.` })
        if (dim === 'role') weights.roles[k] = 1
        if (dim === 'format') weights.formats[k] = 1
        continue
      }
      if (dim === 'format' && spd !== null && overallSPD !== null && overallSPD > 0 && spd < overallSPD * 0.5) {
        const m = Math.max(0.5, Math.round((spd / overallSPD) * 100) / 100)
        decisions.push({ dimension: dim, key: k, action: 'decrease', multiplier: m, reason: `${label} cost too much for their results (${fmt(spd)} score per $ vs ${fmt(overallSPD)} average, ${ps.length} posts) — use fewer.` })
        weights.formats[k] = m
        continue
      }
      if (ratio >= 1.3) {
        const m = Math.min(1.5, Math.round((1 + (ratio - 1) / 2) * 100) / 100)
        decisions.push({ dimension: dim, key: k, action: 'increase', multiplier: m, reason: `${label} score ${ratio.toFixed(1)}× the average (${fmt(score)} vs ${fmt(overallScore)}, ${ps.length} posts${ps.some((p) => p.attribution.signups) ? `, ${ps.reduce((a, p) => a + p.attribution.signups, 0)} sign-ups` : ''}) — do more.` })
        if (dim === 'role') weights.roles[k] = m
        if (dim === 'format') weights.formats[k] = m
      } else if (ratio <= 0.7) {
        const m = Math.max(0.5, Math.round(ratio * 100) / 100)
        decisions.push({ dimension: dim, key: k, action: 'decrease', multiplier: m, reason: `${label} score ${ratio.toFixed(1)}× the average (${fmt(score)} vs ${fmt(overallScore)}, ${ps.length} posts) — do less.` })
        if (dim === 'role') weights.roles[k] = m
        if (dim === 'format') weights.formats[k] = m
      }
    }
  }
  return { decisions, weights, overall }
}
