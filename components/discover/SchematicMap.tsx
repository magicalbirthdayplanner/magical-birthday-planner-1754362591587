'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { LatLng } from '@/lib/geo/distance'
import { fitZoom, gridCluster, project, toScreen, unproject } from '@/lib/geo/cluster'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import { cn } from '@/lib/utils'
import type { MapViewProps } from './MapView'

const TILE_PX = 256

/** Tiles covering the container, positioned with the same projection as the markers. */
function visibleTiles(center: LatLng, zoom: number, vpWidth: number, vpHeight: number, width: number, height: number) {
  const c = project(center, zoom)
  const left = c.x - vpWidth / 2
  const top = c.y - vpHeight / 2
  const n = 2 ** zoom
  const out: { key: string; src: string; x: number; y: number }[] = []
  for (let ty = Math.floor(top / TILE_PX); ty <= Math.floor((top + height) / TILE_PX); ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(left / TILE_PX); tx <= Math.floor((left + width) / TILE_PX); tx++) {
      const wx = ((tx % n) + n) % n
      out.push({ key: `${zoom}/${tx}/${ty}`, src: `/api/map/tiles/${zoom}/${wx}/${ty}`, x: tx * TILE_PX - left, y: ty * TILE_PX - top })
    }
  }
  return out
}

/**
 * Lightweight map: Geoapify raster tiles (proxied, key stays on the server) under
 * our own markers and clustering. When tiles aren't configured (local dev, CI)
 * it degrades to a schematic grid with the same interactions: pan, zoom,
 * clustered markers, tap to select.
 */
export default function SchematicMap({ venues, center, radiusMiles, selectedId, onSelect, bottomInset = 0 }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null)
  const drag = useRef<{ x: number; y: number; c: { x: number; y: number }; moved: boolean } | null>(null)
  const [tiles, setTiles] = useState<'unknown' | 'ok' | 'off'>('unknown')
  const tileErrors = useRef(0)

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

  const tileList = vp && tiles !== 'off' ? visibleTiles(vp.center, vp.zoom, vp.width, vp.height, size.width, size.height) : []
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
      {tileList.length ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden data-testid="map-tiles">
          {tileList.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element -- same-origin tile proxy; next/image adds nothing here
            <img
              key={t.key}
              src={t.src}
              alt=""
              width={TILE_PX}
              height={TILE_PX}
              draggable={false}
              decoding="async"
              className="absolute max-w-none"
              style={{ left: t.x, top: t.y, width: TILE_PX, height: TILE_PX }}
              onLoad={() => tiles !== 'ok' && setTiles('ok')}
              onError={() => {
                // Not configured (404) or unreachable: fall back to the schematic grid.
                if (tiles !== 'ok' && ++tileErrors.current >= 3) setTiles('off')
              }}
            />
          ))}
        </div>
      ) : null}
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
      {tiles === 'ok' ? (
        <span className="absolute left-2 z-10 rounded bg-card/85 px-1.5 py-0.5 text-[10px] text-muted-foreground" style={{ bottom: bottomInset + 4 }}>
          <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" onPointerUp={(e) => e.stopPropagation()}>
            Powered by Geoapify
          </a>{' '}
          ·{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" onPointerUp={(e) => e.stopPropagation()}>
            © OpenStreetMap
          </a>{' '}
          contributors
        </span>
      ) : (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">Simplified map</span>
      )}
    </div>
  )
}
