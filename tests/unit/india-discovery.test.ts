/**
 * India venue discovery: PIN → location (Google first, offline dataset fallback, partial answers), local search
 * phrasing, Places regionCode, cache keys, budget fit in rupees, and the PIN geocoder's response handling.
 */
import { describe, expect, it } from 'vitest'
import { lookupPin, resolvePin } from '@/lib/geo/pin'
import { createPinGeocoder, createPlacesPinGeocoder } from '@/lib/google/geocoding'
import { createPlacesClient, type PlacesApi } from '@/lib/google/places'
import { discoverVenues, searchCacheKey } from '@/lib/discovery/service'
import { MemoryDiscoveryStore } from '@/lib/discovery/store'
import { resolveWeights, expectedPriceLevel } from '@/lib/discovery/ranking'
import { getCategory, queryFor } from '@/lib/discovery/taxonomy'
import type { PartyContext } from '@/lib/discovery/types'
import { rawPlace } from '../fixtures/places'

describe('offline PIN dataset (GeoNames, CC BY 4.0)', () => {
  it('knows PINs in Mumbai, Bengaluru, Delhi and Hyderabad, with district, state and several localities', async () => {
    expect(await lookupPin('400050')).toMatchObject({ district: 'Mumbai', state: 'Maharashtra', approximate: true, source: 'dataset' })
    expect(await lookupPin('560001')).toMatchObject({ district: 'Bengaluru', state: 'Karnataka' })
    expect(await lookupPin('110016')).toMatchObject({ state: 'Delhi' })
    expect(await lookupPin('500081')).toMatchObject({ state: 'Telangana' })
    // One PIN covers several localities: all are kept, none is assumed.
    expect((await lookupPin('560001'))!.localities.length).toBeGreaterThan(1)
  })
  it('unknown PIN → null', async () => {
    expect(await lookupPin('999999')).toBeNull()
  })
})

describe('resolvePin', () => {
  const geo = { lat: 12.9762, lng: 77.6033, city: 'Bengaluru', locality: 'Shivaji Nagar', district: null, state: 'Karnataka' }
  it('prefers Google’s coordinates and merges dataset details', async () => {
    const r = await resolvePin('560 001', async () => geo)
    expect(r).toMatchObject({ pin: '560001', lat: 12.9762, lng: 77.6033, city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', source: 'geocoding', approximate: false })
    expect(r!.localities[0]).toBe('Shivaji Nagar')
  })
  it('a partial geocode (no city, no state) still resolves — missing fields never reject a PIN', async () => {
    const r = await resolvePin('400050', async () => ({ lat: 19.06, lng: 72.83, city: null, locality: null, district: null, state: null }))
    expect(r).toMatchObject({ lat: 19.06, city: 'Mumbai', state: 'Maharashtra', source: 'geocoding' })
  })
  it('falls back to the dataset (marked approximate) when Google has nothing, fails or is not configured', async () => {
    expect(await resolvePin('560001', async () => null)).toMatchObject({ source: 'dataset', approximate: true })
    expect(await resolvePin('560001', async () => { throw new Error('down') })).toMatchObject({ source: 'dataset' })
    expect(await resolvePin('560001')).toMatchObject({ source: 'dataset' })
  })
  it('malformed or unknown PINs → null; a US ZIP is not a PIN', async () => {
    expect(await resolvePin('48084', async () => geo)).toBeNull()
    expect(await resolvePin('056001', async () => geo)).toBeNull()
    expect(await resolvePin('999999', async () => null)).toBeNull()
  })
})

describe('Google PIN geocoder', () => {
  const ok = (components: { long_name: string; short_name: string; types: string[] }[]) =>
    (async () => new Response(JSON.stringify({ status: 'OK', results: [{ geometry: { location: { lat: 17.44, lng: 78.39 } }, address_components: components }] }))) as unknown as typeof fetch
  it('asks for postal_code + country:IN and reads city / locality / state', async () => {
    let url = ''
    const geocode = createPinGeocoder({ apiKey: 'k', fetchImpl: (async (u: string) => {
      url = u
      return (ok([{ long_name: 'Madhapur', short_name: 'Madhapur', types: ['sublocality_level_1'] }, { long_name: 'Hyderabad', short_name: 'Hyderabad', types: ['locality'] }, { long_name: 'Telangana', short_name: 'TG', types: ['administrative_area_level_1'] }, { long_name: 'India', short_name: 'IN', types: ['country'] }]) as unknown as (u: string) => Promise<Response>)(u)
    }) as unknown as typeof fetch })
    const r = await geocode('500081')
    expect(decodeURIComponent(url)).toContain('components=postal_code:500081|country:IN')
    expect(r).toMatchObject({ lat: 17.44, city: 'Hyderabad', locality: 'Madhapur', state: 'Telangana' })
  })
  it('rejects answers outside India and fails soft on errors', async () => {
    expect(await createPinGeocoder({ apiKey: 'k', fetchImpl: ok([{ long_name: 'United States', short_name: 'US', types: ['country'] }]) })('500081')).toBeNull()
    expect(await createPinGeocoder({ apiKey: 'k', fetchImpl: (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch })('500081')).toBeNull()
    expect(await createPinGeocoder({ apiKey: '', fetchImpl: ok([]) })('500081')).toBeNull()
    expect(await createPinGeocoder({ apiKey: 'k', fetchImpl: ok([]) })('48084')).toBeNull()
  })
})

describe('Places as a PIN locator (Geocoding API not enabled on the key)', () => {
  const answer = (place: unknown) => (async () => new Response(JSON.stringify({ places: place ? [place] : [] }))) as unknown as typeof fetch
  const postal = (pin: string, country = 'IN', types = ['postal_code']) => ({ types, location: { latitude: 12.9261, longitude: 77.6221 }, addressComponents: [{ longText: pin, shortText: pin, types: ['postal_code'] }, { longText: 'Bengaluru', shortText: 'Bengaluru', types: ['locality'] }, { longText: 'Karnataka', shortText: 'KA', types: ['administrative_area_level_1'] }, { longText: 'India', shortText: country, types: ['country'] }] })
  it('accepts only the exact postal code in India', async () => {
    let body: Record<string, unknown> = {}
    const spy = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body))
      return new Response(JSON.stringify({ places: [postal('560034')] }))
    }) as unknown as typeof fetch
    expect(await createPlacesPinGeocoder({ apiKey: 'k', fetchImpl: spy })('560034')).toMatchObject({ lat: 12.9261, lng: 77.6221, city: 'Bengaluru', state: 'Karnataka' })
    expect(body).toMatchObject({ textQuery: '560034, India', regionCode: 'IN', pageSize: 1 })
    expect(await createPlacesPinGeocoder({ apiKey: 'k', fetchImpl: answer(postal('560035')) })('560034')).toBeNull()
    expect(await createPlacesPinGeocoder({ apiKey: 'k', fetchImpl: answer(postal('560034', 'US')) })('560034')).toBeNull()
    expect(await createPlacesPinGeocoder({ apiKey: 'k', fetchImpl: answer(postal('560034', 'IN', ['restaurant'])) })('560034')).toBeNull()
    expect(await createPlacesPinGeocoder({ apiKey: 'k', fetchImpl: answer(null) })('560034')).toBeNull()
  })
  it('reports a denied Geocoding API so the server can skip it', async () => {
    let denied = 0
    const geocode = createPinGeocoder({ apiKey: 'k', onDenied: () => denied++, fetchImpl: (async () => new Response(JSON.stringify({ status: 'REQUEST_DENIED', results: [] }))) as unknown as typeof fetch })
    expect(await geocode('560034')).toBeNull()
    expect(denied).toBe(1)
  })
})

describe('local phrasing, region and cache keys', () => {
  it('searches the same categories with Indian phrasing for India parties only', () => {
    const play = getCategory('indoor-playground')!
    expect(queryFor(play, 'IN')).toBe('kids indoor play area')
    expect(queryFor(play, 'US')).toBe(play.query)
    expect(queryFor(play, null)).toBe(play.query)
    expect(queryFor(getCategory('bowling')!, 'IN')).toBe('bowling alley') // no override → universal query
  })
  it('sends regionCode IN to Places for India parties and US otherwise', async () => {
    const bodies: Record<string, unknown>[] = []
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ places: [] }))
    }) as unknown as typeof fetch
    const places = createPlacesClient({ apiKey: 'k', fetchImpl })
    await places.searchText({ textQuery: 'party hall', center: { lat: 12.97, lng: 77.6 }, radiusMeters: 5000, regionCode: 'IN' })
    await places.searchText({ textQuery: 'party hall', center: { lat: 42.5, lng: -83.1 }, radiusMeters: 5000 })
    await places.searchText({ textQuery: 'x', center: { lat: 1, lng: 1 }, radiusMeters: 5000, regionCode: 'bad; drop' })
    expect(bodies.map((b) => b.regionCode)).toEqual(['IN', 'US', 'US'])
  })
  it('US cache keys are unchanged; India keys are separate', () => {
    const us = { center: { lat: 42.5627, lng: -83.1799 }, radiusMiles: 20 }
    expect(searchCacheKey('art-studio', us)).toBe(searchCacheKey('art-studio', { ...us, country: 'US' }))
    expect(searchCacheKey('art-studio', us)).not.toBe(searchCacheKey('art-studio', { ...us, country: 'IN' }))
  })
  it('a discovery run for an India party passes the country to the source', async () => {
    const seen: { query: string; region?: string }[] = []
    const places: PlacesApi = {
      async searchText(p) {
        seen.push({ query: p.textQuery, region: p.regionCode })
        return [rawPlace({ id: `ChIJ${seen.length}aaaaaaaaaaaa`, name: `Place ${seen.length}`, lat: 12.97, lng: 77.6 })]
      },
      async getPlace() { throw new Error('unused') },
      async getPhotoUri() { return '' },
    }
    const ctx: PartyContext = { childAge: 6, guestCount: 20, budget: 15000, interests: [], setting: 'indoor', zip: '560001', center: { lat: 12.97, lng: 77.6 }, radiusMiles: 10, country: 'IN' }
    const res = await discoverVenues(ctx, { places, store: new MemoryDiscoveryStore(), config: { searchTtlHours: 24, detailsTtlDays: 7, maxQueries: 3, concurrency: 2, weights: resolveWeights() } })
    expect(res.total).toBeGreaterThan(0)
    expect(seen.every((s) => s.region === 'IN')).toBe(true)
    expect(seen.map((s) => s.query)).toContain('kids indoor play area')
  })
})

describe('budget fit uses the party currency', () => {
  it('₹15,000 for 20 guests is a moderate budget in India, not a luxury one', () => {
    expect(expectedPriceLevel(15000, 20, 'IN')).toBe(2) // ₹750/guest
    expect(expectedPriceLevel(15000, 20, 'US')).toBe(4) // what the USD thresholds would have said
    expect(expectedPriceLevel(500, 20, 'US')).toBe(2) // unchanged US behaviour ($25/guest)
    expect(expectedPriceLevel(500, 20)).toBe(2)
  })
})
