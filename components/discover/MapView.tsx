'use client'
import dynamic from 'next/dynamic'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import type { LatLng } from '@/lib/geo/distance'
import { Skeleton } from '@/components/app/ui'

export interface MapViewProps {
  venues: ClientVenue[]
  center: LatLng
  radiusMiles: number
  selectedId: string | null
  onSelect: (placeId: string | null) => void
  /** Pixels covered by the bottom sheet, so markers fit above it. */
  bottomInset?: number
}

const loading = () => <Skeleton className="h-full w-full rounded-none" />
const GoogleMapView = dynamic(() => import('./GoogleMapView'), { ssr: false, loading })
const SchematicMap = dynamic(() => import('./SchematicMap'), { ssr: false, loading })

/**
 * Geoapify-tiled map by default (tiles via /api/map/tiles; schematic grid when
 * tiles aren't configured). Google Maps only if a Google browser key is set.
 */
export function MapView(props: MapViewProps) {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? <GoogleMapView {...props} /> : <SchematicMap {...props} />
}
