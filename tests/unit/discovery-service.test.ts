import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscoveryConfig } from '@/lib/discovery/config'
import { resolveWeights } from '@/lib/discovery/ranking'
import { DiscoveryUnavailableError, discoverVenues, getVenueDetails, searchCacheKey } from '@/lib/discovery/service'
import { MemoryDiscoveryStore } from '@/lib/discovery/store'
import type { PartyContext } from '@/lib/discovery/types'
import { PlacesError, type PlacesApi, type RawPlace } from '@/lib/google/places'
import { rawPlace } from '../fixtures/places'

const ctx: PartyContext = {
  childName: 'Ava',
  childAge: 7,
  guestCount: 20,
  budget: 500,
  interests: ['art'],
  setting: 'either',
  zip: '48084',
  center: { lat: 42.5627, lng: -83.1799 },
  radiusMiles: 20,
}

const config: DiscoveryConfig = { searchTtlHours: 24, detailsTtlDays: 7, maxQueries: 4, concurrency: 2, weights: resolveWeights() }

function fakePlaces(byQuery: (q: string) => RawPlace[] | Error): PlacesApi & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async searchText({ textQuery }) {
      calls.push(textQuery)
      const r = byQuery(textQuery)
      if (r instanceof Error) throw r
      return r
    },
    async getPlace(id) {
      calls.push(`details:${id}`)
      return rawPlace({ id, name: 'Detailed', websiteUri: 'https://example.com', nationalPhoneNumber: '(248) 555-0100', goodForChildren: true })
    },
    async getPhotoUri() {
      return 'https://lh3.googleusercontent.com/x'
    },
  }
}

describe('discoverVenues', () => {
  let store: MemoryDiscoveryStore
  let clock: Date
  const now = () => clock

  beforeEach(() => {
    store = new MemoryDiscoveryStore()
    clock = new Date('2026-10-01T12:00:00Z')
  })

  it('runs the context-aware plan and returns ranked, deduplicated results', async () => {
    const shared = rawPlace({ id: 'ChIJshared0001', name: 'Shared Art Studio', types: ['art_studio'] })
    const places = fakePlaces((q) => (q.includes('art studio') ? [shared, rawPlace({ name: 'Paint Spot' })] : [shared, rawPlace()]))
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(places.calls).toHaveLength(4)
    expect(res.meta.cacheMisses).toBe(4)
    expect(res.meta.apiCalls).toBe(4)
    expect(res.venues.filter((v) => v.placeId === 'ChIJshared0001')).toHaveLength(1)
    const sharedVenue = res.venues.find((v) => v.placeId === 'ChIJshared0001')!
    expect(sharedVenue.categories).toEqual(expect.arrayContaining(['birthday-party-venue', 'art-studio']))
    expect(res.total).toBe(res.venues.length)
    expect(res.venues[0].score).toBeGreaterThanOrEqual(res.venues.at(-1)!.score)
  })

  it('serves fresh results from cache without calling Google', async () => {
    const places = fakePlaces(() => [rawPlace()])
    await discoverVenues(ctx, { places, store, config, now })
    places.calls.length = 0
    clock = new Date(clock.getTime() + 23 * 3600_000)
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(places.calls).toHaveLength(0)
    expect(res.meta.cacheHits).toBe(4)
    expect(res.venues.length).toBeGreaterThan(0)
  })

  it('refreshes stale cache entries after the TTL', async () => {
    const places = fakePlaces(() => [rawPlace()])
    await discoverVenues(ctx, { places, store, config, now })
    places.calls.length = 0
    clock = new Date(clock.getTime() + 25 * 3600_000)
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(places.calls).toHaveLength(4)
    expect(res.meta.cacheMisses).toBe(4)
  })

  it('serves stale cache when Google fails (stale-if-error)', async () => {
    let fail = false
    const places = fakePlaces(() => (fail ? new PlacesError('timeout', 't') : [rawPlace()]))
    await discoverVenues(ctx, { places, store, config, now })
    fail = true
    clock = new Date(clock.getTime() + 48 * 3600_000)
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(res.venues.length).toBeGreaterThan(0)
    expect(res.meta.degraded).toBe('stale_cache')
    expect(res.meta.apiErrors.every((e) => e.kind === 'timeout')).toBe(true)
  })

  it('falls back to stored venues near the party when Google is down and nothing is cached for this query', async () => {
    await store.saveVenueDetails({ ...(await import('@/lib/google/places')).normalizePlace(rawPlace({ name: 'Known Venue' }))! })
    const places = fakePlaces(() => new PlacesError('quota', 'q'))
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(res.meta.degraded).toBe('stored_venues')
    expect(res.venues.map((v) => v.name)).toContain('Known Venue')
  })

  it('throws a typed error when Google is down and nothing is known', async () => {
    const places = fakePlaces(() => new PlacesError('quota', 'q'))
    await expect(discoverVenues(ctx, { places, store, config, now })).rejects.toMatchObject({ kind: 'quota' })
    const timeouts = fakePlaces(() => new PlacesError('timeout', 't'))
    await expect(discoverVenues(ctx, { places: timeouts, store, config, now })).rejects.toBeInstanceOf(DiscoveryUnavailableError)
  })

  it('returns an empty list (not an error) when Google has no results', async () => {
    const places = fakePlaces(() => [])
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(res.venues).toEqual([])
    expect(res.meta.apiErrors).toEqual([])
  })

  it('filters places beyond the radius', async () => {
    const places = fakePlaces(() => [rawPlace({ name: 'Too Far', lat: 43.9, lng: -83.18 }), rawPlace({ name: 'Near' })])
    const res = await discoverVenues(ctx, { places, store, config, now })
    expect(res.venues.map((v) => v.name)).not.toContain('Too Far')
  })

  it('searches only the requested categories (vendors on demand)', async () => {
    const places = fakePlaces(() => [rawPlace({ types: ['bakery'] })])
    const res = await discoverVenues(ctx, { places, store, config, now }, { categoryIds: ['bakery', 'cake-shop', 'nope'] })
    expect(places.calls).toEqual(['bakery custom birthday cakes', 'cake shop'])
    expect(res.meta.categories).toEqual(['bakery', 'cake-shop'])
  })

  it('emits metrics for cache hits, misses, latency and errors', async () => {
    const onMetric = vi.fn()
    const places = fakePlaces((q) => (q.includes('pottery') ? new PlacesError('unavailable', 'x') : [rawPlace()]))
    await discoverVenues(ctx, { places, store, config, now, onMetric })
    const names = onMetric.mock.calls.map((c) => c[0])
    expect(names).toContain('places_search')
    expect(names).toContain('places_error')
    expect(names).toContain('discovery_completed')
  })

  it('cache keys depend on query, location and radius', () => {
    const a = searchCacheKey('art-studio', ctx)
    expect(searchCacheKey('art-studio', ctx)).toBe(a)
    expect(searchCacheKey('park', ctx)).not.toBe(a)
    expect(searchCacheKey('art-studio', { ...ctx, radiusMiles: 10 })).not.toBe(a)
    expect(searchCacheKey('art-studio', { ...ctx, center: { lat: 40.7, lng: -74 } })).not.toBe(a)
  })
})

describe('getVenueDetails', () => {
  it('fetches details once, then serves them from cache within the TTL', async () => {
    const store = new MemoryDiscoveryStore()
    const places = fakePlaces(() => [])
    const clock = new Date('2026-10-01T00:00:00Z')
    const first = await getVenueDetails('ChIJdetail0001', { places, store, config, now: () => clock }, ctx)
    expect(first.fromCache).toBe(false)
    expect(first.venue.website).toBe('https://example.com')
    expect(first.venue.goodForChildren).toBe(true)
    const second = await getVenueDetails('ChIJdetail0001', { places, store, config, now: () => clock }, ctx)
    expect(second.fromCache).toBe(true)
    expect(places.calls.filter((c) => c.startsWith('details:'))).toHaveLength(1)
    expect('reasons' in second.venue && second.venue.reasons.length).toBeTruthy()
  })

  it('serves stored data marked stale when Google fails', async () => {
    const store = new MemoryDiscoveryStore()
    const { normalizePlace } = await import('@/lib/google/places')
    await store.saveVenueDetails(normalizePlace(rawPlace({ id: 'ChIJstored0001', name: 'Stored' }))!)
    const places = { ...fakePlaces(() => []), getPlace: async () => { throw new PlacesError('unavailable', 'x') } }
    const res = await getVenueDetails('ChIJstored0001', { places, store, config })
    expect(res.stale).toBe(true)
    expect(res.venue.name).toBe('Stored')
  })
})

describe('duplicates', () => {
  it('dedupes a place returned twice in one Google response before storing it', async () => {
    const store = new MemoryDiscoveryStore()
    const saved: number[] = []
    const orig = store.saveSearch.bind(store)
    store.saveSearch = async (input) => {
      saved.push(input.venues.length)
      return orig(input)
    }
    const dup = rawPlace({ id: 'ChIJdupdupdup01', name: 'Twice' })
    const places = fakePlaces(() => [dup, { ...dup }, rawPlace()])
    const res = await discoverVenues(ctx, { places, store, config: { ...config, maxQueries: 1 } })
    expect(saved).toEqual([2])
    expect(res.venues.filter((v) => v.placeId === 'ChIJdupdupdup01')).toHaveLength(1)
  })
})
