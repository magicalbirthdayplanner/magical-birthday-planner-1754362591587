import 'server-only'
import { createPlacesClient } from '@/lib/google/places'
import { createPinGeocoder, createPlacesPinGeocoder, createZipGeocoder } from '@/lib/google/geocoding'
import { resolveZip } from '@/lib/geo/zip'
import { resolvePin } from '@/lib/geo/pin'
import type { CountryCode } from '@/lib/country/countries'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { logMetric } from '@/lib/analytics/server'
import { googleBudgetFor } from '@/lib/server/google-budget'
import { discoveryConfig } from './config'
import { googleSource, type DiscoveryDeps } from './service'
import { MemoryDiscoveryStore, type DiscoveryStore } from './store'
import { SupabaseDiscoveryStore } from './supabase-store'

let memoryFallback: MemoryDiscoveryStore | null = null

function store(): DiscoveryStore {
  if (hasServiceRole()) return new SupabaseDiscoveryStore(getSupabaseAdmin())
  // Without a service role (local preview), cache in memory instead of failing.
  memoryFallback ??= new MemoryDiscoveryStore()
  return memoryFallback
}

/** `subject` (user id or ip) scopes the hourly outbound-call budget. */
export function discoveryDeps(subject?: string): DiscoveryDeps {
  return {
    source: googleSource(createPlacesClient()),
    store: store(),
    config: discoveryConfig(),
    onMetric: logMetric,
    budget: subject ? googleBudgetFor(subject) : undefined,
  }
}

const geocodeMisses = new Map<string, number>()

/**
 * Google Geocoding fallback, used only for ZIPs missing from the offline dataset
 * (lib/geo/zip.ts covers US ZIPs): negative-cached and budgeted. Optional — if the
 * Geocoding API isn't enabled the lookup just reports an unknown ZIP.
 */
export const zipGeocoder = (subject = 'anonymous') => {
  const geocode = createZipGeocoder()
  const budget = googleBudgetFor(`geocode:${subject}`)
  return async (zip: string) => {
    const miss = geocodeMisses.get(zip)
    if (miss && miss > Date.now()) return null
    if (!budget.allow(1)) return null
    const hit = await geocode(zip)
    if (!hit) {
      if (geocodeMisses.size > 50_000) geocodeMisses.clear()
      geocodeMisses.set(zip, Date.now() + 24 * 3_600_000)
    }
    return hit
  }
}

const pinMisses = new Map<string, number>()
const pinHits = new Map<string, { at: number; value: NonNullable<Awaited<ReturnType<ReturnType<typeof createPinGeocoder>>>> }>()

/**
 * Accurate coordinates for an Indian PIN: the Geocoding API, else Places Text Search for the postal code (works with
 * the Places-only key production uses today). Budgeted per subject, cached per instance (hits 7 days, misses 24 h).
 * When both refuse, lib/geo/pin.ts falls back to the offline dataset.
 */
/** When the key is not allowed to use the Geocoding API, skip it for a while (one error report, not one per lookup). */
let geocodingDeniedUntil = 0

export const pinGeocoder = (subject = 'anonymous') => {
  const geocode = createPinGeocoder({ onDenied: () => (geocodingDeniedUntil = Date.now() + 6 * 3_600_000) })
  const placesPin = createPlacesPinGeocoder()
  const budget = googleBudgetFor(`geocode:${subject}`)
  return async (pin: string) => {
    const hit = pinHits.get(pin)
    if (hit && hit.at > Date.now() - 7 * 86_400_000) return hit.value
    const miss = pinMisses.get(pin)
    if (miss && miss > Date.now()) return null
    if (!budget.allow(1)) return null
    const viaGeocoding = Date.now() < geocodingDeniedUntil ? null : await geocode(pin)
    const found = viaGeocoding ?? (budget.allow(1) ? await placesPin(pin) : null)
    if (found) {
      if (pinHits.size > 20_000) pinHits.clear()
      pinHits.set(pin, { at: Date.now(), value: found })
    } else {
      if (pinMisses.size > 50_000) pinMisses.clear()
      pinMisses.set(pin, Date.now() + 24 * 3_600_000)
    }
    return found
  }
}

/** A located postal code of either country, in one shape for the wizard, party edits and discovery. */
export interface PostalPlace {
  country: CountryCode
  postalCode: string
  lat: number
  lng: number
  city: string | null
  state: string | null
  district: string | null
  localities: string[]
  approximate: boolean
}

/** US ZIP (offline dataset → Google fallback) or Indian PIN (Google → offline dataset). Null when not found. */
export async function resolvePostal(country: CountryCode, code: unknown, subject = 'anonymous'): Promise<PostalPlace | null> {
  if (country === 'IN') {
    const p = await resolvePin(code, pinGeocoder(subject))
    return p ? { country, postalCode: p.pin, lat: p.lat, lng: p.lng, city: p.city, state: p.state, district: p.district, localities: p.localities, approximate: p.approximate } : null
  }
  const z = await resolveZip(code, zipGeocoder(subject))
  return z ? { country, postalCode: z.zip, lat: z.lat, lng: z.lng, city: z.city, state: z.state, district: null, localities: [], approximate: false } : null
}
