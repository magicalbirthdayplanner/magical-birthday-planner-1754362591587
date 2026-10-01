import type { LatLng } from '@/lib/geo/distance'
import { haversineMiles } from '@/lib/geo/distance'
import type { Venue } from './types'

export interface CachedSearch {
  cacheKey: string
  fetchedAt: Date
  expiresAt: Date
  status: 'ok' | 'zero_results'
  venues: Venue[]
}

export interface SaveSearchInput {
  cacheKey: string
  queryId: string
  zip: string | null
  center: LatLng
  radiusMeters: number
  radiusMiles: number
  status: 'ok' | 'zero_results'
  latencyMs: number
  fetchedAt: Date
  expiresAt: Date
  venues: Venue[]
}

/** Persistence used by discovery. Supabase in production, memory in tests. */
export interface DiscoveryStore {
  getSearch(cacheKey: string): Promise<CachedSearch | null>
  saveSearch(input: SaveSearchInput): Promise<void>
  getVenue(placeId: string): Promise<(Venue & { id?: string }) | null>
  /** Upsert full details for one place. */
  saveVenueDetails(venue: Venue): Promise<void>
  venuesNear(center: LatLng, radiusMeters: number, limit: number): Promise<Venue[]>
  hasPlace(placeId: string): Promise<boolean>
}

/** Merge a fresh search hit into an existing record without losing detail fields. */
export function mergeVenue(existing: Venue | null | undefined, incoming: Venue): Venue {
  if (!existing) return incoming
  return {
    ...existing,
    ...incoming,
    categories: Array.from(new Set([...(existing.categories ?? []), ...incoming.categories])),
    phone: incoming.phone ?? existing.phone,
    website: incoming.website ?? existing.website,
    openingHours: incoming.openingHours ?? existing.openingHours,
    editorialSummary: incoming.editorialSummary ?? existing.editorialSummary,
    goodForChildren: incoming.goodForChildren ?? existing.goodForChildren,
    goodForGroups: incoming.goodForGroups ?? existing.goodForGroups,
    maxCapacity: incoming.maxCapacity ?? existing.maxCapacity,
    detailsSyncedAt: incoming.detailsSyncedAt ?? existing.detailsSyncedAt,
    photos: incoming.photos.length ? incoming.photos : existing.photos,
  }
}

export class MemoryDiscoveryStore implements DiscoveryStore {
  searches = new Map<string, { meta: Omit<CachedSearch, 'venues'>; placeIds: string[] }>()
  venues = new Map<string, Venue>()

  async getSearch(cacheKey: string): Promise<CachedSearch | null> {
    const s = this.searches.get(cacheKey)
    if (!s) return null
    return { ...s.meta, venues: s.placeIds.map((id) => this.venues.get(id)!).filter(Boolean) }
  }

  async saveSearch(input: SaveSearchInput) {
    for (const v of input.venues) this.venues.set(v.placeId, mergeVenue(this.venues.get(v.placeId), v))
    this.searches.set(input.cacheKey, {
      meta: { cacheKey: input.cacheKey, fetchedAt: input.fetchedAt, expiresAt: input.expiresAt, status: input.status },
      placeIds: input.venues.map((v) => v.placeId),
    })
  }

  async getVenue(placeId: string) {
    return this.venues.get(placeId) ?? null
  }

  async saveVenueDetails(venue: Venue) {
    this.venues.set(venue.placeId, mergeVenue(this.venues.get(venue.placeId), venue))
  }

  async venuesNear(center: LatLng, radiusMeters: number, limit: number) {
    return Array.from(this.venues.values())
      .map((v) => ({ v, d: haversineMiles(center, v) * 1609.344 }))
      .filter((x) => x.d <= radiusMeters)
      .sort((a, b) => a.d - b.d)
      .slice(0, limit)
      .map((x) => x.v)
  }

  async hasPlace(placeId: string) {
    return this.venues.has(placeId)
  }
}
