import { resolveWeights, type RankingWeights } from './ranking'
import { DEFAULT_MAX_QUERIES } from './query-plan'

export interface DiscoveryConfig {
  /** Fresh window for a cached text search. */
  searchTtlHours: number
  /** Fresh window for cached Place Details. */
  detailsTtlDays: number
  /** Max Places Text Search queries per discovery run. */
  maxQueries: number
  /** Parallel Google calls per run. */
  concurrency: number
  weights: RankingWeights
}

const posNum = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function discoveryConfig(env: Record<string, string | undefined> = process.env): DiscoveryConfig {
  return {
    searchTtlHours: posNum(env.DISCOVERY_SEARCH_TTL_HOURS, 24),
    detailsTtlDays: posNum(env.DISCOVERY_DETAILS_TTL_DAYS, 7),
    maxQueries: Math.min(16, Math.round(posNum(env.DISCOVERY_MAX_QUERIES, DEFAULT_MAX_QUERIES))),
    concurrency: Math.min(8, Math.round(posNum(env.DISCOVERY_CONCURRENCY, 4))),
    weights: resolveWeights(env.DISCOVERY_RANKING_WEIGHTS),
  }
}

export const RADIUS_OPTIONS = [5, 10, 20, 30, 50] as const
export const DEFAULT_RADIUS_MILES = 20

export function clampRadius(miles: unknown): number {
  const n = Number(miles)
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_MILES
  return Math.min(50, Math.max(1, Math.round(n)))
}

/** Snap any requested radius to the supported set, so arbitrary values can't mint new cache keys. */
export function snapRadius(miles: unknown): (typeof RADIUS_OPTIONS)[number] {
  const n = Number(miles)
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_MILES as 20
  return RADIUS_OPTIONS.reduce((best, r) => (Math.abs(r - n) < Math.abs(best - n) ? r : best), RADIUS_OPTIONS[0])
}
