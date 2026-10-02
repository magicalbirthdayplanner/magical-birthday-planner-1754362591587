import 'server-only'
import { createPlacesClient } from '@/lib/google/places'
import { createZipGeocoder } from '@/lib/google/geocoding'
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
