'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { LatLng } from '@/lib/geo/distance'
import { fitZoom, gridCluster, project, toScreen, unproject } from '@/lib/geo/cluster'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import { cn } from '@/lib/utils'
import type { MapViewProps } from './MapView'

/**
 * Dependency-free fallback map used when no Google Maps browser key is set
 * (local development, CI). Same interactions as the Google map: pan, zoom,
 * clustered markers, tap to select.
 */
export default function SchematicMap({ venues, center, radiusMiles, selectedId, onSelect, bottomInset = 0 }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null)
  const drag = useRef<{ x: number; y: number; c: { x: number; y: number }; moved: boolean } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!size.width || view) return
    const pts = venues.length ? venues : [center]
    const fit = fitZoom(pts, size.width, Math.max(200, size.height - bottomInset), 40, 14)
    setView({ center: fit.center, zoom: fit.zoom })
  }, [size, venues, center, view, bottomInset])

  const vp = view && size.width ? { center: view.center, zoom: view.zoom, width: size.width, height: size.height - bottomInset } : null
  const clusters = useMemo(() => (vp ? gridCluster(venues.map((v) => ({ lat: v.lat, lng: v.lng, item: v })), vp, 52) : []), [venues, vp?.center.lat, vp?.center.lng, vp?.zoom, vp?.width, vp?.height]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId || !view || !vp) return
    const v = venues.find((x) => x.placeId === selectedId)
    if (!v) return
    const s = toScreen(v, vp)
    if (s.x < 40 || s.x > vp.width - 40 || s.y < 40 || s.y > vp.height - 40) setView({ ...view, center: { lat: v.lat, lng: v.lng } })
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  function zoomBy(d: number, around?: LatLng) {
    if (!view) return
    setView({ center: around ?? view.center, zoom: Math.min(17, Math.max(3, view.zoom + d)) })
  }

  const home = vp ? toScreen(center, vp) : null
  const radiusPx = vp ? toScreen({ lat: center.lat + radiusMiles / 69, lng: center.lng }, vp) : null

  return (
    <div
      ref={ref}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-[hsl(36_30%_93%)]"
      style={{ backgroundImage: 'linear-gradient(hsl(36 20% 88%) 1px, transparent 1px), linear-gradient(90deg, hsl(36 20% 88%) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      aria-label="Map of party places"
      role="application"
      data-testid="schematic-map"
      onPointerDown={(e) => {
        if (!view) return
        drag.current = { x: e.clientX, y: e.clientY, c: project(view.center, view.zoom), moved: false }
      }}
      onPointerMove={(e) => {
        if (!drag.current || !view) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true
        if (drag.current.moved) setView({ ...view, center: unproject({ x: drag.current.c.x - dx, y: drag.current.c.y - dy }, view.zoom) })
      }}
      onPointerUp={(e) => {
        const wasDrag = drag.current?.moved
        drag.current = null
        if (!wasDrag && e.target === ref.current) onSelect(null)
      }}
      onWheel={(e) => zoomBy(e.deltaY < 0 ? 1 : -1)}
    >
      {home && radiusPx ? (
        <>
          <div className="pointer-events-none absolute rounded-full border-2 border-dashed border-primary/30 bg-primary/5" style={{ left: home.x - Math.abs(home.y - radiusPx.y), top: home.y - Math.abs(home.y - radiusPx.y), width: 2 * Math.abs(home.y - radiusPx.y), height: 2 * Math.abs(home.y - radiusPx.y) }} />
          <div className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow" style={{ left: home.x, top: home.y }} aria-hidden />
        </>
      ) : null}
      {clusters.map((c) => {
        if (c.items.length > 1) {
          return (
            <button
              key={`c-${c.items[0].placeId}`}
              type="button"
              aria-label={`${c.items.length} places here. Zoom in`}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => zoomBy(2, { lat: c.lat, lng: c.lng })}
              className="tap absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-primary text-sm font-bold text-primary-foreground shadow-lg"
              style={{ left: c.x, top: c.y }}
              data-testid="map-cluster"
            >
              {c.items.length}
            </button>
          )
        }
        const v: ClientVenue = c.items[0]
        const active = v.placeId === selectedId
        return (
          <button
            key={v.placeId}
            type="button"
            aria-label={v.name}
            aria-pressed={active}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onSelect(v.placeId)}
            className={cn(
              'tap absolute flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border-2 border-white px-2.5 py-1.5 text-sm font-semibold shadow-lg transition-transform',
              active ? 'z-10 scale-110 bg-coral text-white' : 'bg-card text-foreground',
            )}
            style={{ left: c.x, top: c.y }}
            data-testid="map-marker"
          >
            <span aria-hidden>{primaryCategory(v.categories)?.emoji ?? '📍'}</span>
            {v.rating != null ? <span className="text-xs">{v.rating.toFixed(1)}</span> : null}
          </button>
        )
      })}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow">
        <button type="button" aria-label="Zoom in" onPointerUp={(e) => e.stopPropagation()} onClick={() => zoomBy(1)} className="tap flex h-11 w-11 items-center justify-center active:bg-muted">
          <Plus className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Zoom out" onPointerUp={(e) => e.stopPropagation()} onClick={() => zoomBy(-1)} className="tap flex h-11 w-11 items-center justify-center border-t border-border active:bg-muted">
          <Minus className="h-5 w-5" />
        </button>
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">Simplified map</span>
    </div>
  )
}
