/**
 * Cache-first local discovery.
 *
 *   plan queries (party context) → per query: fresh cache? → use it
 *                                              stale/missing → Google Text Search → store
 *                                              Google failed → stale cache → stored venues (PostGIS)
 *   → merge & dedupe by place id → rank → return
 *
 * Pure orchestration: the place source (Google or Geoapify), storage and clock are injected.
 */
import { createHash } from 'node:crypto'
import { milesToMeters } from '@/lib/geo/distance'
import type { PlacesApi } from '@/lib/google/places'
import { PlacesError, normalizePlace } from '@/lib/google/places'
import type { DiscoveryConfig } from './config'
import { planQueries } from './query-plan'
import { rankVenue, rankVenues } from './ranking'
import { mergeVenue, type DiscoveryStore } from './store'
import { getCategory, type DiscoveryCategory } from './taxonomy'
import type { DiscoveryMeta, DiscoveryResult, PartyContext, RankedVenue, Venue } from './types'
import type { LatLng } from '@/lib/geo/distance'

/** Where places come from. Implementations normalize to `Venue`; absent data stays null. */
export interface VenueSource {
  /** Namespaces search cache keys so providers never share cached results. */
  id: 'google' | 'geoapify'
  /** Categories this source can search honestly; the query plan skips the rest. */
  supports(categoryId: string): boolean
  search(category: DiscoveryCategory, center: LatLng, radiusMeters: number, now: Date): Promise<Venue[]>
  /** Fresh details for a place discovery already surfaced; null when the provider has nothing. */
  details(placeId: string, known: Venue | null, now: Date): Promise<Venue | null>
}

/** Google Places (New): one Text Search per category. */
export function googleSource(places: PlacesApi): VenueSource {
  return {
    id: 'google',
    supports: () => true,
    async search(category, center, radiusMeters, now) {
      const raw = await places.searchText({ textQuery: category.query, center, radiusMeters, pageSize: 20 })
      return raw.map((p) => normalizePlace(p, [category.id], now)).filter((v): v is Venue => !!v)
    },
    async details(placeId, known, now) {
      return normalizePlace(await places.getPlace(placeId), known?.categories ?? [], now)
    },
  }
}

export interface DiscoveryDeps {
  /** Google client (used when no `source` is given). */
  places?: PlacesApi
  source?: VenueSource
  store: DiscoveryStore
  config: DiscoveryConfig
  now?: () => Date
  onMetric?: (name: string, props: Record<string, unknown>) => void
  /** Outbound-call budget; when it refuses, Google is not called. */
  budget?: { allow(n?: number): boolean }
}

export interface DiscoverOptions {
  /** Explicit categories (e.g. vendors chip). Defaults to the context-aware plan. */
  categoryIds?: string[]
  /** Ignore fresh cache (manual refresh). Still limited by rate limits upstream. */
  forceRefresh?: boolean
}

export class DiscoveryUnavailableError extends Error {
  constructor(public kind: string) {
    super(`Discovery unavailable: ${kind}`)
    this.name = 'DiscoveryUnavailableError'
  }
}

/** Cache key: query + location rounded to ~1 km + radius. Version/provider-prefixed for safe invalidation. */
export function searchCacheKey(categoryId: string, ctx: Pick<PartyContext, 'center' | 'radiusMiles'>, sourceId: VenueSource['id'] = 'google'): string {
  const raw = [sourceId === 'google' ? 'v1' : `${sourceId}-v1`, categoryId, ctx.center.lat.toFixed(2), ctx.center.lng.toFixed(2), Math.round(ctx.radiusMiles)].join('|')
  return createHash('sha256').update(raw).digest('hex').slice(0, 40)
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

function sourceOf(deps: DiscoveryDeps): VenueSource {
  if (deps.source) return deps.source
  if (!deps.places) throw new Error('DiscoveryDeps needs `source` or `places`')
  return googleSource(deps.places)
}

export async function discoverVenues(ctx: PartyContext, deps: DiscoveryDeps, opts: DiscoverOptions = {}): Promise<DiscoveryResult> {
  const now = deps.now ?? (() => new Date())
  const started = Date.now()
  const source = sourceOf(deps)
  const categories: DiscoveryCategory[] = opts.categoryIds?.length
    ? opts.categoryIds
        .map(getCategory)
        .filter((x): x is DiscoveryCategory => !!x)
        .filter((c) => source.supports(c.id))
    : planQueries(ctx, deps.config.maxQueries, source.supports).map((q) => q.category)

  const meta: DiscoveryMeta = {
    categories: categories.map((c) => c.id),
    cacheHits: 0,
    cacheMisses: 0,
    staleServed: 0,
    apiCalls: 0,
    apiErrors: [],
    latencyMs: 0,
    degraded: null,
  }
  const radiusMeters = milesToMeters(ctx.radiusMiles)

  const perCategory = await mapLimit(categories, deps.config.concurrency, async (category) => {
    const cacheKey = searchCacheKey(category.id, ctx, source.id)
    const cached = await deps.store.getSearch(cacheKey).catch(() => null)
    if (cached && !opts.forceRefresh && cached.expiresAt > now()) {
      meta.cacheHits++
      deps.onMetric?.('places_cache_hit', { category: category.id, results: cached.venues.length })
      return cached.venues.map((v) => ({ ...v, categories: Array.from(new Set([...v.categories, category.id])) }))
    }
    meta.cacheMisses++
    const t0 = Date.now()
    try {
      if (deps.budget && !deps.budget.allow(1)) throw new PlacesError('quota', 'Local place-search call budget exhausted')
      meta.apiCalls++
      const fetchedAt = now()
      const found = await source.search(category, ctx.center, radiusMeters, fetchedAt)
      // Providers can return the same place twice in one response: dedupe before storing.
      const unique = new Map<string, Venue>()
      for (const v of found) if (!unique.has(v.placeId)) unique.set(v.placeId, v)
      const venues = Array.from(unique.values())
      const latencyMs = Date.now() - t0
      deps.onMetric?.('places_search', { category: category.id, results: venues.length, latencyMs, cache: 'miss', provider: source.id })
      await deps.store
        .saveSearch({
          cacheKey,
          queryId: category.id,
          zip: ctx.zip,
          center: ctx.center,
          radiusMeters,
          radiusMiles: ctx.radiusMiles,
          status: venues.length ? 'ok' : 'zero_results',
          latencyMs,
          fetchedAt,
          expiresAt: new Date(fetchedAt.getTime() + deps.config.searchTtlHours * 3600_000),
          venues,
        })
        .catch((err) => deps.onMetric?.('places_cache_write_error', { category: category.id, error: String(err?.message ?? err) }))
      return venues
    } catch (err) {
      const kind = err instanceof PlacesError ? err.kind : 'unavailable'
      meta.apiErrors.push({ category: category.id, kind })
      deps.onMetric?.('places_error', { category: category.id, kind, latencyMs: Date.now() - t0 })
      if (cached) {
        // Stale-if-error: an old answer beats no answer.
        meta.staleServed++
        return cached.venues
      }
      return [] as Venue[]
    }
  })

  // Merge & dedupe by place id; union categories.
  const byId = new Map<string, Venue>()
  for (const list of perCategory) {
    for (const v of list) byId.set(v.placeId, mergeVenue(byId.get(v.placeId), v))
  }

  const allFailed = meta.apiErrors.length > 0 && meta.apiErrors.length === meta.cacheMisses && meta.cacheHits === 0
  if (meta.staleServed > 0) meta.degraded = 'stale_cache'

  if (byId.size === 0 && allFailed) {
    // Last resort: anything we already know about near this party (PostGIS).
    const stored = await deps.store.venuesNear(ctx.center, radiusMeters, 120).catch(() => [])
    if (stored.length) {
      meta.degraded = 'stored_venues'
      for (const v of stored) byId.set(v.placeId, v)
    } else {
      const kinds = new Set(meta.apiErrors.map((e) => e.kind))
      throw new DiscoveryUnavailableError(
        kinds.has('quota') ? 'quota' : kinds.has('timeout') ? 'timeout' : kinds.has('not_configured') ? 'not_configured' : 'google_unavailable',
      )
    }
  }

  const venues = rankVenues(Array.from(byId.values()), ctx, { weights: deps.config.weights })
  meta.latencyMs = Date.now() - started
  deps.onMetric?.('discovery_completed', {
    results: venues.length,
    cacheHits: meta.cacheHits,
    cacheMisses: meta.cacheMisses,
    apiErrors: meta.apiErrors.length,
    latencyMs: meta.latencyMs,
    degraded: meta.degraded,
  })
  return { venues, total: venues.length, meta }
}

/**
 * Venue details, fetched from the provider only when a parent opens a venue and the
 * stored details are missing or older than the details TTL.
 */
export async function getVenueDetails(
  placeId: string,
  deps: DiscoveryDeps,
  ctx?: PartyContext | null,
): Promise<{ venue: RankedVenue | Venue; fromCache: boolean; stale: boolean }> {
  const now = deps.now ?? (() => new Date())
  const source = sourceOf(deps)
  const stored = await deps.store.getVenue(placeId).catch(() => null)
  const fresh =
    stored?.detailsSyncedAt && now().getTime() - new Date(stored.detailsSyncedAt).getTime() < deps.config.detailsTtlDays * 86_400_000

  let venue: Venue | null = stored
  let fromCache = true
  let stale = false
  if (!fresh) {
    try {
      if (deps.budget && !deps.budget.allow(1)) throw new PlacesError('quota', 'Local place-details call budget exhausted')
      const t0 = Date.now()
      const syncedAt = now()
      const normalized = await source.details(placeId, stored, syncedAt)
      deps.onMetric?.('places_details', { latencyMs: Date.now() - t0, cache: 'miss', provider: source.id })
      if (normalized) {
        venue = mergeVenue(stored, { ...normalized, detailsSyncedAt: syncedAt.toISOString() })
        await deps.store.saveVenueDetails(venue).catch(() => undefined)
        fromCache = false
      }
    } catch (err) {
      deps.onMetric?.('places_error', { kind: err instanceof PlacesError ? err.kind : 'unavailable', op: 'details' })
      if (!stored) throw err
      stale = true
    }
  } else {
    deps.onMetric?.('places_details', { cache: 'hit' })
  }
  if (!venue) throw new PlacesError('not_found', 'Place not found')
  return { venue: ctx ? rankVenue(venue, ctx, { weights: deps.config.weights }) : venue, fromCache, stale }
}
