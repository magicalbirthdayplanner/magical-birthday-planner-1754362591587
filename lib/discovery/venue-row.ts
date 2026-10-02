import type { Database, Json } from '@/lib/db/database.types'
import { primaryCategory } from './taxonomy'
import { isGeoapifyPlaceId } from '@/lib/geoapify/categories'
import type { OpeningHours, PhotoRef, Venue } from './types'

/** venues row ⇄ domain Venue. Shared by the server store and the browser data layer. */
type VenueRow = Database['public']['Tables']['venues']['Row']
type VenueInsert = Database['public']['Tables']['venues']['Insert']

export const VENUE_COLUMNS =
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
    source: isGeoapifyPlaceId(v.placeId) ? 'geoapify' : 'google_places',
    is_active: v.businessStatus !== 'CLOSED_PERMANENTLY',
  }
}

