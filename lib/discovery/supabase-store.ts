/**
 * DiscoveryStore backed by Supabase (venues, venue_searches, venue_search_results).
 * SERVER ONLY — uses the service-role client because the venue catalogue and the
 * search cache are shared, non-user data that clients must not be able to write.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/db/database.types'
import type { LatLng } from '@/lib/geo/distance'
import { primaryCategory } from './taxonomy'
import { mergeVenue, type CachedSearch, type DiscoveryStore, type SaveSearchInput } from './store'
import type { OpeningHours, PhotoRef, Venue } from './types'

type VenueRow = Database['public']['Tables']['venues']['Row']
type VenueInsert = Database['public']['Tables']['venues']['Insert']

const VENUE_COLUMNS =
  'id, place_id, name, address, formatted_address, short_address, city, state, zip_code, latitude, longitude, rating, reviews_count, price_level, types, primary_type, primary_type_label, categories, photo_refs, business_status, google_maps_url, phone, website, opening_hours, editorial_summary, good_for_children, good_for_groups, max_capacity, last_synced_at, details_synced_at, is_active'

export function rowToVenue(r: Partial<VenueRow>): Venue & { id?: string } {
  const hours = r.opening_hours as unknown as OpeningHours | null
  return {
    id: r.id,
    placeId: r.place_id!,
    name: r.name!,
    address: r.formatted_address ?? r.address ?? null,
    shortAddress: r.short_address ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    postalCode: r.zip_code ?? null,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    rating: r.rating == null ? null : Number(r.rating),
    reviewCount: r.reviews_count ?? null,
    priceLevel: r.price_level ?? null,
    types: r.types ?? [],
    primaryType: r.primary_type ?? null,
    primaryTypeLabel: r.primary_type_label ?? null,
    categories: r.categories ?? [],
    photos: Array.isArray(r.photo_refs) ? (r.photo_refs as unknown as PhotoRef[]) : [],
    businessStatus: r.business_status ?? null,
    googleMapsUrl: r.google_maps_url ?? null,
    phone: r.phone ?? null,
    website: r.website ?? null,
    openingHours: hours && Array.isArray(hours.weekdayDescriptions) ? hours : null,
    editorialSummary: r.editorial_summary ?? null,
    goodForChildren: r.good_for_children ?? null,
    goodForGroups: r.good_for_groups ?? null,
    maxCapacity: r.max_capacity ?? null,
    lastSyncedAt: r.last_synced_at ?? null,
    detailsSyncedAt: r.details_synced_at ?? null,
  }
}

export function venueToRow(v: Venue): VenueInsert {
  return {
    place_id: v.placeId,
    name: v.name.slice(0, 300),
    address: v.address,
    formatted_address: v.address,
    short_address: v.shortAddress,
    city: v.city,
    state: v.state,
    zip_code: v.postalCode,
    latitude: v.lat,
    longitude: v.lng,
    rating: v.rating,
    reviews_count: v.reviewCount,
    price_level: v.priceLevel,
    types: v.types,
    primary_type: v.primaryType,
    primary_type_label: v.primaryTypeLabel,
    categories: v.categories,
    category: primaryCategory(v.categories)?.id ?? 'general',
    photo_refs: v.photos as unknown as NonNullable<Json>,
    business_status: v.businessStatus,
    google_maps_url: v.googleMapsUrl,
    phone: v.phone,
    website: v.website,
    opening_hours: v.openingHours as unknown as Json,
    editorial_summary: v.editorialSummary,
    good_for_children: v.goodForChildren,
    good_for_groups: v.goodForGroups,
    max_capacity: v.maxCapacity,
    last_synced_at: v.lastSyncedAt,
    details_synced_at: v.detailsSyncedAt,
    source: 'google_places',
    is_active: v.businessStatus !== 'CLOSED_PERMANENTLY',
  }
}

export class SupabaseDiscoveryStore implements DiscoveryStore {
  constructor(private db: SupabaseClient<Database>) {}

  private async upsertVenues(venues: Venue[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>()
    if (!venues.length) return ids
    // A batch upsert must not touch the same row twice.
    venues = Array.from(new Map(venues.map((v) => [v.placeId, v])).values())
    const placeIds = venues.map((v) => v.placeId)
    const { data: existing } = await this.db.from('venues').select(VENUE_COLUMNS).in('place_id', placeIds)
    const prior = new Map((existing ?? []).map((r) => [r.place_id, rowToVenue(r)]))
    const rows = venues.map((v) => venueToRow(mergeVenue(prior.get(v.placeId), v)))
    const { data, error } = await this.db.from('venues').upsert(rows, { onConflict: 'place_id' }).select('id, place_id')
    if (error) throw error
    for (const r of data ?? []) ids.set(r.place_id, r.id)
    return ids
  }

  async getSearch(cacheKey: string): Promise<CachedSearch | null> {
    const { data: search } = await this.db
      .from('venue_searches')
      .select('id, fetched_at, expires_at, status')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (!search) return null
    const { data: results } = await this.db
      .from('venue_search_results')
      .select(`search_rank, venues (${VENUE_COLUMNS})`)
      .eq('search_id', search.id)
      .order('search_rank', { ascending: true })
    const venues = (results ?? [])
      .map((r) => (r as unknown as { venues: VenueRow | null }).venues)
      .filter((v): v is VenueRow => !!v && v.is_active !== false)
      .map(rowToVenue)
    return {
      cacheKey,
      fetchedAt: new Date(search.fetched_at ?? 0),
      expiresAt: new Date(search.expires_at ?? 0),
      status: search.status === 'zero_results' ? 'zero_results' : 'ok',
      venues,
    }
  }

  async saveSearch(input: SaveSearchInput): Promise<void> {
    const ids = await this.upsertVenues(input.venues)
    const { data: search, error } = await this.db
      .from('venue_searches')
      .upsert(
        {
          cache_key: input.cacheKey,
          query_id: input.queryId,
          category: input.queryId,
          zip_code: input.zip,
          latitude: input.center.lat,
          longitude: input.center.lng,
          radius_miles: Math.round(input.radiusMiles),
          radius_meters: input.radiusMeters,
          status: input.status,
          api_latency_ms: input.latencyMs,
          total_results: input.venues.length,
          fetched_at: input.fetchedAt.toISOString(),
          search_completed_at: input.fetchedAt.toISOString(),
          expires_at: input.expiresAt.toISOString(),
        },
        { onConflict: 'cache_key' },
      )
      .select('id')
      .single()
    if (error) throw error
    await this.db.from('venue_search_results').delete().eq('search_id', search.id)
    const rows = input.venues
      .map((v, i) => ({ search_id: search.id, venue_id: ids.get(v.placeId), search_rank: i }))
      .filter((r): r is { search_id: string; venue_id: string; search_rank: number } => !!r.venue_id)
    if (rows.length) {
      const { error: e2 } = await this.db.from('venue_search_results').insert(rows)
      if (e2) throw e2
    }
  }

  async getVenue(placeId: string) {
    const { data } = await this.db.from('venues').select(VENUE_COLUMNS).eq('place_id', placeId).maybeSingle()
    return data ? rowToVenue(data) : null
  }

  async saveVenueDetails(venue: Venue) {
    await this.upsertVenues([venue])
  }

  async venuesNear(center: LatLng, radiusMeters: number, limit: number): Promise<Venue[]> {
    const { data: near, error } = await this.db.rpc('venues_near', {
      p_lat: center.lat,
      p_lng: center.lng,
      p_radius_m: Math.round(radiusMeters),
      p_limit: limit,
    })
    if (error || !near?.length) return []
    const { data } = await this.db
      .from('venues')
      .select(VENUE_COLUMNS)
      .in(
        'id',
        near.map((n) => n.venue_id),
      )
    return (data ?? []).map(rowToVenue)
  }

  async hasPlace(placeId: string) {
    const { count } = await this.db.from('venues').select('id', { count: 'exact', head: true }).eq('place_id', placeId)
    return (count ?? 0) > 0
  }
}
