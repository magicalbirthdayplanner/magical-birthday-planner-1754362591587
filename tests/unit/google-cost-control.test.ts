import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlacesClient } from '@/lib/google/places'
import { snapRadius, discoveryConfig } from '@/lib/discovery/config'
import { discoverVenues, getVenueDetails } from '@/lib/discovery/service'
import { MemoryDiscoveryStore } from '@/lib/discovery/store'
import { resolveWeights } from '@/lib/discovery/ranking'
import { googleBudgetFor, resetGoogleBudgets } from '@/lib/server/google-budget'
import type { PlacesApi } from '@/lib/google/places'
import type { PartyContext } from '@/lib/discovery/types'
import { rawPlace } from '../fixtures/places'

const center = { lat: 42.5627, lng: -83.1799 }
const ctx: PartyContext = { childAge: 7, interests: ['art'], setting: 'either', zip: '48084', center, radiusMiles: 20, guestCount: 20, budget: 500 }
const config = { searchTtlHours: 24, detailsTtlDays: 7, maxQueries: 8, concurrency: 4, weights: resolveWeights() }

function counting(): PlacesApi & { calls: number } {
  const api = {
    calls: 0,
    async searchText() {
      api.calls++
      return [rawPlace()]
    },
    async getPlace(id: string) {
      api.calls++
      return rawPlace({ id })
    },
    async getPhotoUri() {
      return 'https://lh3.googleusercontent.com/x'
    },
  }
  return api
}

describe('Google response robustness', () => {
  const json = (body: string, status = 200) => async () => new Response(body, { status, headers: { 'Content-Type': 'application/json' } })

  it('treats malformed JSON as an unavailable upstream (no crash)', async () => {
    const c = createPlacesClient({ apiKey: 'k', fetchImpl: json('<html>oops</html>') })
    await expect(c.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('drops non-object entries and unexpected shapes', async () => {
    const c = createPlacesClient({ apiKey: 'k', fetchImpl: json(JSON.stringify({ places: [null, 42, 'x', rawPlace({ name: 'Real' })] })) })
    const out = await c.searchText({ textQuery: 'x', center, radiusMeters: 1000 })
    expect(out).toHaveLength(1)
    const weird = createPlacesClient({ apiKey: 'k', fetchImpl: json(JSON.stringify({ places: 'nope' })) })
    expect(await weird.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).toEqual([])
  })

  it('caps the location-bias radius (Google max 50 km) for huge radii', async () => {
    const fetchImpl = vi.fn(json(JSON.stringify({ places: [] })))
    const c = createPlacesClient({ apiKey: 'k', fetchImpl })
    await c.searchText({ textQuery: 'x', center, radiusMeters: 10_000_000, pageSize: 500 })
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.locationBias.circle.radius).toBe(50_000)
    expect(body.pageSize).toBe(20)
  })
})

describe('radius validation', () => {
  it('snaps any radius to the supported set (bounded cache keys)', () => {
    expect(snapRadius(1)).toBe(5)
    expect(snapRadius(13)).toBe(10)
    expect(snapRadius(37)).toBe(30)
    expect(snapRadius(5000)).toBe(50)
    expect(snapRadius(-4)).toBe(5)
    expect(snapRadius('abc')).toBe(20)
    expect(snapRadius(NaN)).toBe(20)
  })

  it('caps queries per discovery even when misconfigured', () => {
    expect(discoveryConfig({ DISCOVERY_MAX_QUERIES: '500' }).maxQueries).toBeLessThanOrEqual(16)
    expect(discoveryConfig({ DISCOVERY_CONCURRENCY: '99' }).concurrency).toBeLessThanOrEqual(8)
  })
})

describe('outbound call budget', () => {
  afterAll(() => {
    delete process.env.GOOGLE_USER_HOURLY_CALLS
    resetGoogleBudgets()
  })
  beforeEach(() => {
    resetGoogleBudgets()
    delete process.env.GOOGLE_USER_HOURLY_CALLS
  })

  it('one discovery makes at most maxQueries Google calls', async () => {
    const places = counting()
    await discoverVenues(ctx, { places, store: new MemoryDiscoveryStore(), config })
    expect(places.calls).toBeLessThanOrEqual(config.maxQueries)
  })

  it('stops calling Google once a user exhausts the hourly budget', async () => {
    process.env.GOOGLE_USER_HOURLY_CALLS = '10'
    const places = counting()
    const budget = googleBudgetFor('user-1')
    const store = new MemoryDiscoveryStore()
    await discoverVenues(ctx, { places, store, config, budget })
    const first = places.calls
    expect(first).toBe(8)
    // New location ⇒ cold cache; only 2 calls left in the budget.
    const res = await discoverVenues({ ...ctx, center: { lat: 40.75, lng: -73.99 } }, { places, store, config, budget })
    expect(places.calls - first).toBe(2)
    expect(res.meta.apiErrors.filter((e) => e.kind === 'quota').length).toBe(6)
    // Another user is unaffected.
    const other = counting()
    await discoverVenues(ctx, { places: other, store: new MemoryDiscoveryStore(), config, budget: googleBudgetFor('user-2') })
    expect(other.calls).toBe(8)
  })

  it('cache hits never consume budget', async () => {
    process.env.GOOGLE_USER_HOURLY_CALLS = '8'
    const places = counting()
    const budget = googleBudgetFor('user-3')
    const store = new MemoryDiscoveryStore()
    await discoverVenues(ctx, { places, store, config, budget })
    for (let i = 0; i < 5; i++) await discoverVenues(ctx, { places, store, config, budget })
    expect(places.calls).toBe(8)
  })

  it('details respect the budget and fall back to stored data', async () => {
    process.env.GOOGLE_USER_HOURLY_CALLS = '1'
    const places = counting()
    const store = new MemoryDiscoveryStore()
    const budget = googleBudgetFor('user-4')
    expect(budget.allow(1)).toBe(true) // spend it
    await expect(getVenueDetails('ChIJnothingStored01', { places, store, config, budget })).rejects.toMatchObject({ kind: 'quota' })
    expect(places.calls).toBe(0)
  })
})
