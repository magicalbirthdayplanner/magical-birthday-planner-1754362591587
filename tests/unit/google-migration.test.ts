import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DiscoveryConfig } from '@/lib/discovery/config'
import { resolveWeights } from '@/lib/discovery/ranking'
import { discoverVenues, getVenueDetails } from '@/lib/discovery/service'
import { MemoryDiscoveryStore } from '@/lib/discovery/store'
import type { PartyContext, Venue } from '@/lib/discovery/types'
import { venueToRow } from '@/lib/discovery/venue-row'
import { isLegacyGeoapifyPlaceId } from '@/lib/discovery/legacy'
import { PlacesError, type PlacesApi, type RawPlace } from '@/lib/google/places'
import { rawPlace } from '../fixtures/places'

const ctx: PartyContext = { childName: 'Ava', childAge: 7, guestCount: 20, budget: 500, interests: ['art'], setting: 'either', zip: '48084', center: { lat: 42.5627, lng: -83.1799 }, radiusMiles: 20 }
const config: DiscoveryConfig = { searchTtlHours: 24, detailsTtlDays: 7, maxQueries: 4, concurrency: 4, weights: resolveWeights() }

function slowPlaces(results: () => RawPlace[], delayMs = 30): PlacesApi & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async searchText({ textQuery }) {
      calls.push(textQuery)
      await new Promise((r) => setTimeout(r, delayMs))
      return results()
    },
    async getPlace() {
      throw new PlacesError('invalid_request', 'Places API 400')
    },
    async getPhotoUri() {
      return 'https://lh3.googleusercontent.com/x'
    },
  }
}

describe('duplicate request suppression', () => {
  it('identical discoveries in flight share one Google call per category', async () => {
    const places = slowPlaces(() => [rawPlace({ name: 'Paint Spot' })])
    const store = new MemoryDiscoveryStore()
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => discoverVenues(ctx, { places, store, config })))
    expect(places.calls).toHaveLength(4) // 4 categories, not 12
    expect(a.venues.length).toBeGreaterThan(0)
    expect(b.venues.map((v) => v.placeId)).toEqual(a.venues.map((v) => v.placeId))
    expect(c.total).toBe(a.total)
  })

  it('a failed shared call is not cached as in-flight forever', async () => {
    let fail = true
    const places = slowPlaces(() => {
      if (fail) throw new PlacesError('unavailable', 'Places API 503')
      return [rawPlace()]
    }, 5)
    const store = new MemoryDiscoveryStore()
    await expect(discoverVenues(ctx, { places, store, config })).rejects.toThrow()
    fail = false
    const ok = await discoverVenues(ctx, { places, store, config })
    expect(ok.total).toBeGreaterThan(0)
  })
})

describe('venues saved while Geoapify was the provider', () => {
  const legacy: Venue = {
    placeId: 'geo_51abcdef0000000000f00103f9013332da3e',
    name: 'Cranbrook Institute of Science',
    address: '39221 Woodward Ave, Bloomfield Hills, MI 48304',
    shortAddress: null,
    city: 'Bloomfield Hills',
    state: 'MI',
    postalCode: '48304',
    lat: 42.5776,
    lng: -83.2468,
    rating: null,
    reviewCount: null,
    priceLevel: null,
    types: ['entertainment.museum'],
    primaryType: 'entertainment.museum',
    primaryTypeLabel: 'Museum',
    categories: ['childrens-museum'],
    photos: [],
    businessStatus: null,
    googleMapsUrl: null,
    phone: null,
    website: null,
    openingHours: null,
    editorialSummary: null,
    goodForChildren: null,
    goodForGroups: null,
    maxCapacity: null,
    lastSyncedAt: '2026-10-02T00:00:00Z',
    detailsSyncedAt: null,
  }

  it('keep their provenance and stay readable when Google rejects the id', async () => {
    expect(isLegacyGeoapifyPlaceId(legacy.placeId)).toBe(true)
    expect(isLegacyGeoapifyPlaceId('ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe(false)
    expect(venueToRow(legacy).source).toBe('geoapify')
    const store = new MemoryDiscoveryStore()
    await store.saveVenueDetails(legacy)
    const res = await getVenueDetails(legacy.placeId, { places: slowPlaces(() => []), store, config }, ctx)
    expect(res.stale).toBe(true)
    expect(res.venue.name).toBe('Cranbrook Institute of Science')
  })
})

describe('browser key isolation', () => {
  const clientFiles: string[] = []
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|jsx?)$/.test(f)) clientFiles.push(p)
    }
  }
  walk(path.resolve(__dirname, '../../components'))
  walk(path.resolve(__dirname, '../../contexts'))

  it('no client component reads the server Places key', () => {
    const offenders = clientFiles.filter((f) => readFileSync(f, 'utf8').includes('GOOGLE_PLACES_API_KEY'))
    expect(offenders).toEqual([])
  })

  it('the map uses only the public, referrer-restricted Maps JavaScript key', () => {
    const map = readFileSync(path.resolve(__dirname, '../../components/discover/GoogleMapView.tsx'), 'utf8')
    const view = readFileSync(path.resolve(__dirname, '../../components/discover/MapView.tsx'), 'utf8')
    expect(map).toContain('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
    expect(map + view).not.toMatch(/GOOGLE_PLACES_API_KEY|GEOAPIFY/)
  })

  it('server Places code is server-only', () => {
    expect(readFileSync(path.resolve(__dirname, '../../lib/google/places.ts'), 'utf8')).toMatch(/^import 'server-only'/m)
  })
})
