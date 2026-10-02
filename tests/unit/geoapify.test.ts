import { afterEach, describe, expect, it, vi } from 'vitest'
import { GEOAPIFY_CATEGORIES, categoriesForGeoapify, geoapifySupports, isGeoapifyPlaceId, primaryGeoapifyType } from '@/lib/geoapify/categories'
import { createGeoapifyClient, normalizeGeoapifyPlace, openingHoursFromOsm, type GeoapifyProperties } from '@/lib/geoapify/places'
import { geoapifySource } from '@/lib/geoapify/source'
import { discoverVenues, getVenueDetails, searchCacheKey } from '@/lib/discovery/service'
import { planQueries } from '@/lib/discovery/query-plan'
import { MemoryDiscoveryStore } from '@/lib/discovery/store'
import { resolveWeights } from '@/lib/discovery/ranking'
import { CATEGORIES } from '@/lib/discovery/taxonomy'
import { placesProvider } from '@/lib/discovery/server-deps'
import { PlacesError } from '@/lib/google/places'
import { venueToRow } from '@/lib/discovery/venue-row'
import type { PartyContext } from '@/lib/discovery/types'
import { GET as tileGET } from '@/app/api/map/tiles/[z]/[x]/[y]/route'
import { resetRateLimits } from '@/lib/server/rate-limit'

const center = { lat: 42.5627, lng: -83.1799 }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let seq = 0
function feature(over: Partial<GeoapifyProperties> = {}): { properties: GeoapifyProperties } {
  seq++
  return {
    properties: {
      place_id: `51abcdef${String(seq).padStart(8, '0')}f00103f9013332da3e`,
      name: `Place ${seq}`,
      categories: ['entertainment', 'entertainment.bowling_alley'],
      address_line1: `Place ${seq}`,
      address_line2: '4209 Coolidge Highway, Royal Oak, MI 48073, United States of America',
      housenumber: '4209',
      street: 'Coolidge Highway',
      city: 'Royal Oak',
      state_code: 'MI',
      postcode: '48073',
      lat: 42.53,
      lon: -83.18,
      ...over,
    },
  }
}

describe('Geoapify categories', () => {
  it('maps only to real taxonomy categories and classifies by exact category', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id))
    for (const id of Object.keys(GEOAPIFY_CATEGORIES)) expect(ids.has(id)).toBe(true)
    expect(categoriesForGeoapify(['entertainment', 'entertainment.bowling_alley'])).toEqual(['bowling'])
    expect(categoriesForGeoapify(['leisure', 'leisure.park', 'leisure.park.garden']).sort()).toEqual(['botanical-garden', 'park'])
    expect(geoapifySupports('magician')).toBe(false)
    // Only kid-oriented museums are children's museums; labels skip building/attribute tags.
    expect(categoriesForGeoapify(['entertainment.museum'], 'Clawson Historical Museum')).toEqual([])
    expect(categoriesForGeoapify(['entertainment.museum'], 'Cranbrook Institute of Science')).toEqual(['childrens-museum'])
    expect(primaryGeoapifyType(['building', 'building.residential', 'building.tourism', 'entertainment', 'entertainment.museum'])).toBe('entertainment.museum')
    expect(primaryGeoapifyType(['building', 'building.tourism', 'tourism', 'tourism.sights'])).toBe('tourism.sights')
    expect(geoapifySupports('bowling')).toBe(true)
  })

  it('the query plan skips categories the source cannot search', () => {
    const plan = planQueries({ childAge: 7, interests: ['art'], setting: 'either' }, 8, geoapifySupports)
    expect(plan.length).toBeGreaterThan(0)
    for (const q of plan) expect(geoapifySupports(q.category.id)).toBe(true)
    expect(plan.map((q) => q.category.id)).not.toContain('pottery-studio')
    // Unfiltered plan unchanged (Google path).
    expect(planQueries({ childAge: 7, interests: ['art'], setting: 'either' }, 8)[0].category.id).toBe('birthday-party-venue')
  })
})

describe('normalizeGeoapifyPlace', () => {
  it('normalizes without inventing ratings, prices or photos', () => {
    const v = normalizeGeoapifyPlace(
      feature({ name: 'Bowlero', address_line1: 'Bowlero', website: 'https://bowlero.example', contact: { phone: '+1 248-555-0100' }, opening_hours: 'Mo-Fr 10:00-21:00; Sa,Su 09:00-23:00' }).properties,
      ['birthday-party-venue'],
    )!
    expect(v.placeId.startsWith('geo_')).toBe(true)
    expect(isGeoapifyPlaceId(v.placeId)).toBe(true)
    expect(v.name).toBe('Bowlero')
    expect(v.address).toBe('4209 Coolidge Highway, Royal Oak, MI 48073')
    expect(v.shortAddress).toBe('4209 Coolidge Highway, Royal Oak')
    expect(v.categories.sort()).toEqual(['birthday-party-venue', 'bowling'])
    expect(v.primaryType).toBe('entertainment.bowling_alley')
    expect(v.primaryTypeLabel).toBe('Bowling alley')
    expect([v.rating, v.reviewCount, v.priceLevel, v.googleMapsUrl, v.goodForChildren]).toEqual([null, null, null, null, null])
    expect(v.photos).toEqual([])
    expect(v.phone).toBe('+1 248-555-0100')
    expect(v.website).toBe('https://bowlero.example')
    expect(v.openingHours?.weekdayDescriptions).toEqual(['Mon–Fri: 10:00–21:00', 'Sat, Sun: 09:00–23:00'])
    expect(venueToRow(v).source).toBe('geoapify')
  })

  it('rejects unnamed, unlocated or malformed places and unsafe websites', () => {
    expect(normalizeGeoapifyPlace(feature({ name: '' }).properties)).toBeNull()
    expect(normalizeGeoapifyPlace(feature({ lat: undefined }).properties)).toBeNull()
    expect(normalizeGeoapifyPlace(feature({ place_id: '../../x' }).properties)).toBeNull()
    expect(normalizeGeoapifyPlace(feature({ website: 'javascript:alert(1)' }).properties)!.website).toBeNull()
    expect(openingHoursFromOsm('24/7')?.weekdayDescriptions).toEqual(['24/7'])
    expect(openingHoursFromOsm('')).toBeNull()
  })
})

describe('Geoapify client', () => {
  it('searches named places in a circle biased to the party, without leaking the key in errors', async () => {
    const fetchImpl = vi.fn(async () => json({ features: [feature(), feature()] }))
    const client = createGeoapifyClient({ apiKey: 'k-secret', baseUrl: 'https://geo.test', fetchImpl })
    const found = await client.searchPlaces({ categories: ['entertainment.bowling_alley'], center, radiusMeters: 32187 })
    expect(found).toHaveLength(2)
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0])
    expect(url.pathname).toBe('/v2/places')
    expect(url.searchParams.get('categories')).toBe('entertainment.bowling_alley')
    expect(url.searchParams.get('conditions')).toBe('named')
    expect(url.searchParams.get('filter')).toBe('circle:-83.1799,42.5627,32187')
    expect(url.searchParams.get('bias')).toBe('proximity:-83.1799,42.5627')

    const failing = createGeoapifyClient({ apiKey: 'k-secret', baseUrl: 'https://geo.test', fetchImpl: async () => json({ message: 'Invalid apiKey' }, 401) })
    const err = await failing.searchPlaces({ categories: ['leisure.park'], center, radiusMeters: 1000 }).catch((e) => e)
    expect(err).toBeInstanceOf(PlacesError)
    expect(err.kind).toBe('auth')
    expect(String(err.message)).not.toContain('k-secret')
  })

  it('maps quota, timeouts and missing keys to discovery error kinds', async () => {
    const quota = createGeoapifyClient({ apiKey: 'k', baseUrl: 'https://geo.test', fetchImpl: async () => json({}, 429) })
    await expect(quota.searchPlaces({ categories: ['leisure.park'], center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'quota' })
    const none = createGeoapifyClient({ apiKey: '', baseUrl: 'https://geo.test', fetchImpl: vi.fn() })
    await expect(none.searchPlaces({ categories: ['leisure.park'], center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'not_configured' })
    const slow = createGeoapifyClient({
      apiKey: 'k',
      baseUrl: 'https://geo.test',
      timeoutMs: 20,
      fetchImpl: (_u, init) => new Promise<Response>((_r, reject) => (init as RequestInit).signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
    })
    await expect(slow.searchPlaces({ categories: ['leisure.park'], center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('geocodes a ZIP only to an exact postcode match', async () => {
    const client = createGeoapifyClient({
      apiKey: 'k',
      baseUrl: 'https://geo.test',
      fetchImpl: async () => json({ results: [{ postcode: '48084', lat: 42.567, lon: -83.184, city: 'Troy', state_code: 'MI' }] }),
    })
    expect(await client.geocodeZip('48084')).toEqual({ zip: '48084', lat: 42.567, lng: -83.184, city: 'Troy', state: 'MI', source: 'geocoding' })
    expect(await client.geocodeZip('99999')).toBeNull()
    expect(await client.geocodeZip('abc')).toBeNull()
  })
})

describe('discovery with the Geoapify source', () => {
  const ctx: PartyContext = { childName: 'Ava', childAge: 7, guestCount: 15, budget: 400, interests: ['sports'], setting: 'either', zip: '48084', center, radiusMiles: 20 }
  const config = { searchTtlHours: 24, detailsTtlDays: 7, maxQueries: 4, concurrency: 2, weights: resolveWeights() }

  it('searches supported categories, caches under a provider namespace, and fetches details', async () => {
    const calls: string[] = []
    const shared = feature({ name: 'Shared Lanes' })
    const api = {
      async searchPlaces({ categories }: { categories: string[] }) {
        calls.push(categories.join(','))
        return [shared.properties, feature().properties]
      },
      async placeDetails(id: string) {
        calls.push(`details:${id}`)
        return { ...shared.properties, website: 'https://lanes.example' }
      },
      async geocodeZip() {
        return null
      },
    }
    const store = new MemoryDiscoveryStore()
    const deps = { source: geoapifySource(api), store, config }
    const res = await discoverVenues(ctx, deps)
    expect(calls).toHaveLength(4)
    expect(res.venues.filter((v) => v.name === 'Shared Lanes')).toHaveLength(1)
    expect(res.venues.every((v) => v.placeId.startsWith('geo_') && v.rating === null)).toBe(true)
    expect(searchCacheKey('bowling', ctx, 'geoapify')).not.toBe(searchCacheKey('bowling', ctx, 'google'))

    await discoverVenues(ctx, deps)
    expect(calls).toHaveLength(4) // second run served from cache

    const id = res.venues.find((v) => v.name === 'Shared Lanes')!.placeId
    const { venue } = await getVenueDetails(id, deps, ctx)
    expect(calls.at(-1)).toBe(`details:${id.slice(4)}`)
    expect(venue.website).toBe('https://lanes.example')
  })
})

describe('provider selection', () => {
  it('uses Geoapify when its key is set, unless PLACES_PROVIDER says otherwise', () => {
    expect(placesProvider({ GEOAPIFY_API_KEY: 'x' })).toBe('geoapify')
    expect(placesProvider({})).toBe('google')
    expect(placesProvider({ GEOAPIFY_API_KEY: 'x', PLACES_PROVIDER: 'google' })).toBe('google')
    expect(placesProvider({ PLACES_PROVIDER: 'geoapify' })).toBe('geoapify')
  })
})

describe('GET /api/map/tiles/:z/:x/:y', () => {
  const call = (z: string, x: string, y: string) => tileGET(new Request(`http://app.test/api/map/tiles/${z}/${x}/${y}`), { params: { z, x, y } })

  afterEach(() => {
    delete process.env.GEOAPIFY_API_KEY
    vi.unstubAllGlobals()
    resetRateLimits()
  })

  it('is off without a key and validates tile coordinates', async () => {
    expect((await call('12', '1108', '1513')).status).toBe(404)
    process.env.GEOAPIFY_API_KEY = 'k-secret'
    expect((await call('12', '5000', '1513')).status).toBe(400)
    expect((await call('25', '1', '1')).status).toBe(400)
    expect((await call('1x', '1', '1')).status).toBe(400)
  })

  it('proxies the tile with CDN caching and never returns the key', async () => {
    process.env.GEOAPIFY_API_KEY = 'k-secret'
    const upstream = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', upstream)
    const res = await call('12', '1108', '1513')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('s-maxage')
    expect((upstream.mock.calls[0] as unknown as [string])[0]).toContain('/v1/tile/positron/12/1108/1513@2x.png')
    expect(JSON.stringify(Object.fromEntries(res.headers))).not.toContain('k-secret')

    upstream.mockImplementationOnce(async () => new Response('{"message":"Invalid apiKey"}', { status: 401, headers: { 'content-type': 'application/json' } }))
    const bad = await call('12', '1108', '1514')
    expect(bad.status).toBe(502)
    expect(await bad.text()).not.toContain('k-secret')
  })
})
