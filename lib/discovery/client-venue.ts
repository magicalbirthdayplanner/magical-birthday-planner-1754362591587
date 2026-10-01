/**
 * Wire format sent to the browser. Photo resource names are turned into
 * same-origin proxy URLs — the Google API key never reaches the client.
 */
import type { PhotoAttribution, RankedVenue, Reason, Venue } from './types'
import type { Setting } from './taxonomy'

export interface ClientPhoto {
  url: string
  width: number | null
  height: number | null
  attributions: PhotoAttribution[]
}

export interface ClientVenue {
  placeId: string
  name: string
  address: string | null
  shortAddress: string | null
  city: string | null
  state: string | null
  lat: number
  lng: number
  rating: number | null
  reviewCount: number | null
  priceLevel: number | null
  categories: string[]
  primaryTypeLabel: string | null
  photo: ClientPhoto | null
  photos: ClientPhoto[]
  businessStatus: string | null
  googleMapsUrl: string | null
  phone: string | null
  website: string | null
  openingHours: { weekdayDescriptions: string[]; openNow?: boolean | null } | null
  editorialSummary: string | null
  goodForChildren: boolean | null
  goodForGroups: boolean | null
  distanceMiles: number | null
  setting: Setting | null
  score: number | null
  reasons: Reason[]
  tags: string[]
}

export function photoProxyUrl(name: string, width = 640): string {
  return `/api/discovery/photo?name=${encodeURIComponent(name)}&w=${width}`
}

export function toClientVenue(v: Venue | RankedVenue, opts: { allPhotos?: boolean; photoWidth?: number } = {}): ClientVenue {
  const ranked = 'score' in v ? (v as RankedVenue) : null
  const photos = (opts.allPhotos ? v.photos : v.photos.slice(0, 1)).map((p) => ({
    url: photoProxyUrl(p.name, opts.photoWidth ?? 640),
    width: p.widthPx ?? null,
    height: p.heightPx ?? null,
    attributions: p.attributions,
  }))
  return {
    placeId: v.placeId,
    name: v.name,
    address: v.address,
    shortAddress: v.shortAddress,
    city: v.city,
    state: v.state,
    lat: v.lat,
    lng: v.lng,
    rating: v.rating,
    reviewCount: v.reviewCount,
    priceLevel: v.priceLevel,
    categories: v.categories,
    primaryTypeLabel: v.primaryTypeLabel,
    photo: photos[0] ?? null,
    photos,
    businessStatus: v.businessStatus,
    googleMapsUrl: v.googleMapsUrl,
    phone: v.phone,
    website: v.website,
    openingHours: v.openingHours,
    editorialSummary: v.editorialSummary,
    goodForChildren: v.goodForChildren,
    goodForGroups: v.goodForGroups,
    distanceMiles: ranked ? Math.round(ranked.distanceMiles * 10) / 10 : null,
    setting: ranked?.setting ?? null,
    score: ranked?.score ?? null,
    reasons: ranked?.reasons ?? [],
    tags: ranked?.tags ?? [],
  }
}
