/**
 * Performance tracking.
 *  - Platform metrics: fetched from the provider for posts published in the last 14 days (null when the API access
 *    level doesn't return a metric — never a guessed 0).
 *  - MBP attribution (AttributionSource): the app's own analytics_events carry the last-touch UTM tags of the device
 *    (lib/analytics/attribution.ts), so utm_campaign=founder_marketing + utm_content=<post id> ties visits, sign-ups,
 *    parties, checkouts and purchases to a post. Revenue = verified purchases (billing_purchases) of users seen on
 *    those events, made after the post went out. Nothing is estimated.
 * SERVER ONLY.
 */
import 'server-only'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { allowX, budgetSnapshot, xMeter } from './budget'
import type { MarketingConfig } from './config'
import type { MarketingProvider } from './providers'
import type { MarketingStore } from './store'
import type { Attribution, MarketingPost } from './types'

/** Campaign tags that count as this engine's traffic (the original founder agent + the growth engine). */
export const ATTRIBUTION_CAMPAIGNS = ['mbp_x_growth', 'founder_marketing']
export const METRICS_WINDOW_DAYS = 14
export const ATTRIBUTION_WINDOW_DAYS = 30
const REFRESH_HOURS = 6

export interface AttributionSource {
  readonly name: string
  collect(posts: Pick<MarketingPost, 'id' | 'publishedAt'>[], since: Date): Promise<Map<string, Attribution>>
}

export const EMPTY_ATTRIBUTION: Attribution = { landingVisits: 0, signups: 0, partiesCreated: 0, checkouts: 0, purchases: 0, revenueMinor: 0, currency: null }

/** analytics_events (existing first-party analytics) → per-post attribution. */
export class SupabaseAnalyticsAttribution implements AttributionSource {
  readonly name = 'mbp_analytics'
  async collect(posts: Pick<MarketingPost, 'id' | 'publishedAt'>[], since: Date) {
    const out = new Map<string, Attribution>()
    if (!posts.length) return out
    const db = getSupabaseAdmin()
    const ids = posts.map((p) => p.id.toLowerCase())
    const { data, error } = await db
      .from('analytics_events')
      .select('event, user_id, anonymous_id, party_id, properties, created_at')
      .in('properties->>utm_campaign', ATTRIBUTION_CAMPAIGNS)
      .in('properties->>utm_content', ids)
      .gte('created_at', since.toISOString())
      .limit(20_000)
    if (error) throw new Error(`attribution query failed: ${error.message}`)
    const per = new Map<string, { visits: Set<string>; signups: Set<string>; parties: Set<string>; checkouts: Set<string>; purchases: Set<string>; users: Set<string> }>()
    for (const e of data ?? []) {
      const pid = String((e.properties as Record<string, unknown>)?.utm_content ?? '')
      if (!ids.includes(pid)) continue
      const b = per.get(pid) ?? { visits: new Set(), signups: new Set(), parties: new Set(), checkouts: new Set(), purchases: new Set(), users: new Set() }
      per.set(pid, b)
      const who = e.user_id ?? e.anonymous_id ?? `${e.event}:${e.created_at}`
      if (e.user_id) b.users.add(e.user_id)
      if (e.event === 'landing_page_view') b.visits.add(e.anonymous_id ?? who)
      else if (e.event === 'signup_completed' || e.event === 'sign_up') b.signups.add(who)
      else if (e.event === 'party_creation_completed' || e.event === 'party_created') b.parties.add(`${who}:${e.created_at.slice(0, 16)}`) // both creation events fire together: one party per person-minute
      else if (e.event === 'checkout_started') b.checkouts.add(who)
      else if (e.event === 'purchase_completed') b.purchases.add(who)
    }
    for (const p of posts) {
      const b = per.get(p.id.toLowerCase())
      if (!b) {
        out.set(p.id, { ...EMPTY_ATTRIBUTION })
        continue
      }
      let revenueMinor = 0
      let currency: string | null = null
      if (b.users.size && p.publishedAt) {
        const { data: buys } = await db
          .from('billing_purchases')
          .select('amount_minor, currency')
          .in('user_id', [...b.users])
          .eq('status', 'active')
          .gte('created_at', p.publishedAt)
        for (const x of buys ?? []) {
          revenueMinor += x.amount_minor ?? 0
          currency ??= x.currency
        }
      }
      out.set(p.id, { landingVisits: b.visits.size, signups: b.signups.size, partiesCreated: b.parties.size, checkouts: b.checkouts.size, purchases: b.purchases.size, revenueMinor, currency })
    }
    return out
  }
}

/** Pull platform metrics for recent published posts; store columns + a snapshot. */
export async function collectPlatformMetrics(store: MarketingStore, provider: MarketingProvider, now = new Date()): Promise<{ updated: number; skipped?: string }> {
  if (!provider.configured()) return { updated: 0, skipped: 'provider_not_configured' }
  const since = new Date(now.getTime() - METRICS_WINDOW_DAYS * 86_400_000)
  const posts = (await store.listPosts({ platform: provider.platform, statuses: ['published'], limit: 500 })).filter(
    (p) => p.externalPostId && p.publishedAt && new Date(p.publishedAt) >= since && (!p.metricsUpdatedAt || now.getTime() - new Date(p.metricsUpdatedAt).getTime() > REFRESH_HOURS * 3_600_000),
  )
  let updated = 0
  for (let i = 0; i < posts.length; i += 100) {
    const batch = posts.slice(i, i + 100)
    const metrics = await provider.getMetrics(batch.map((p) => p.externalPostId!))
    for (const p of batch) {
      const m = metrics.get(p.externalPostId!)
      if (!m) continue
      await store.updatePost(p.id, {
        impressions: m.impressions, likes: m.likes, reposts: m.reposts, replies: m.replies, quotes: m.quotes, bookmarks: m.bookmarks,
        profile_visits: m.profileVisits, link_clicks: m.linkClicks, metrics_updated_at: now.toISOString(),
      })
      await store.addMetricsSnapshot(p.id, 'platform', { ...m })
      updated++
    }
  }
  return { updated }
}

/** MBP-side attribution for posts published in the last 30 days. */
export async function collectAttribution(store: MarketingStore, source: AttributionSource, now = new Date()): Promise<{ updated: number }> {
  const since = new Date(now.getTime() - ATTRIBUTION_WINDOW_DAYS * 86_400_000)
  const posts = (await store.listPosts({ statuses: ['published'], limit: 500 })).filter((p) => p.publishedAt && new Date(p.publishedAt) >= since)
  if (!posts.length) return { updated: 0 }
  const earliest = new Date(Math.min(...posts.map((p) => new Date(p.publishedAt!).getTime())))
  const results = await source.collect(posts, earliest)
  let updated = 0
  for (const p of posts) {
    const a = results.get(p.id)
    if (!a) continue
    const changed = JSON.stringify(a) !== JSON.stringify(p.attribution)
    await store.updatePost(p.id, {
      landing_visits_attributed: a.landingVisits, signups_attributed: a.signups, parties_created_attributed: a.partiesCreated,
      checkouts_attributed: a.checkouts, purchases_attributed: a.purchases, revenue_attributed_minor: a.revenueMinor, revenue_currency: a.currency,
      attribution_updated_at: now.toISOString(),
    })
    if (changed) await store.addMetricsSnapshot(p.id, 'mbp', { ...a })
    updated++
  }
  return { updated }
}

/** All founder-marketing traffic between two instants (any post), for the daily brief. */
export async function countCampaignEvents(start: Date, end: Date): Promise<{ landingVisits: number; signups: number; partiesCreated: number; checkouts: number; purchases: number }> {
  const { data, error } = await getSupabaseAdmin()
    .from('analytics_events')
    .select('event, user_id, anonymous_id, party_id, created_at')
    .in('properties->>utm_campaign', ATTRIBUTION_CAMPAIGNS)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .limit(20_000)
  if (error) throw new Error(`campaign count failed: ${error.message}`)
  const sets = { landingVisits: new Set<string>(), signups: new Set<string>(), partiesCreated: new Set<string>(), checkouts: new Set<string>(), purchases: new Set<string>() }
  for (const e of data ?? []) {
    const who = e.user_id ?? e.anonymous_id ?? `${e.event}:${e.created_at}`
    if (e.event === 'landing_page_view') sets.landingVisits.add(e.anonymous_id ?? who)
    else if (e.event === 'signup_completed' || e.event === 'sign_up') sets.signups.add(who)
    else if (e.event === 'party_creation_completed' || e.event === 'party_created') sets.partiesCreated.add(`${who}:${e.created_at.slice(0, 16)}`)
    else if (e.event === 'checkout_started') sets.checkouts.add(who)
    else if (e.event === 'purchase_completed') sets.purchases.add(who)
  }
  return { landingVisits: sets.landingVisits.size, signups: sets.signups.size, partiesCreated: sets.partiesCreated.size, checkouts: sets.checkouts.size, purchases: sets.purchases.size }
}

/**
 * Cost-aware metrics (default): one "owned read" ($0.001/post) per time window per day — by default the posts that are
 * 1–2 days old and 7–8 days old — instead of polling. Windows with no known posts make no call at all, and each read
 * must pass the discretionary budget check.
 */
export async function collectOwnMetrics(store: MarketingStore, provider: MarketingProvider, cfg: MarketingConfig, opts: { now?: Date; userId: string | null; env?: Record<string, string | undefined> }): Promise<{ updated: number; reads: number; skipped?: string }> {
  const now = opts.now ?? new Date()
  if (!provider.configured()) return { updated: 0, reads: 0, skipped: 'provider_not_configured' }
  if (!opts.userId) return { updated: 0, reads: 0, skipped: 'x_user_id_unknown' }
  const published = (await store.listPosts({ platform: 'x', statuses: ['published'], since: new Date(now.getTime() - 40 * 86_400_000).toISOString(), limit: 2000 })).filter((p) => p.externalPostId && p.publishedAt)
  let updated = 0
  let reads = 0
  for (const [fromH, toH] of cfg.metricsWindows) {
    const start = new Date(now.getTime() - toH * 3_600_000)
    const end = new Date(now.getTime() - fromH * 3_600_000)
    const known = published.filter((p) => new Date(p.publishedAt!) >= start && new Date(p.publishedAt!) < end)
    if (!known.length) continue
    const roots = known.length + known.reduce((a, p) => a + p.externalThreadIds.length, 0)
    const budget = await budgetSnapshot(store, cfg, now, opts.env)
    const gate = allowX(budget, roots * budget.prices.owned_read, 'discretionary')
    if (!gate.ok) return { updated, reads, skipped: gate.reason }
    provider.setMeter(xMeter(store, budget.prices))
    try {
      const own = await provider.getOwnPosts(opts.userId, { startTime: start.toISOString(), endTime: end.toISOString(), maxResults: Math.min(100, roots + 5) })
      reads += own.length
      const byId = new Map(own.map((o) => [o.id, o.metrics]))
      for (const p of known) {
        const m = byId.get(p.externalPostId!)
        if (!m) continue
        await store.updatePost(p.id, { impressions: m.impressions, likes: m.likes, reposts: m.reposts, replies: m.replies, quotes: m.quotes, bookmarks: m.bookmarks, profile_visits: m.profileVisits, link_clicks: m.linkClicks, metrics_updated_at: now.toISOString() })
        await store.addMetricsSnapshot(p.id, 'platform', { ...m, window: `${fromH}-${toH}h` })
        updated++
      }
    } finally {
      provider.setMeter(null)
    }
  }
  return { updated, reads }
}

/** One-time import of the account's existing posts (≤ 100, owned reads) so the engine never repeats them. */
export async function importHistory(store: MarketingStore, provider: MarketingProvider, cfg: MarketingConfig, opts: { userId: string | null; now?: Date; env?: Record<string, string | undefined> }): Promise<{ imported: number; seen: number }> {
  if (!opts.userId) throw new Error('X user id unknown (X_ACCESS_TOKEN must start with the account id)')
  const now = opts.now ?? new Date()
  const budget = await budgetSnapshot(store, cfg, now, opts.env)
  const gate = allowX(budget, 100 * budget.prices.owned_read, 'discretionary')
  if (!gate.ok) throw new Error(`Budget: ${gate.reason}`)
  provider.setMeter(xMeter(store, budget.prices))
  let own
  try {
    own = await provider.getOwnPosts(opts.userId, { maxResults: 100 })
  } finally {
    provider.setMeter(null)
  }
  const known = new Set((await store.listPosts({ platform: 'x', limit: 5000 })).map((p) => p.externalPostId).filter(Boolean))
  let imported = 0
  for (const o of own) {
    if (known.has(o.id) || !o.text.trim()) continue
    await store.insertPost({
      platform: 'x', content_pillar: 'founder_journey', topic: 'imported from X', topic_key: `x:${o.id}`, text: o.text.slice(0, 4000), hook: o.text.split('\n')[0].slice(0, 200),
      status: 'published', origin: 'manual', source: 'imported', published_at: o.createdAt ?? now.toISOString(), external_post_id: o.id, external_post_url: `https://x.com/i/web/status/${o.id}`,
      impressions: o.metrics.impressions, likes: o.metrics.likes, reposts: o.metrics.reposts, replies: o.metrics.replies, quotes: o.metrics.quotes, bookmarks: o.metrics.bookmarks,
      profile_visits: o.metrics.profileVisits, link_clicks: o.metrics.linkClicks, metrics_updated_at: now.toISOString(), validation: {} as never, generation: { imported: true } as never,
    })
    imported++
  }
  await store.audit(null, null, 'history_imported', { seen: own.length, imported })
  return { imported, seen: own.length }
}
