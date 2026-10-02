/**
 * Recommendation engine. Pure: no I/O, no UI. Weights are configurable.
 *
 * score = Σ wᵢ·fᵢ / Σ wᵢ   with every factor fᵢ ∈ [0, 1].
 * Unknown data scores a neutral 0.5 (never a fabricated good or bad value).
 */
import { isGeoapifyPlaceId } from '@/lib/geoapify/categories'
import { formatMiles, haversineMiles } from '@/lib/geo/distance'
import {
  INTERESTS,
  getCategory,
  primaryCategory,
  settingForCategories,
  type DiscoveryCategory,
} from './taxonomy'
import type { PartyContext, RankedVenue, Reason, Venue } from './types'

export interface RankingWeights {
  distance: number
  rating: number
  reviews: number
  relevance: number
  age: number
  setting: number
  capacity: number
  budget: number
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 0.2,
  rating: 0.18,
  reviews: 0.08,
  relevance: 0.27,
  age: 0.1,
  setting: 0.09,
  capacity: 0.04,
  budget: 0.04,
}

/** Merge partial overrides (e.g. from DISCOVERY_RANKING_WEIGHTS JSON). Invalid values are ignored. */
export function resolveWeights(override?: Partial<RankingWeights> | string | null): RankingWeights {
  let parsed: Partial<RankingWeights> = {}
  if (typeof override === 'string' && override.trim()) {
    try {
      parsed = JSON.parse(override)
    } catch {
      parsed = {}
    }
  } else if (override && typeof override === 'object') {
    parsed = override
  }
  const out = { ...DEFAULT_WEIGHTS }
  for (const k of Object.keys(out) as (keyof RankingWeights)[]) {
    const v = parsed[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
  }
  return out
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// Bayesian average: a 5.0 with 3 reviews should not beat a 4.7 with 900.
const PRIOR_MEAN = 4.2
const PRIOR_WEIGHT = 15

export function ratingScore(rating: number | null, reviews: number | null): number {
  if (rating == null) return 0.5
  const n = Math.max(0, reviews ?? 0)
  const bayes = (n * rating + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT)
  return clamp01((bayes - 3) / 2)
}

export function reviewsScore(reviews: number | null): number {
  if (!reviews) return 0
  return clamp01(Math.log10(1 + reviews) / Math.log10(1 + 2000))
}

export function distanceScore(miles: number, radiusMiles: number): number {
  if (!Number.isFinite(miles)) return 0.5
  const r = Math.max(1, radiusMiles)
  return clamp01(1 - Math.pow(Math.min(miles, r) / r, 0.8))
}

/** Expected Google price level for a per-guest budget. */
export function expectedPriceLevel(budget: number | null | undefined, guests: number | null | undefined): number | null {
  if (!budget || budget <= 0) return null
  const perGuest = budget / Math.max(1, guests || 1)
  if (perGuest < 15) return 1
  if (perGuest < 35) return 2
  if (perGuest < 70) return 3
  return 4
}

export function budgetScore(priceLevel: number | null, expected: number | null): number {
  if (priceLevel == null || expected == null) return 0.5
  if (priceLevel === 0) return 1
  return clamp01(1 - Math.max(0, priceLevel - expected) * 0.4)
}

function categoriesOf(v: Venue): DiscoveryCategory[] {
  return v.categories.map(getCategory).filter((x): x is DiscoveryCategory => !!x)
}

function relevanceScore(cats: DiscoveryCategory[], ctx: PartyContext, goodForChildren: boolean | null) {
  const interests = new Set(ctx.interests)
  let best = cats.length ? 0.35 : 0.25
  let matched: string | null = null
  for (const cat of cats) {
    const hit = cat.interests.find((i) => interests.has(i))
    if (hit) {
      best = Math.max(best, 1)
      matched ??= hit
    } else if (cat.id === 'birthday-party-venue') {
      best = Math.max(best, 0.7)
    } else if (cat.group !== 'general' && cat.group !== 'vendor' && cat.ages[1] <= 13) {
      best = Math.max(best, 0.6)
    }
  }
  if (goodForChildren === true) best = Math.min(1, best + 0.1)
  return { score: best, matchedInterest: matched }
}

function ageScore(cats: DiscoveryCategory[], age: number | null | undefined): number {
  if (age == null || !cats.length) return 0.5
  let best = 0
  for (const cat of cats) {
    const [min, max] = cat.ages
    if (age >= min && age <= max) best = Math.max(best, 1)
    else if (age === min - 1 || age === max + 1) best = Math.max(best, 0.5)
  }
  return best
}

function settingScore(venueSetting: string, wanted: string): number {
  if (wanted === 'either') return 1
  if (venueSetting === 'either') return 0.7
  return venueSetting === wanted ? 1 : 0.1
}

function capacityScore(v: Venue, guests: number | null | undefined): number {
  if (!guests) return 0.5
  if (v.maxCapacity != null) return v.maxCapacity >= guests ? 1 : 0
  if (v.goodForGroups === true && guests >= 10) return 0.8
  return 0.5
}

const interestLabel = (id: string) => INTERESTS.find((i) => i.id === id)?.label.toLowerCase() ?? id

export interface RankOptions {
  weights?: RankingWeights
}

export function rankVenue(v: Venue, ctx: PartyContext, opts: RankOptions = {}): RankedVenue {
  const w = opts.weights ?? DEFAULT_WEIGHTS
  const cats = categoriesOf(v)
  const setting = settingForCategories(v.categories)
  const distanceMiles = haversineMiles(ctx.center, { lat: v.lat, lng: v.lng })
  const expected = expectedPriceLevel(ctx.budget, ctx.guestCount)
  const rel = relevanceScore(cats, ctx, v.goodForChildren)

  const factors = {
    distance: distanceScore(distanceMiles, ctx.radiusMiles),
    rating: ratingScore(v.rating, v.reviewCount),
    reviews: reviewsScore(v.reviewCount),
    relevance: rel.score,
    age: ageScore(cats, ctx.childAge),
    setting: settingScore(setting, ctx.setting),
    capacity: capacityScore(v, ctx.guestCount),
    budget: budgetScore(v.priceLevel, expected),
  }

  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1
  let score =
    (Object.keys(factors) as (keyof RankingWeights)[]).reduce((sum, k) => sum + w[k] * factors[k], 0) / totalWeight
  if (v.businessStatus === 'CLOSED_TEMPORARILY') score *= 0.3

  // ---- explanations: only from facts we actually have
  const reasons: Reason[] = []
  const who = ctx.childName?.trim().split(/\s+/)[0]
  if (rel.matchedInterest) {
    reasons.push({
      kind: 'interest',
      text: who ? `Matches ${who}'s love of ${interestLabel(rel.matchedInterest)}` : `Great for kids into ${interestLabel(rel.matchedInterest)}`,
    })
  }
  if (v.rating != null && v.reviewCount && v.rating >= 4.3 && v.reviewCount >= 25) {
    reasons.push({ kind: 'rating', text: `Rated ${v.rating.toFixed(1)} by ${v.reviewCount.toLocaleString('en-US')} Google reviewers` })
  }
  const dist = formatMiles(distanceMiles)
  if (dist && distanceMiles <= Math.max(5, ctx.radiusMiles * 0.35)) reasons.push({ kind: 'distance', text: `Close by — ${dist} away` })
  if (v.goodForChildren === true) reasons.push({ kind: 'kids', text: 'Google lists it as good for kids' })
  if (ctx.childAge != null && factors.age === 1 && cats.some((c) => c.group !== 'general')) {
    reasons.push({ kind: 'age', text: `A good fit for a ${ctx.childAge}-year-old` })
  }
  if (ctx.setting !== 'either' && setting === ctx.setting) {
    reasons.push({ kind: 'setting', text: setting === 'indoor' ? 'Indoor, like you wanted' : 'Outdoor, like you wanted' })
  }
  if (expected != null && v.priceLevel != null && v.priceLevel <= expected) {
    reasons.push({ kind: 'budget', text: v.priceLevel === 0 ? 'Free to visit' : 'Price level fits your budget' })
  }
  if (v.goodForGroups === true && (ctx.guestCount ?? 0) >= 10) reasons.push({ kind: 'groups', text: 'Google lists it as good for groups' })
  // Google's "kids birthday party venue" search is evidence; Geoapify's party bucket is only a category list.
  if (cats.some((c) => c.id === 'birthday-party-venue') && !rel.matchedInterest && !isGeoapifyPlaceId(v.placeId)) {
    reasons.push({ kind: 'party', text: 'Hosts kids’ birthday parties' })
  }

  // ---- card tags: classification + verified facts only
  const tags: string[] = []
  const primary = primaryCategory(v.categories)
  if (primary) tags.push(`${primary.emoji} ${primary.label}`)
  if (setting !== 'either') tags.push(setting === 'indoor' ? 'Indoor' : 'Outdoor')
  if (v.goodForChildren === true) tags.push('Good for kids')
  if (v.goodForGroups === true) tags.push('Good for groups')
  if (expected != null && v.priceLevel != null && v.priceLevel <= expected) tags.push('Fits budget')

  return { ...v, distanceMiles, setting, score: Math.round(score * 1000) / 1000, factors, reasons, tags }
}

/** Rank, drop permanently closed and out-of-radius places, sort best-first. */
export function rankVenues(venues: Venue[], ctx: PartyContext, opts: RankOptions = {}): RankedVenue[] {
  return venues
    .filter((v) => v.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((v) => rankVenue(v, ctx, opts))
    .filter((v) => v.distanceMiles <= ctx.radiusMiles + 0.05)
    .sort((a, b) => b.score - a.score || a.distanceMiles - b.distanceMiles)
}
