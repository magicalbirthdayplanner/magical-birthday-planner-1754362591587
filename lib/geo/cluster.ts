/**
 * Grid clustering for the schematic (no-API-key) map, and a Web-Mercator
 * projection helper. The Google map uses @googlemaps/markerclusterer instead.
 */
import type { LatLng } from './distance'

export interface Point<T> extends LatLng {
  item: T
}

export interface Cluster<T> {
  x: number
  y: number
  items: T[]
  lat: number
  lng: number
}

export interface Viewport {
  center: LatLng
  zoom: number
  width: number
  height: number
}

const TILE = 256

export function project(p: LatLng, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom
  const siny = Math.min(Math.max(Math.sin((p.lat * Math.PI) / 180), -0.9999), 0.9999)
  return {
    x: scale * (0.5 + p.lng / 360),
    y: scale * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  }
}

/** Screen position (px) of a coordinate inside the viewport. */
export function toScreen(p: LatLng, vp: Viewport): { x: number; y: number } {
  const c = project(vp.center, vp.zoom)
  const q = project(p, vp.zoom)
  return { x: q.x - c.x + vp.width / 2, y: q.y - c.y + vp.height / 2 }
}

/** Zoom level that fits all points (with padding) in the viewport. */
export function fitZoom(points: LatLng[], width: number, height: number, padding = 48, maxZoom = 15): { center: LatLng; zoom: number } {
  if (!points.length) return { center: { lat: 39.8, lng: -98.6 }, zoom: 3 }
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 }
  for (let z = maxZoom; z >= 2; z--) {
    const a = project({ lat: Math.max(...lats), lng: Math.min(...lngs) }, z)
    const b = project({ lat: Math.min(...lats), lng: Math.max(...lngs) }, z)
    if (b.x - a.x <= width - padding * 2 && b.y - a.y <= height - padding * 2) return { center, zoom: z }
  }
  return { center, zoom: 2 }
}

/** Group points that fall into the same `cellPx` screen cell. */
export function gridCluster<T>(points: Point<T>[], vp: Viewport, cellPx = 56): Cluster<T>[] {
  const cells = new Map<string, Cluster<T> & { sx: number; sy: number }>()
  for (const p of points) {
    const s = toScreen(p, vp)
    const key = `${Math.floor(s.x / cellPx)}:${Math.floor(s.y / cellPx)}`
    const c = cells.get(key)
    if (c) {
      c.items.push(p.item)
      c.sx += s.x
      c.sy += s.y
      c.lat += p.lat
      c.lng += p.lng
    } else {
      cells.set(key, { x: 0, y: 0, items: [p.item], sx: s.x, sy: s.y, lat: p.lat, lng: p.lng })
    }
  }
  return Array.from(cells.values()).map((c) => {
    const n = c.items.length
    return { x: c.sx / n, y: c.sy / n, items: c.items, lat: c.lat / n, lng: c.lng / n }
  })
}

export function unproject(pt: { x: number; y: number }, zoom: number): LatLng {
  const scale = TILE * 2 ** zoom
  const lng = (pt.x / scale - 0.5) * 360
  const n = Math.PI - (2 * Math.PI * pt.y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lng }
}

/** Reasonable initial zoom for a search radius. */
export function zoomForRadius(miles: number): number {
  if (miles <= 5) return 12
  if (miles <= 10) return 11
  if (miles <= 20) return 10
  if (miles <= 30) return 9
  return 8
}
