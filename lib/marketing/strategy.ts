/**
 * Content strategy: the current objective, which pillar and topic come next, whether the post carries the link and an
 * image, and the UTM link itself. Deterministic (same history → same choice), so it is testable and explainable.
 */
import { PRODUCT_URL } from './facts'
import { PILLAR_SPECS, defaultWeights } from './pillars'
import { addDays, localDate } from './time'
import { PILLAR_LABEL, type MarketingPost, type Pillar, type Platform } from './types'

export interface StrategyPost {
  id: string
  pillar: Pillar
  topicKey: string | null
  status: string
  hasLink: boolean
  hasImage: boolean
  /** published_at ?? scheduled_at ?? created_at */
  at: string
}

export function toStrategyPost(p: MarketingPost): StrategyPost {
  return { id: p.id, pillar: p.pillar, topicKey: p.topicKey, status: p.status, hasLink: !!p.linkUrl, hasImage: !!p.imagePath, at: p.publishedAt ?? p.scheduledAt ?? p.createdAt }
}

export interface Objective { phase: 'pre_launch' | 'launch_week' | 'growth'; goal: string; focusMetrics: string[] }

export function currentObjective(now: Date, launchDate: string, tz: string): Objective {
  const today = localDate(now, tz)
  if (today < launchDate) {
    return { phase: 'pre_launch', goal: `Launch is ${launchDate}. Build awareness and real conversations with parents; tell the honest founder story; invite early feedback.`, focusMetrics: ['profile visits', 'replies', 'website visits'] }
  }
  if (today <= addDays(launchDate, 6)) {
    return { phase: 'launch_week', goal: 'Launch week: get real parents to try it — website visits, sign-ups and first parties created. Ask for honest feedback.', focusMetrics: ['link clicks', 'sign-ups', 'parties created'] }
  }
  return { phase: 'growth', goal: 'Traction: grow sign-ups, parties created and paid conversions from genuinely useful founder content; learn what resonates.', focusMetrics: ['sign-ups', 'parties created', 'paid conversions', 'profile visits'] }
}

/** Posts that count toward the mix: anything planned or out, plus pending drafts (so drafts don't pile up on one pillar). */
const COUNTED = new Set(['draft', 'approved', 'scheduled', 'publishing', 'published', 'dry_run'])
const MIX_WINDOW = 14
/** Direct invitations are rare: at most one in this many days (plus launch day). */
export const INVITATION_EVERY_DAYS = 10

export interface PillarChoice { pillar: Pillar; reason: string; targets: Record<string, number>; shares: Record<string, number> }

/**
 * Deficit rotation: target share (default mix × learning multipliers) minus the share in the last 14 posts; the
 * biggest deficit wins. Never the same pillar twice in a row, never a pillar holding 2 of the last 3.
 * Launch invitations are not part of the mix: one on launch day, then at most one every 10 days, taking a product slot.
 */
export function selectPillar(history: StrategyPost[], opts: { now: Date; tz: string; launchDate: string; multipliers?: Partial<Record<Pillar, number>>; forced?: Pillar | null }): PillarChoice {
  const recent = history.filter((p) => COUNTED.has(p.status)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MIX_WINDOW)
  const weights = defaultWeights()
  const mixPillars = (Object.keys(weights) as Pillar[]).filter((p) => weights[p] > 0)
  const raw = Object.fromEntries(mixPillars.map((p) => [p, weights[p] * clampMultiplier(opts.multipliers?.[p])]))
  const total = Object.values(raw).reduce((a, b) => a + b, 0)
  const targets = Object.fromEntries(mixPillars.map((p) => [p, raw[p] / total]))
  // An invitation takes a product slot, so it counts toward product education's share.
  const mixRecent = recent.map((p) => (p.pillar === 'launch_invitation' ? { ...p, pillar: 'product_education' as Pillar } : p))
  const shares = Object.fromEntries(mixPillars.map((p) => [p, mixRecent.length ? mixRecent.filter((x) => x.pillar === p).length / mixRecent.length : 0]))
  if (opts.forced) return { pillar: opts.forced, reason: 'Chosen by the founder.', targets, shares }

  const today = localDate(opts.now, opts.tz)
  const launchPosts = recent.filter((p) => p.pillar === 'launch_invitation')
  const lastLaunchDays = launchPosts.length ? (opts.now.getTime() - new Date(launchPosts[0].at).getTime()) / 86_400_000 : Infinity
  if (today === opts.launchDate && !launchPosts.some((p) => localDate(new Date(p.at), opts.tz) === today)) {
    return { pillar: 'launch_invitation', reason: 'Launch day: one honest invitation to try it.', targets, shares }
  }

  const last = mixRecent[0]?.pillar
  const lastThree = mixRecent.slice(0, 3).map((p) => p.pillar)
  const ranked = mixPillars
    .filter((p) => p !== last && lastThree.filter((x) => x === p).length < 2)
    .map((p) => ({ p, deficit: targets[p] - shares[p] }))
    .sort((a, b) => b.deficit - a.deficit || weights[b.p] - weights[a.p])
  let pillar = ranked[0]?.p ?? 'founder_journey'
  let reason = `${PILLAR_LABEL[pillar]} is furthest below its target share (${pct(shares[pillar])} of the last ${mixRecent.length} posts vs ${pct(targets[pillar])} target).`
  if (pillar === 'product_education' && lastLaunchDays >= INVITATION_EVERY_DAYS && today > opts.launchDate) {
    pillar = 'launch_invitation'
    reason = `This product slot became the occasional invitation to try it (none in the last ${INVITATION_EVERY_DAYS} days).`
  }
  return { pillar, reason, targets, shares }
}

function clampMultiplier(m: number | undefined): number {
  return typeof m === 'number' && Number.isFinite(m) ? Math.min(1.35, Math.max(0.75, m)) : 1
}
const pct = (x: number | undefined) => `${Math.round((x ?? 0) * 100)}%`

/** The pillar's topic used least recently (never one used in the last 14 days unless every topic was). */
export function selectTopic(pillar: Pillar, history: StrategyPost[], now: Date, preferred?: string | null) {
  const topics = PILLAR_SPECS[pillar].topics
  if (preferred) {
    const t = topics.find((x) => x.key === preferred)
    if (t) return t
  }
  const lastUsed = (key: string) => history.filter((p) => p.topicKey === key && p.status !== 'cancelled').map((p) => p.at).sort().pop() ?? null
  const scored = topics.map((t, i) => ({ t, i, last: lastUsed(t.key) }))
  scored.sort((a, b) => (a.last ?? '').localeCompare(b.last ?? '') || a.i - b.i)
  // Rotate the starting point by day so two fresh pillars don't always start on their first topic.
  const fresh = scored.filter((s) => !s.last)
  if (fresh.length > 1) return fresh[Math.floor(now.getTime() / 86_400_000) % fresh.length].t
  return scored[0].t
}

/** Link policy: always/never per pillar, otherwise keep the share of linked posts near the target (≈35%). */
export function decideLink(pillar: Pillar, history: StrategyPost[], share: number): boolean {
  const policy = PILLAR_SPECS[pillar].link
  if (policy !== 'optional') return policy === 'always'
  const recent = history.filter((p) => COUNTED.has(p.status)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)
  if (recent[0]?.hasLink) return false // never two linked posts in a row
  const linked = recent.filter((p) => p.hasLink).length
  return (linked + 1) / (recent.length + 1) <= share + 0.05
}

/** Image policy: always/never per pillar; optional pillars get one when fewer than half of the last 4 posts had one. */
export function decideImage(pillar: Pillar, history: StrategyPost[]): boolean {
  const policy = PILLAR_SPECS[pillar].image
  if (policy !== 'optional') return policy === 'always'
  const recent = history.filter((p) => COUNTED.has(p.status)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4)
  return recent.filter((p) => p.hasImage).length < 2
}

/** https://magicalbirthdayplanner.app/?utm_source=x&utm_medium=social&utm_campaign=mbp_x_growth&utm_content={post_id} */
export function utmUrl(postId: string, platform: Platform = 'x', campaign = 'mbp_x_growth'): string {
  const q = new URLSearchParams({ utm_source: platform, utm_medium: 'social', utm_campaign: campaign, utm_content: postId.toLowerCase() })
  return `${PRODUCT_URL}/?${q.toString()}`
}
