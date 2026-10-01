'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Heart, List, Map as MapIcon, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useParty } from '@/components/app/PartyProvider'
import { Chip, EmptyState, ErrorState, LinkButton, AppButton } from '@/components/app/ui'
import { useDiscovery } from '@/lib/data/hooks'
import { ApiError } from '@/lib/data/api'
import { updateParty } from '@/lib/data/parties'
import { DEFAULT_FILTERS, activeFilterCount, applyFilters, parseFilters, serializeFilters, type ChipFilter, type VenueFilters } from '@/lib/discovery/filters'
import { CHIPS, VENDOR_CATEGORIES } from '@/lib/discovery/taxonomy'
import { expectedPriceLevel } from '@/lib/discovery/ranking'
import { clampRadius } from '@/lib/discovery/config'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import { VenueCard, VenueCardSkeleton } from './VenueCard'
import { FiltersSheet } from './FiltersSheet'
import { MapView } from './MapView'
import { MapSheet, type SheetSnap } from './MapSheet'
import { useSaveVenue } from './useSaveVenue'

const VIEW_KEY = 'mbp.discoverView'
const FILTERS_KEY = 'mbp.discoverFilters'
const PAGE = 12
const VENDOR_IDS = VENDOR_CATEGORIES.map((c) => c.id)

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function DiscoverScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const fresh = params?.get('fresh') === '1'
  const { party, isLoading: partyLoading, replaceParty } = useParty()
  const { savedIds, toggle, count: savedCount } = useSaveVenue()

  const [view, setView] = useState<'list' | 'map'>('list')
  const [chip, setChip] = useState<ChipFilter>('recommended')
  const [filters, setFilters] = useState<VenueFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query)
  const [visible, setVisible] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snap, setSnap] = useState<SheetSnap>('peek')
  const [showAha, setShowAha] = useState(fresh)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerBottom, setHeaderBottom] = useState(0)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setHeaderBottom(el.getBoundingClientRect().bottom + window.scrollY)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view])

  useEffect(() => {
    if (view === 'map') window.scrollTo({ top: 0 })
  }, [view])

  // Persisted UI preferences (view + filters).
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY)
      if (v === 'map' || v === 'list') setView(v)
      setFilters(parseFilters(localStorage.getItem(FILTERS_KEY)))
    } catch {
      /* ignore */
    }
  }, [])

  const radius = clampRadius(party?.search_radius_miles ?? 20)
  const vendors = chip === 'vendors'
  const startedAt = useRef<number>(0)
  const discovery = useDiscovery(party?.id, radius, vendors ? VENDOR_IDS : undefined)

  useEffect(() => {
    if (party?.id && discovery.isLoading) {
      startedAt.current = Date.now()
      track('venue_search_started', { radius, vendors })
    }
  }, [party?.id, radius, vendors, discovery.isLoading])

  useEffect(() => {
    if (discovery.data && startedAt.current) {
      track('venue_search_completed', { results: discovery.data.total, ms: Date.now() - startedAt.current, cacheHits: discovery.data.meta.cacheHits, vendors })
      startedAt.current = 0
    }
  }, [discovery.data, vendors])

  const expected = expectedPriceLevel(party?.budget ? Number(party.budget) : null, party?.guest_count)
  const all = useMemo(() => discovery.data?.venues ?? [], [discovery.data])
  const results = useMemo(() => applyFilters(all, filters, { chip: vendors ? 'recommended' : chip, query: debouncedQuery, expectedPrice: expected }), [all, filters, chip, vendors, debouncedQuery, expected])

  useEffect(() => setVisible(PAGE), [chip, filters, debouncedQuery])

  // Infinite scroll.
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || view !== 'list') return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisible((n) => Math.min(n + PAGE, results.length))
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [results.length, view])

  const setViewPersist = useCallback((v: 'list' | 'map') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
    if (v === 'map') track('map_opened', { results: results.length })
  }, [results.length])

  async function applyFilterSheet(f: VenueFilters, r: number) {
    setFilters(f)
    setFiltersOpen(false)
    try {
      localStorage.setItem(FILTERS_KEY, serializeFilters(f))
    } catch {
      /* ignore */
    }
    track('filter_used', { count: activeFilterCount(f), radius: r, minRating: f.minRating, setting: f.setting })
    if (party && r !== radius) {
      const updated = await updateParty(party.id, { search_radius_miles: r }).catch(() => null)
      if (updated) replaceParty(updated)
    }
  }

  function pickChip(c: ChipFilter) {
    setChip(c)
    track('filter_used', { chip: c })
  }

  // ---------------------------------------------------------------- states
  if (!partyLoading && !party) {
    return (
      <EmptyState
        icon="🎈"
        title="Let’s start with your party"
        body="Tell us about your child, your ZIP code and budget — we’ll find party places near you automatically."
        action={<LinkButton href="/start" block size="lg">Plan a party</LinkButton>}
      />
    )
  }

  const loc = discovery.data?.location
  const place = loc ? [loc.city, loc.state].filter(Boolean).join(', ') || loc.zip : party?.zip_code
  const subtitle = (
    <button type="button" onClick={() => setFiltersOpen(true)} className="tap -m-1 rounded-md p-1 text-left underline-offset-4 hover:underline">
      {party?.zip_code ?? '—'} • Within {radius} miles
    </button>
  )

  const err = discovery.error as ApiError | undefined
  const errorView = err ? (
    <ErrorState
      offline={err.isNetwork}
      title={err.code === 'invalid_zip' ? 'We couldn’t find that ZIP' : 'Place search is taking a break'}
      message={err.code === 'unauthorized' ? 'Your session expired. Please sign in again.' : err.message}
      onRetry={err.code === 'unauthorized' ? () => router.push('/login?next=/discover&expired=1') : err.code === 'invalid_zip' ? () => router.push('/plan?edit=zip') : () => discovery.mutate()}
    />
  ) : null

  const header = (
    <div ref={headerRef} className={cn('px-4 pb-2', view === 'map' ? 'pt-2' : 'pt-4')}>
      <div className={cn('flex items-start justify-between gap-3', view === 'map' && 'sr-only')}>
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Party places near you</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link href="/discover/saved" className="tap mt-1 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-semibold" aria-label={`Saved places (${savedCount})`}>
          <Heart className={cn('h-4 w-4', savedCount ? 'fill-coral text-coral' : '')} /> {savedCount}
        </Link>
      </div>

      <div className={cn('flex items-center gap-2', view === 'map' ? 'mt-0' : 'mt-3')}>
        <label className="relative flex-1">
          <span className="sr-only">Search places</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places"
            className={cn("h-12 w-full rounded-full border border-input bg-card pl-11 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15", query ? "pr-10" : "pr-3")}
          />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="tap absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <button type="button" onClick={() => setFiltersOpen(true)} aria-label={`Filters${activeFilterCount(filters) ? ` (${activeFilterCount(filters)} active)` : ''}`} className="tap relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card active:bg-muted">
          <SlidersHorizontal className="h-5 w-5" />
          {activeFilterCount(filters) ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{activeFilterCount(filters)}</span> : null}
        </button>
        <div role="tablist" aria-label="View" className="flex h-12 shrink-0 rounded-full border border-border bg-card p-1">
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              aria-label={v === 'list' ? 'List view' : 'Map view'}
              onClick={() => setViewPersist(v)}
              className={cn('tap flex h-10 w-10 items-center justify-center rounded-full transition', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {v === 'list' ? <List className="h-5 w-5" /> : <MapIcon className="h-5 w-5" />}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar relative -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="toolbar" aria-label="Categories">
        {CHIPS.map((c) => (
          <Chip key={c.id} active={chip === c.id} onClick={() => pickChip(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
    </div>
  )

  const loading = partyLoading || (discovery.isLoading && !discovery.data)

  return (
    <div>
      {header}

      {view === 'map' ? (
        <div className="fixed inset-x-0 z-10 mx-auto max-w-xl" style={{ top: headerBottom, bottom: 'calc(var(--app-nav-h) + env(safe-area-inset-bottom))' }}>
          {loading ? (
            <div className="mbp-skeleton h-full w-full" />
          ) : errorView ? (
            <div className="h-full bg-background">{errorView}</div>
          ) : loc ? (
            <div className="relative h-full w-full overflow-hidden">
              <MapView venues={results} center={{ lat: loc.lat, lng: loc.lng }} radiusMiles={radius} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); if (id) setSnap('peek') }} bottomInset={148} />
              <MapSheet
                snap={snap}
                onSnapChange={setSnap}
                header={<p className="text-center text-sm font-semibold">{results.length} place{results.length === 1 ? '' : 's'} {selectedId ? '· tap the list for more' : 'on the map'}</p>}
              >
                <div className="space-y-3">
                  {(() => {
                    const sel = results.find((v) => v.placeId === selectedId)
                    const rest = results.filter((v) => v.placeId !== selectedId)
                    return [sel, ...rest].filter(Boolean).map((v) => <VenueCard key={v!.placeId} venue={v!} saved={savedIds.has(v!.placeId)} onToggleSave={toggle} compact />)
                  })()}
                </div>
              </MapSheet>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-4">
          {loading ? (
            <div aria-busy="true" aria-live="polite">
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground">
                <Sparkles className="h-5 w-5 animate-pulse" /> Finding party places near {place ?? 'you'}…
              </div>
              <div className="space-y-4">
                <VenueCardSkeleton />
                <VenueCardSkeleton />
              </div>
            </div>
          ) : errorView ? (
            errorView
          ) : (
            <>
              {discovery.data ? (
                <div
                  className={cn(
                    'mb-4 overflow-hidden rounded-3xl p-5 text-white',
                    showAha ? 'bg-hero shadow-lg shadow-primary/25 mbp-rise' : 'hidden',
                  )}
                  role="status"
                >
                  <p className="text-sm font-medium opacity-90">✨ {vendors ? 'Cakes, decor & more' : `Matched to ${party?.child_name.split(' ')[0]}`}</p>
                  <p className="mt-1 font-display text-2xl font-semibold leading-snug" data-testid="aha">
                    We found {discovery.data.total} party option{discovery.data.total === 1 ? '' : 's'} near you.
                  </p>
                  <button type="button" onClick={() => setShowAha(false)} className="mt-3 text-sm font-semibold underline underline-offset-4">
                    Start browsing
                  </button>
                </div>
              ) : null}
              {!showAha && discovery.data ? (
                <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                  {results.length} of {discovery.data.total} places{place ? ` near ${place}` : ''}
                </p>
              ) : null}
              {discovery.data?.meta.degraded ? (
                <p className="mb-3 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">Showing recently found places — live search is temporarily unavailable.</p>
              ) : null}

              {discovery.data && discovery.data.total === 0 ? (
                <EmptyState
                  icon="🔭"
                  title={`No places within ${radius} miles`}
                  body="Try a wider search radius — we’ll look further out."
                  action={radius < 50 ? <AppButton block onClick={() => applyFilterSheet(filters, Math.min(50, radius >= 30 ? 50 : radius * 2))}>Search {Math.min(50, radius >= 30 ? 50 : radius * 2)} miles</AppButton> : undefined}
                />
              ) : results.length === 0 ? (
                <EmptyState
                  icon="🧭"
                  title="No matches for these filters"
                  body="Try removing a filter or two."
                  action={<AppButton block variant="outline" onClick={() => { setFilters(DEFAULT_FILTERS); setChip('recommended'); setQuery('') }}>Clear filters</AppButton>}
                />
              ) : (
                <ul className="space-y-4" aria-label="Party places">
                  {results.slice(0, visible).map((v, i) => (
                    <li key={v.placeId}>
                      <VenueCard venue={v} saved={savedIds.has(v.placeId)} onToggleSave={toggle} priority={i < 2} />
                    </li>
                  ))}
                </ul>
              )}
              <div ref={sentinel} aria-hidden className="h-8" />
              {discovery.data?.total ? <p className="pb-4 text-center text-xs text-muted-foreground">Place data © Google Maps</p> : null}
            </>
          )}
        </div>
      )}

      <FiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} radius={radius} onApply={applyFilterSheet} resultCount={(f) => applyFilters(all, f, { chip: vendors ? 'recommended' : chip, query: debouncedQuery, expectedPrice: expected }).length} />
    </div>
  )
}
