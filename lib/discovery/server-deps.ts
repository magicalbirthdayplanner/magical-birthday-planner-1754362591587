import 'server-only'
import { createPlacesClient } from '@/lib/google/places'
import { createZipGeocoder } from '@/lib/google/geocoding'
import { createGeoapifyClient } from '@/lib/geoapify/places'
import { geoapifySource } from '@/lib/geoapify/source'
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

export type PlacesProvider = 'geoapify' | 'google'

/**
 * PLACES_PROVIDER=geoapify|google picks the place source explicitly. Otherwise
 * Geoapify is used when GEOAPIFY_API_KEY is set, Google Places when not.
 */
export function placesProvider(env: Record<string, string | undefined> = process.env): PlacesProvider {
  const explicit = env.PLACES_PROVIDER?.trim().toLowerCase()
  if (explicit === 'geoapify' || explicit === 'google') return explicit
  return env.GEOAPIFY_API_KEY ? 'geoapify' : 'google'
}

/** `subject` (user id or ip) scopes the hourly outbound-call budget. */
export function discoveryDeps(subject?: string): DiscoveryDeps {
  return {
    source: placesProvider() === 'geoapify' ? geoapifySource(createGeoapifyClient()) : googleSource(createPlacesClient()),
    store: store(),
    config: discoveryConfig(),
    onMetric: logMetric,
    budget: subject ? googleBudgetFor(subject) : undefined,
  }
}

const geocodeMisses = new Map<string, number>()

/** Geocoding fallback (Geoapify or Google) for ZIPs missing from the offline dataset: negative-cached and budgeted. */
export const zipGeocoder = (subject = 'anonymous') => {
  const geocode =
    placesProvider() === 'geoapify'
      ? (() => {
          const client = createGeoapifyClient({ timeoutMs: 5000 })
          return (zip: string) => client.geocodeZip(zip).catch(() => null)
        })()
      : createZipGeocoder()
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
