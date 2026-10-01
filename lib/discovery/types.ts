import type { LatLng } from '@/lib/geo/distance'
import type { InterestId, Setting } from './taxonomy'

/** Party facts that drive discovery. Built from a `parties` row. */
export interface PartyContext {
  childName?: string | null
  childAge?: number | null
  guestCount?: number | null
  budget?: number | null
  interests: InterestId[]
  /** Parent's vibe. "either" when unknown. */
  setting: Setting
  zip: string
  center: LatLng
  radiusMiles: number
}

export interface PhotoAttribution {
  displayName: string
  uri?: string | null
}

export interface PhotoRef {
  /** Places API (New) photo resource name: places/{placeId}/photos/{ref} */
  name: string
  widthPx?: number | null
  heightPx?: number | null
  attributions: PhotoAttribution[]
}

export interface OpeningHours {
  weekdayDescriptions: string[]
  openNow?: boolean | null
}

/** A place as stored/returned by discovery. Absent data stays null — never invented. */
export interface Venue {
  placeId: string
  name: string
  address: string | null
  shortAddress: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  lat: number
  lng: number
  rating: number | null
  reviewCount: number | null
  /** 0 (free) … 4 (very expensive) */
  priceLevel: number | null
  types: string[]
  primaryType: string | null
  primaryTypeLabel: string | null
  /** Taxonomy category ids */
  categories: string[]
  photos: PhotoRef[]
  businessStatus: string | null
  googleMapsUrl: string | null
  // Detail-only fields (null until details are fetched)
  phone: string | null
  website: string | null
  openingHours: OpeningHours | null
  editorialSummary: string | null
  goodForChildren: boolean | null
  goodForGroups: boolean | null
  maxCapacity: number | null
  lastSyncedAt: string | null
  detailsSyncedAt: string | null
}

export type ReasonKind = 'interest' | 'rating' | 'distance' | 'kids' | 'setting' | 'budget' | 'groups' | 'age' | 'party'

export interface Reason {
  kind: ReasonKind
  text: string
}

export interface RankedVenue extends Venue {
  distanceMiles: number
  setting: Setting
  score: number
  /** Per-factor 0..1 scores, for debugging and tests. */
  factors: Record<string, number>
  reasons: Reason[]
  tags: string[]
}

export type DiscoveryErrorKind =
  | 'invalid_zip'
  | 'google_unavailable'
  | 'quota'
  | 'timeout'
  | 'not_configured'
  | 'network'

export interface DiscoveryMeta {
  categories: string[]
  cacheHits: number
  cacheMisses: number
  staleServed: number
  apiCalls: number
  apiErrors: { category: string; kind: string }[]
  latencyMs: number
  /** Set when Google failed and results came from the stored venue database. */
  degraded: null | 'stale_cache' | 'stored_venues'
}

export interface DiscoveryResult {
  venues: RankedVenue[]
  total: number
  meta: DiscoveryMeta
}
