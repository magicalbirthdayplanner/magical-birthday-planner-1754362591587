import { VENUE_CATEGORIES, getCategory, type DiscoveryCategory, type InterestId, type Setting } from './taxonomy'

export interface QueryPlanInput {
  childAge?: number | null
  interests: InterestId[]
  setting: Setting
}

export interface PlannedQuery {
  category: DiscoveryCategory
  score: number
  why: string[]
}

export const DEFAULT_MAX_QUERIES = 8

function ageFit(cat: DiscoveryCategory, age: number | null | undefined): number {
  if (age == null) return 0
  const [min, max] = cat.ages
  if (age >= min && age <= max) return 1
  if (age === min - 1 || age === max + 1) return -1
  return -10 // clearly unsuitable: drop
}

function settingFit(cat: DiscoveryCategory, setting: Setting): number {
  if (setting === 'either' || cat.setting === 'either') return 0
  return cat.setting === setting ? 1 : -10
}

/**
 * Context-aware query planning: decide WHICH Places searches to run for a party.
 * An art-loving 7-year-old gets art studios, pottery and children's museums before
 * generic venues; an outdoor toddler party never searches laser tag.
 *
 * Always includes the generic "kids birthday party venue" query first.
 */
export function planQueries(input: QueryPlanInput, maxQueries = DEFAULT_MAX_QUERIES): PlannedQuery[] {
  const interests = new Set(input.interests)
  const scored: PlannedQuery[] = []

  for (const category of VENUE_CATEGORIES) {
    const why: string[] = []
    let score = 0

    const matched = category.interests.filter((i) => interests.has(i))
    if (matched.length) {
      // Specific places (an art studio) beat catch-alls (an activity center) for the same interest.
      score += 4 + matched.length + 2 / category.interests.length
      why.push(`interest:${matched.join(',')}`)
    }
    const a = ageFit(category, input.childAge)
    score += a
    if (a > 0) why.push('age')
    const s = settingFit(category, input.setting)
    score += s
    if (s > 0) why.push('setting')
    if (category.group === 'general') score -= 1 // generic: keep, but behind specific matches
    // Kid-centric places earn a little over generic adult venues.
    if (category.ages[1] <= 13 && category.ages[0] >= 1) score += 0.5

    if (score <= -5) continue
    scored.push({ category, score, why })
  }

  scored.sort((x, y) => y.score - x.score || x.category.priority - y.category.priority)

  const base = getCategory('birthday-party-venue')!
  const plan: PlannedQuery[] = [{ category: base, score: Infinity, why: ['always'] }]
  for (const q of scored) {
    if (plan.length >= Math.max(1, maxQueries)) break
    if (q.category.id === base.id) continue
    plan.push(q)
  }
  return plan
}
