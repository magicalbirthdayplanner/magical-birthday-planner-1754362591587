/**
 * Business score: what a post did for the business, not just for likes. Weighted sum over the funnel
 * (MARKETING_SCORE_WEIGHTS, JSON, overrides any weight):
 *   impressions 0.001 · engagements 0.02 · profile visits 0.2 · link clicks 0.5 · website visits 0.5 ·
 *   sign-ups 10 · parties created 20 · purchases 50
 * The defaults are funnel values on purpose: applied to raw counts, a formula like "impressions × 0.10 + signups × 0.25"
 * would rank a 20,000-impression poll with no sign-ups above a 4,000-impression founder story with 6 sign-ups.
 */
import type { MarketingStore } from './store'
import type { MarketingPost } from './types'

export function engagements(p: Pick<MarketingPost, 'metrics'>): number {
  const m = p.metrics
  return (m.likes ?? 0) + (m.reposts ?? 0) + (m.replies ?? 0) + (m.quotes ?? 0) + (m.bookmarks ?? 0)
}

export function businessScore(p: Pick<MarketingPost, 'metrics' | 'attribution'>, w: Record<string, number>): number {
  const v: Record<string, number> = {
    impressions: p.metrics.impressions ?? 0,
    engagements: engagements(p),
    profileVisits: p.metrics.profileVisits ?? 0,
    linkClicks: p.metrics.linkClicks ?? 0,
    landingVisits: p.attribution.landingVisits,
    signups: p.attribution.signups,
    partiesCreated: p.attribution.partiesCreated,
    purchases: p.attribution.purchases,
  }
  return Math.round(Object.entries(w).reduce((a, [k, weight]) => a + (v[k] ?? 0) * weight, 0) * 10_000) / 10_000
}

/** Recompute scores for recent published posts and roll them up into each library medium's performance score. */
export async function updateScores(store: MarketingStore, weights: Record<string, number>, now = new Date()): Promise<{ posts: number; media: number }> {
  const posts = (await store.listPosts({ platform: 'x', statuses: ['published'], since: new Date(now.getTime() - 45 * 86_400_000).toISOString(), limit: 2000 })).filter((p) => p.publishedAt)
  const perMedia = new Map<string, number[]>()
  let n = 0
  for (const p of posts) {
    if (p.metricsUpdatedAt === null && p.attributionUpdatedAt === null) continue
    const score = businessScore(p, weights)
    if (score !== p.businessScore) await store.updatePost(p.id, { business_score: score })
    n++
    for (const id of p.mediaIds) perMedia.set(id, [...(perMedia.get(id) ?? []), score])
  }
  for (const [id, scores] of perMedia) await store.updateMedia(id, { performance_score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10_000) / 10_000 })
  return { posts: n, media: perMedia.size }
}
