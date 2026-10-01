import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, activeFilterCount, applyFilters, parseFilters, serializeFilters } from '@/lib/discovery/filters'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { fitZoom, gridCluster, toScreen } from '@/lib/geo/cluster'

function v(over: Partial<ClientVenue>): ClientVenue {
  return {
    placeId: Math.random().toString(36), name: 'X', address: '1 Main', shortAddress: null, city: null, state: null, lat: 42.5, lng: -83.1,
    rating: 4.5, reviewCount: 100, priceLevel: 2, categories: ['birthday-party-venue'], primaryTypeLabel: null, photo: null, photos: [],
    businessStatus: 'OPERATIONAL', googleMapsUrl: null, phone: null, website: null, openingHours: null, editorialSummary: null,
    goodForChildren: null, goodForGroups: null, distanceMiles: 3, setting: 'either', score: 0.5, reasons: [], tags: [], ...over,
  }
}

const art = v({ name: 'Paint Place', categories: ['art-studio'], setting: 'indoor', priceLevel: 1, rating: 4.8 })
const park = v({ name: 'Maple Park', categories: ['park'], setting: 'outdoor', priceLevel: 0, rating: 4.4 })
const laser = v({ name: 'Laser Zone', categories: ['laser-tag'], setting: 'indoor', priceLevel: 3, rating: null })
const bakery = v({ name: 'Sugar Bakery', categories: ['bakery'], setting: 'either', priceLevel: null })
const all = [art, park, laser, bakery]

describe('chips', () => {
  const names = (list: ClientVenue[]) => list.map((x) => x.name)
  it('filters by chip', () => {
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'recommended' }))).toEqual(names(all))
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'indoor' }))).toEqual(['Paint Place', 'Laser Zone'])
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'outdoor' }))).toEqual(['Maple Park'])
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'art' }))).toEqual(['Paint Place'])
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'parks' }))).toEqual(['Maple Park'])
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'vendors' }))).toEqual(['Sugar Bakery'])
  })
  it('budget chip only includes places with a known, fitting price', () => {
    expect(names(applyFilters(all, DEFAULT_FILTERS, { chip: 'budget', expectedPrice: 1 }))).toEqual(['Paint Place', 'Maple Park'])
  })
  it('searches names and tags', () => {
    expect(names(applyFilters(all, DEFAULT_FILTERS, { query: 'paint' }))).toEqual(['Paint Place'])
  })
})

describe('filters', () => {
  const names = (f: Partial<typeof DEFAULT_FILTERS>) => applyFilters(all, { ...DEFAULT_FILTERS, ...f }).map((x) => x.name)
  it('rating excludes unrated places', () => {
    expect(names({ minRating: 4.5 })).toEqual(['Paint Place', 'Sugar Bakery'])
    expect(names({ minRating: 4 })).not.toContain('Laser Zone')
  })
  it('price excludes unknown prices', () => {
    expect(names({ prices: [0, 1] })).toEqual(['Paint Place', 'Maple Park'])
  })
  it('age bands use category age suitability', () => {
    expect(names({ ages: ['toddler'] })).not.toContain('Laser Zone')
    expect(names({ ages: ['tweens'] })).toContain('Laser Zone')
  })
  it('interests and setting', () => {
    expect(names({ interests: ['art'] })).toEqual(['Paint Place'])
    expect(names({ setting: 'outdoor' })).toEqual(['Maple Park'])
  })
  it('counts and round-trips', () => {
    const f = { ...DEFAULT_FILTERS, minRating: 4 as const, prices: [1], ages: ['kids' as const] }
    expect(activeFilterCount(f)).toBe(3)
    expect(parseFilters(serializeFilters(f))).toEqual(f)
    expect(parseFilters('garbage')).toEqual(DEFAULT_FILTERS)
  })
})

describe('schematic map clustering', () => {
  const pts = [
    { lat: 42.56, lng: -83.18, item: 'a' },
    { lat: 42.5601, lng: -83.1801, item: 'b' },
    { lat: 42.7, lng: -83.0, item: 'c' },
  ]
  it('fits points and clusters near-duplicates', () => {
    const { center, zoom } = fitZoom(pts, 390, 600)
    const vp = { center, zoom, width: 390, height: 600 }
    for (const p of pts) {
      const s = toScreen(p, vp)
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(390)
    }
    const clusters = gridCluster(pts, vp)
    expect(clusters.map((c) => c.items.length).sort()).toEqual([1, 2])
  })
  it('splits clusters when zoomed in', () => {
    const vp = { center: { lat: 42.56, lng: -83.18 }, zoom: 20, width: 390, height: 600 }
    expect(gridCluster(pts.slice(0, 2), vp)).toHaveLength(2)
  })
})
