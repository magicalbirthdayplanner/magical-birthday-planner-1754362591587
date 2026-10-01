import { INTEREST_IDS, type InterestId, type Setting } from './taxonomy'
import { clampRadius } from './config'
import type { PartyContext } from './types'
import type { LatLng } from '@/lib/geo/distance'

export interface PartyRowLike {
  child_name?: string | null
  child_age?: number | null
  guest_count?: number | null
  budget?: number | string | null
  interests?: string[] | null
  venue_type?: string | null
  zip_code?: string | null
  search_radius_miles?: number | null
}

/** parties.venue_type (legacy: 'mixed' = either) → Setting */
export function settingFromVenueType(v: string | null | undefined): Setting {
  const s = (v ?? '').toLowerCase()
  if (s === 'indoor') return 'indoor'
  if (s === 'outdoor') return 'outdoor'
  return 'either'
}

export function venueTypeFromSetting(s: Setting): string {
  return s === 'either' ? 'mixed' : s
}

export function sanitizeInterests(list: unknown): InterestId[] {
  if (!Array.isArray(list)) return []
  const allowed = new Set<string>(INTEREST_IDS)
  return Array.from(new Set(list.map((x) => String(x).toLowerCase()).filter((x) => allowed.has(x)))) as InterestId[]
}

export function partyContextFromRow(row: PartyRowLike, center: LatLng, zip: string, radiusMiles?: number): PartyContext {
  const budget = row.budget == null ? null : Number(row.budget)
  return {
    childName: row.child_name ?? null,
    childAge: row.child_age ?? null,
    guestCount: row.guest_count ?? null,
    budget: Number.isFinite(budget) ? budget : null,
    interests: sanitizeInterests(row.interests),
    setting: settingFromVenueType(row.venue_type),
    zip,
    center,
    radiusMiles: clampRadius(radiusMiles ?? row.search_radius_miles ?? 20),
  }
}
