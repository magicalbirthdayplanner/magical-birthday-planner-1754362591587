import 'server-only'
import { createPlacesClient } from '@/lib/google/places'
import { createZipGeocoder } from '@/lib/google/geocoding'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { logMetric } from '@/lib/analytics/server'
import { discoveryConfig } from './config'
import type { DiscoveryDeps } from './service'
import { MemoryDiscoveryStore, type DiscoveryStore } from './store'
import { SupabaseDiscoveryStore } from './supabase-store'

let memoryFallback: MemoryDiscoveryStore | null = null

function store(): DiscoveryStore {
  if (hasServiceRole()) return new SupabaseDiscoveryStore(getSupabaseAdmin())
  // Without a service role (local preview), cache in memory instead of failing.
  memoryFallback ??= new MemoryDiscoveryStore()
  return memoryFallback
}

export function discoveryDeps(): DiscoveryDeps {
  return { places: createPlacesClient(), store: store(), config: discoveryConfig(), onMetric: logMetric }
}

export const zipGeocoder = () => createZipGeocoder()
