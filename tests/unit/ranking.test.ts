import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  budgetScore,
  distanceScore,
  expectedPriceLevel,
  rankVenue,
  rankVenues,
  ratingScore,
  resolveWeights,
} from '@/lib/discovery/ranking'
import type { PartyContext, Venue } from '@/lib/discovery/types'

const center = { lat: 42.5627, lng: -83.1799 }
const ctx: PartyContext = {
  childName: 'Ava Smith',
  childAge: 7,
  guestCount: 20,
  budget: 500,
  interests: ['art'],
  setting: 'either',
  zip: '48084',
  center,
  radiusMiles: 20,
}

function venue(over: Partial<Venue> = {}): Venue {
  return {
    placeId: over.placeId ?? Math.random().toString(36).slice(2),
    name: 'Place',
    address: '1 Main St',
    shortAddress: null,
    city: 'Troy',
    state: 'MI',
    postalCode: '48084',
    lat: center.lat + 0.02,
    lng: center.lng,
    rating: 4.5,
    reviewCount: 200,
    priceLevel: 2,
    types: [],
    primaryType: null,
    primaryTypeLabel: null,
    categories: ['birthday-party-venue'],
    photos: [],
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: null,
    phone: null,
    website: null,
    openingHours: null,
    editorialSummary: null,
    goodForChildren: null,
    goodForGroups: null,
    maxCapacity: null,
    lastSyncedAt: null,
    detailsSyncedAt: null,
    ...over,
  }
}

describe('factor functions', () => {
  it('rating uses a Bayesian average so few-review 5.0s do not dominate', () => {
    expect(ratingScore(4.7, 900)).toBeGreaterThan(ratingScore(5, 3))
    expect(ratingScore(null, null)).toBe(0.5)
  })
  it('distance decays toward the radius edge', () => {
    expect(distanceScore(0, 20)).toBe(1)
    expect(distanceScore(20, 20)).toBe(0)
    expect(distanceScore(5, 20)).toBeGreaterThan(distanceScore(15, 20))
  })
  it('budget fit uses per-guest spend', () => {
    expect(expectedPriceLevel(500, 20)).toBe(2) // $25/guest → "$$"
    expect(expectedPriceLevel(200, 20)).toBe(1)
    expect(expectedPriceLevel(2000, 20)).toBe(4)
    expect(expectedPriceLevel(null, 20)).toBeNull()
    expect(budgetScore(4, 1)).toBeLessThan(budgetScore(1, 1))
    expect(budgetScore(null, 2)).toBe(0.5)
    expect(budgetScore(0, 1)).toBe(1)
  })
})

describe('rankVenues', () => {
  it('prefers an interest match over a slightly better-rated generic place', () => {
    const art = venue({ placeId: 'art', name: 'Art Studio', categories: ['art-studio'], rating: 4.5, reviewCount: 150 })
    const generic = venue({ placeId: 'gen', name: 'Banquet Hall', categories: ['banquet-hall'], rating: 4.7, reviewCount: 300 })
    const ranked = rankVenues([generic, art], ctx)
    expect(ranked[0].placeId).toBe('art')
  })

  it('is not just a rating sort', () => {
    const near = venue({ placeId: 'near', categories: ['art-studio'], rating: 4.3, reviewCount: 80 })
    const farBetter = venue({ placeId: 'far', categories: ['art-studio'], rating: 4.9, reviewCount: 90, lat: center.lat + 0.27 })
    const ranked = rankVenues([farBetter, near], ctx)
    expect(ranked.map((v) => v.placeId)).toEqual(['near', 'far'])
  })

  it('drops permanently closed and out-of-radius places, penalises temporarily closed', () => {
    const ranked = rankVenues(
      [
        venue({ placeId: 'closed', businessStatus: 'CLOSED_PERMANENTLY' }),
        venue({ placeId: 'far', lat: center.lat + 1 }),
        venue({ placeId: 'temp', businessStatus: 'CLOSED_TEMPORARILY' }),
        venue({ placeId: 'ok' }),
      ],
      ctx,
    )
    expect(ranked.map((v) => v.placeId)).toEqual(['ok', 'temp'])
  })

  it('penalises the wrong setting', () => {
    const indoorCtx = { ...ctx, setting: 'indoor' as const, interests: [] }
    const park = venue({ placeId: 'park', categories: ['park'] })
    const bowling = venue({ placeId: 'bowl', categories: ['bowling'] })
    expect(rankVenues([park, bowling], indoorCtx)[0].placeId).toBe('bowl')
  })

  it('treats missing data as neutral and never invents facts', () => {
    const bare = rankVenue(venue({ rating: null, reviewCount: null, priceLevel: null, photos: [], website: null, address: null }), ctx)
    expect(bare.factors.rating).toBe(0.5)
    expect(bare.factors.budget).toBe(0.5)
    expect(bare.reasons.find((r) => r.kind === 'rating')).toBeUndefined()
    expect(bare.reasons.find((r) => r.kind === 'budget')).toBeUndefined()
    expect(bare.tags).not.toContain('Good for kids')
    expect(bare.tags).not.toContain('Fits budget')
  })

  it('explains recommendations from real facts', () => {
    const v = rankVenue(venue({ categories: ['art-studio'], rating: 4.8, reviewCount: 312, goodForChildren: true }), ctx)
    const texts = v.reasons.map((r) => r.text)
    expect(texts).toContain("Matches Ava's love of art")
    expect(texts).toContain('Rated 4.8 by 312 Google reviewers')
    expect(texts).toContain('Google lists it as good for kids')
    expect(v.tags[0]).toBe('🎨 Art studio')
    expect(v.tags).toContain('Indoor')
  })

  it('weights are configurable', () => {
    expect(resolveWeights(undefined)).toEqual(DEFAULT_WEIGHTS)
    expect(resolveWeights('{"rating": 5, "bogus": 1, "distance": -1}').rating).toBe(5)
    expect(resolveWeights('{"distance": -1}').distance).toBe(DEFAULT_WEIGHTS.distance)
    expect(resolveWeights('not json')).toEqual(DEFAULT_WEIGHTS)

    const near = venue({ placeId: 'near', categories: ['banquet-hall'], rating: 3.9, reviewCount: 40 })
    const great = venue({ placeId: 'great', categories: ['banquet-hall'], rating: 4.9, reviewCount: 2000, lat: center.lat + 0.2 })
    const distanceOnly = resolveWeights({ distance: 1, rating: 0, reviews: 0, relevance: 0, age: 0, setting: 0, capacity: 0, budget: 0 })
    const ratingOnly = resolveWeights({ distance: 0, rating: 1, reviews: 0, relevance: 0, age: 0, setting: 0, capacity: 0, budget: 0 })
    expect(rankVenues([great, near], ctx, { weights: distanceOnly })[0].placeId).toBe('near')
    expect(rankVenues([great, near], ctx, { weights: ratingOnly })[0].placeId).toBe('great')
  })
})
