import { describe, expect, it } from 'vitest'
import { planQueries } from '@/lib/discovery/query-plan'
import {
  CATEGORIES,
  ageBandFor,
  categoriesForGoogleTypes,
  getCategory,
  primaryCategory,
  settingForCategories,
} from '@/lib/discovery/taxonomy'

describe('taxonomy', () => {
  it('has unique ids and sane age ranges', () => {
    const ids = CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CATEGORIES) {
      expect(c.ages[0]).toBeLessThanOrEqual(c.ages[1])
      expect(c.query.length).toBeGreaterThan(2)
    }
  })

  it('covers the required indoor, outdoor, general and vendor categories', () => {
    for (const id of ['indoor-playground', 'trampoline-park', 'bowling', 'arcade', 'childrens-museum', 'art-studio', 'pottery-studio',
      'gymnastics', 'dance-studio', 'kids-activity-center', 'laser-tag', 'movie-theater', 'science-center', 'cooking-studio',
      'indoor-event-venue', 'park', 'playground', 'zoo', 'farm', 'botanical-garden', 'outdoor-recreation', 'sports-facility',
      'picnic-area', 'splash-pad', 'birthday-party-venue', 'event-venue', 'community-center', 'banquet-hall', 'party-hall',
      'bakery', 'cake-shop', 'balloon-decorator', 'party-rental', 'photographer', 'face-painter', 'magician', 'entertainer', 'dj', 'caterer']) {
      expect(getCategory(id), id).toBeDefined()
    }
  })

  it('classifies Google types', () => {
    expect(categoriesForGoogleTypes(['bowling_alley', 'establishment'])).toEqual(['bowling'])
    expect(categoriesForGoogleTypes(['park'])).toContain('park')
    expect(categoriesForGoogleTypes([])).toEqual([])
    expect(categoriesForGoogleTypes(undefined)).toEqual([])
  })

  it('derives setting and primary category', () => {
    expect(settingForCategories(['birthday-party-venue', 'art-studio'])).toBe('indoor')
    expect(settingForCategories(['park'])).toBe('outdoor')
    expect(settingForCategories(['birthday-party-venue'])).toBe('either')
    expect(primaryCategory(['birthday-party-venue', 'pottery-studio'])?.id).toBe('pottery-studio')
  })

  it('maps ages to bands', () => {
    expect(ageBandFor(2)).toBe('toddler')
    expect(ageBandFor(4)).toBe('preschool')
    expect(ageBandFor(7)).toBe('kids')
    expect(ageBandFor(11)).toBe('tweens')
    expect(ageBandFor(null)).toBeNull()
  })
})

describe('planQueries (context-aware search)', () => {
  it('7-year-old who loves art: art places first, never generic restaurants', () => {
    const plan = planQueries({ childAge: 7, interests: ['art'], setting: 'either' }).map((q) => q.category.id)
    expect(plan[0]).toBe('birthday-party-venue')
    expect(plan.slice(1, 4)).toEqual(expect.arrayContaining(['art-studio', 'pottery-studio']))
    expect(plan).toContain('childrens-museum')
    expect(plan.length).toBeLessThanOrEqual(8)
    for (const id of plan) expect(getCategory(id)!.group).not.toBe('vendor')
  })

  it('indoor preference excludes outdoor-only categories', () => {
    const plan = planQueries({ childAge: 8, interests: ['nature', 'animals'], setting: 'indoor' })
    for (const q of plan) expect(q.category.setting).not.toBe('outdoor')
    expect(plan.map((q) => q.category.id)).toContain('aquarium')
  })

  it('outdoor toddler party never searches laser tag or trampoline parks', () => {
    const plan = planQueries({ childAge: 2, interests: [], setting: 'outdoor' }).map((q) => q.category.id)
    expect(plan).not.toContain('laser-tag')
    expect(plan).not.toContain('trampoline-park')
    expect(plan).toEqual(expect.arrayContaining(['park', 'playground']))
  })

  it('respects maxQueries', () => {
    expect(planQueries({ childAge: 7, interests: ['art'], setting: 'either' }, 3)).toHaveLength(3)
    expect(planQueries({ childAge: 7, interests: [], setting: 'either' }, 0)).toHaveLength(1)
  })
})
