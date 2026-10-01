/** Client-side result filters & chips. Pure. Unknown data is never treated as a match. */
import type { ClientVenue } from './client-venue'
import { AGE_BANDS, getCategory, type AgeBandId, type ChipId, type InterestId } from './taxonomy'

export type ChipFilter = 'recommended' | 'indoor' | 'outdoor' | 'budget' | ChipId
export type PartySizeBand = 'lt10' | '10-20' | '20-40' | '40+'

export interface VenueFilters {
  setting: 'any' | 'indoor' | 'outdoor'
  minRating: 0 | 4 | 4.5
  prices: number[]
  ages: AgeBandId[]
  partySize: PartySizeBand | null
  interests: InterestId[]
}

export const DEFAULT_FILTERS: VenueFilters = { setting: 'any', minRating: 0, prices: [], ages: [], partySize: null, interests: [] }

export function activeFilterCount(f: VenueFilters): number {
  return (
    (f.setting !== 'any' ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.prices.length ? 1 : 0) +
    (f.ages.length ? 1 : 0) +
    (f.partySize ? 1 : 0) +
    (f.interests.length ? 1 : 0)
  )
}

const PARTY_SIZE_MIN: Record<PartySizeBand, number> = { lt10: 1, '10-20': 10, '20-40': 20, '40+': 40 }

function categoriesOf(v: ClientVenue) {
  return v.categories.map(getCategory).filter((c): c is NonNullable<ReturnType<typeof getCategory>> => !!c)
}

export function matchesChip(v: ClientVenue, chip: ChipFilter, expectedPrice: number | null): boolean {
  switch (chip) {
    case 'recommended':
      return true
    case 'indoor':
    case 'outdoor':
      return v.setting === chip
    case 'budget':
      if (v.priceLevel == null) return false
      return v.priceLevel === 0 || v.priceLevel <= (expectedPrice ?? 1)
    default:
      return categoriesOf(v).some((c) => c.chips.includes(chip))
  }
}

export function applyFilters(venues: ClientVenue[], f: VenueFilters, opts: { chip?: ChipFilter; query?: string; expectedPrice?: number | null } = {}): ClientVenue[] {
  const q = opts.query?.trim().toLowerCase() ?? ''
  const interests = new Set(f.interests)
  const ageRanges = AGE_BANDS.filter((b) => f.ages.includes(b.id)).map((b) => b.range)
  return venues.filter((v) => {
    if (opts.chip && !matchesChip(v, opts.chip, opts.expectedPrice ?? null)) return false
    if (q) {
      const hay = `${v.name} ${v.address ?? ''} ${v.tags.join(' ')} ${v.primaryTypeLabel ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (f.setting !== 'any' && v.setting !== f.setting) return false
    if (f.minRating && (v.rating == null || v.rating < f.minRating)) return false
    if (f.prices.length && (v.priceLevel == null || !f.prices.includes(v.priceLevel))) return false
    const cats = categoriesOf(v)
    if (ageRanges.length && !cats.some((c) => ageRanges.some(([lo, hi]) => c.ages[0] <= hi && c.ages[1] >= lo))) return false
    if (interests.size && !cats.some((c) => c.interests.some((i) => interests.has(i)))) return false
    // Capacity is rarely published: only exclude places whose known capacity is too small.
    if (f.partySize && v.goodForGroups === false && PARTY_SIZE_MIN[f.partySize] >= 10) return false
    return true
  })
}

export function serializeFilters(f: VenueFilters): string {
  return JSON.stringify(f)
}

export function parseFilters(raw: string | null): VenueFilters {
  if (!raw) return DEFAULT_FILTERS
  try {
    const x = JSON.parse(raw)
    return {
      setting: x.setting === 'indoor' || x.setting === 'outdoor' ? x.setting : 'any',
      minRating: x.minRating === 4 || x.minRating === 4.5 ? x.minRating : 0,
      prices: Array.isArray(x.prices) ? x.prices.filter((p: unknown) => typeof p === 'number' && p >= 0 && p <= 4) : [],
      ages: Array.isArray(x.ages) ? x.ages.filter((a: unknown) => AGE_BANDS.some((b) => b.id === a)) : [],
      partySize: ['lt10', '10-20', '20-40', '40+'].includes(x.partySize) ? x.partySize : null,
      interests: Array.isArray(x.interests) ? x.interests.filter((i: unknown) => typeof i === 'string') : [],
    }
  } catch {
    return DEFAULT_FILTERS
  }
}
