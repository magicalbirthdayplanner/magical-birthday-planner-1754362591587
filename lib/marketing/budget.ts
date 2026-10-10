/**
 * Cost control. Every billable call (X API, AI copy, image, video) is written to marketing_usage with its estimated
 * cost, and every paid call asks this module first. Budgets are hard: the monthly X budget (MONTHLY_X_BUDGET_USD,
 * default $5) minus a safety reserve is never exceeded.
 *
 * X rates (docs.x.com/x-api/getting-started/pricing, Oct 2026; override with MARKETING_X_PRICE_<OP>):
 *   post create $0.015 · post with a URL $0.20 · post read $0.005/post · owned read $0.001/post · user read $0.01 ·
 *   media metadata (alt text) $0.005 · media upload: not on the rate card (tracked at $0 until X prices it).
 *
 * Spending priorities when money is short:
 *   core           — the post itself: allowed while it fits the hard cap AND today's fair share of what is left
 *   discretionary  — link premium, metrics reads, alt text, account checks: only when the month's projected spend
 *                    (spent + everything still committed) stays inside the budget and the status isn't RED
 * Status: GREEN projected ≤ 80% · YELLOW ≤ 100% · RED above, or the hard cap is reached.
 */
import type { MarketingConfig } from './config'
import { usageMonth, type MarketingStore, type UsageRow } from './store'
import type { MarketingPost } from './types'

export const X_OPS = ['post_create', 'post_create_url', 'post_read', 'owned_read', 'user_read', 'media_metadata', 'media_upload'] as const
export type XOp = (typeof X_OPS)[number]
export const DEFAULT_X_PRICES: Record<XOp, number> = { post_create: 0.015, post_create_url: 0.2, post_read: 0.005, owned_read: 0.001, user_read: 0.01, media_metadata: 0.005, media_upload: 0 }

export function xPrices(env: Record<string, string | undefined> = process.env): Record<XOp, number> {
  const out = { ...DEFAULT_X_PRICES }
  for (const op of X_OPS) {
    const v = Number.parseFloat(env[`MARKETING_X_PRICE_${op.toUpperCase()}`] ?? '')
    if (Number.isFinite(v) && v >= 0) out[op] = v
  }
  return out
}

export type BudgetStatus = 'GREEN' | 'YELLOW' | 'RED'
export interface ProviderBudget { budget: number; spent: number; today: number; committed: number; projected: number; remaining: number; status: BudgetStatus; byOperation: Record<string, { units: number; cost: number }> }
export interface BudgetSnapshot {
  month: string
  daysLeft: number
  x: ProviderBudget & { reserve: number; dailyAllowance: number }
  ai: ProviderBudget
  image: { spent: number }
  video: { spent: number }
  totalSpent: number
  prices: Record<XOp, number>
  notes: string[]
}

const round = (n: number) => Math.round(n * 100_000) / 100_000
const sum = (rows: UsageRow[]) => round(rows.reduce((a, r) => a + (r.ok ? r.costUsd : 0), 0))

function byOperation(rows: UsageRow[]) {
  const out: Record<string, { units: number; cost: number }> = {}
  for (const r of rows) {
    if (!r.ok) continue
    const o = (out[r.operation] ??= { units: 0, cost: 0 })
    o.units += r.units
    o.cost = round(o.cost + r.costUsd)
  }
  return out
}

function status(projected: number, spent: number, budget: number, hardCap: number): BudgetStatus {
  if (spent >= hardCap || projected > budget) return 'RED'
  if (projected > budget * 0.8) return 'YELLOW'
  return 'GREEN'
}

/** Estimated X cost of publishing one post (base + link premium + thread parts + optional alt text + uploads). */
export function estimatePostCost(p: Pick<MarketingPost, 'linkUrl' | 'threadParts' | 'mediaIds' | 'imagePath'>, prices: Record<XOp, number>, altText = false): number {
  const media = p.mediaIds.length + (p.imagePath ? 1 : 0)
  return round(
    (p.linkUrl ? prices.post_create_url : prices.post_create) +
      (p.threadParts?.length ?? 0) * prices.post_create +
      media * prices.media_upload +
      (altText ? media * prices.media_metadata : 0),
  )
}

/** Daily metrics reads expected from MARKETING_METRICS_WINDOWS (posts/day × windows × owned-read price). */
export function dailyMetricsCost(cfg: MarketingConfig, prices: Record<XOp, number>): number {
  return round(cfg.metricsWindows.reduce((a, [from, to]) => a + ((to - from) / 24) * cfg.postsPerDay, 0) * prices.owned_read)
}

export async function budgetSnapshot(store: MarketingStore, cfg: MarketingConfig, now = new Date(), env: Record<string, string | undefined> = process.env): Promise<BudgetSnapshot> {
  const prices = xPrices(env)
  const month = usageMonth(now)
  const monthStart = `${month}-01T00:00:00.000Z`
  const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const daysLeft = daysInMonth - now.getUTCDate() + 1
  const rows = await store.usageSince(monthStart)
  const of = (p: UsageRow['provider']) => rows.filter((r) => r.provider === p)
  const xRows = of('x')
  const aiRows = of('ai')
  const xSpent = sum(xRows)
  const xToday = sum(xRows.filter((r) => r.at >= dayStart))
  const xBefore = round(xSpent - xToday)

  // Committed X spend for the rest of the month: queued posts at their own estimate, the remaining empty slots at the
  // plain-post price, and the daily metrics reads.
  const queued = (await store.listPosts({ statuses: ['scheduled', 'approved'], limit: 1000 })).filter((p) => p.platform === 'x' && (!p.scheduledAt || p.scheduledAt.slice(0, 7) === month))
  const queuedCost = queued.reduce((a, p) => a + (p.estCostUsd ?? estimatePostCost(p, prices)), 0)
  const postedToday = xRows.filter((r) => r.at >= dayStart && (r.operation === 'post_create' || r.operation === 'post_create_url') && !r.detail?.threadPart).length
  const slotsLeft = Math.max(0, cfg.postsPerDay * daysLeft - postedToday - queued.length)
  const committed = round(queuedCost + slotsLeft * prices.post_create + daysLeft * dailyMetricsCost(cfg, prices))
  const hardCap = Math.max(0, cfg.xBudgetUsd - cfg.xReserveUsd)
  const xProjected = round(xSpent + committed)

  const aiSpent = sum(aiRows)
  const aiToday = sum(aiRows.filter((r) => r.at >= dayStart))
  const elapsedDays = Math.max(1, daysInMonth - daysLeft + 1)
  const aiProjected = round(aiSpent + (aiSpent / elapsedDays) * (daysLeft - 1))

  const notes: string[] = []
  if (cfg.postsPerDay * daysInMonth * prices.post_create > hardCap) notes.push(`${cfg.postsPerDay} posts/day costs more than the X budget allows this month — the publisher will post fewer.`)
  return {
    month,
    daysLeft,
    x: {
      budget: cfg.xBudgetUsd,
      reserve: cfg.xReserveUsd,
      spent: xSpent,
      today: xToday,
      committed,
      projected: xProjected,
      remaining: round(hardCap - xSpent),
      status: status(xProjected, xSpent, cfg.xBudgetUsd - cfg.xReserveUsd, hardCap),
      dailyAllowance: round(Math.max(0, hardCap - xBefore) / daysLeft),
      byOperation: byOperation(xRows),
    },
    ai: { budget: cfg.aiBudgetUsd, spent: aiSpent, today: aiToday, committed: round(aiProjected - aiSpent), projected: aiProjected, remaining: round(cfg.aiBudgetUsd - aiSpent), status: status(aiProjected, aiSpent, cfg.aiBudgetUsd, cfg.aiBudgetUsd), byOperation: byOperation(aiRows) },
    image: { spent: sum(of('image')) },
    video: { spent: sum(of('video')) },
    totalSpent: round(xSpent + aiSpent + sum(of('image')) + sum(of('video'))),
    prices,
    notes,
  }
}

export type SpendKind = 'core' | 'discretionary'
export interface SpendDecision { ok: boolean; reason?: string; cost: number }

/** May we spend `cost` on X now? Core = the post itself; discretionary = everything else (see header). */
export function allowX(b: BudgetSnapshot, cost: number, kind: SpendKind): SpendDecision {
  const hardCap = b.x.budget - b.x.reserve
  if (b.x.spent + cost > hardCap + 1e-9) return { ok: false, reason: 'x_budget_exhausted', cost }
  if (kind === 'core') {
    // Fair share: never burn more than 1.5× today's share of what is left (keeps posts going all month).
    if (b.x.today + cost > b.x.dailyAllowance * 1.5 + 1e-9) return { ok: false, reason: 'x_daily_allowance', cost }
    return { ok: true, cost }
  }
  if (b.x.status === 'RED') return { ok: false, reason: 'x_budget_red', cost }
  if (b.x.projected + cost > hardCap + 1e-9) return { ok: false, reason: 'x_projection_exceeds_budget', cost }
  return { ok: true, cost }
}

/** May we spend ~`estimate` on AI? (copy, images, video) */
export function allowAI(b: BudgetSnapshot, estimate: number): SpendDecision {
  if (b.ai.spent + estimate > b.ai.budget + 1e-9) return { ok: false, reason: 'ai_budget_exhausted', cost: estimate }
  return { ok: true, cost: estimate }
}

/** Alt text costs one X call per image: on/off, or 'auto' = only while GREEN. */
export function altTextAllowed(b: BudgetSnapshot, cfg: MarketingConfig): boolean {
  return cfg.altText === 'on' || (cfg.altText === 'auto' && b.x.status === 'GREEN')
}

/** A meter the X provider calls after every request; it writes the ledger. */
export type XMeter = (op: XOp, units: number, ok: boolean, detail?: Record<string, unknown>) => Promise<void>
export function xMeter(store: MarketingStore, prices: Record<XOp, number>, postId: string | null = null): XMeter {
  return async (op, units, ok, detail) =>
    store.recordUsage({ provider: 'x', operation: op, units, costUsd: ok ? round(prices[op] * units) : 0, ok, postId, detail })
}

/** AI usage → ledger (tokens × MARKETING_AI_USD_PER_1M_TOKENS). */
export async function recordAI(store: MarketingStore, cfg: MarketingConfig, operation: string, tokens: number, ok: boolean, detail: Record<string, unknown> = {}) {
  await store.recordUsage({ provider: 'ai', operation, units: Math.max(0, Math.round(tokens)), costUsd: round((Math.max(0, tokens) / 1_000_000) * cfg.aiUsdPer1MTokens), ok, detail })
}
