'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import { zoomForRadius } from '@/lib/geo/cluster'
import { cn } from '@/lib/utils'
import { reportError, track } from '@/lib/observability/telemetry'
import type { MapViewProps } from './MapView'

function ClusteredMarkers({ venues, selectedId, onSelect }: Pick<MapViewProps, 'venues' | 'selectedId' | 'onSelect'>) {
  const map = useMap()
  const [markers, setMarkers] = useState<Record<string, Marker>>({})
  const clusterer = useMemo(() => (map ? new MarkerClusterer({ map }) : null), [map])

  useEffect(() => {
    if (!clusterer) return
    clusterer.clearMarkers()
    clusterer.addMarkers(Object.values(markers))
  }, [clusterer, markers])

  const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
    setMarkers((prev) => {
      if ((marker && prev[key]) || (!marker && !prev[key])) return prev
      if (marker) return { ...prev, [key]: marker }
      const { [key]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  return (
    <>
      {venues.map((v) => (
        <VenueMarker key={v.placeId} venue={v} selected={v.placeId === selectedId} onSelect={onSelect} setMarkerRef={setMarkerRef} />
      ))}
    </>
  )
}

/**
 * One marker with a STABLE ref callback. An inline `ref={(m) => …}` is a new function on
 * every render, so React detaches (null) and re-attaches it each time; with the marker
 * registry in state that loops forever (React error #185, "Maximum update depth").
 */
function VenueMarker({ venue: v, selected, onSelect, setMarkerRef }: { venue: ClientVenue; selected: boolean; onSelect: (id: string) => void; setMarkerRef: (m: Marker | null, key: string) => void }) {
  const ref = useCallback((m: Marker | null) => setMarkerRef(m, v.placeId), [setMarkerRef, v.placeId])
  const handleClick = useCallback(() => onSelect(v.placeId), [onSelect, v.placeId])
  return (
    <AdvancedMarker position={{ lat: v.lat, lng: v.lng }} ref={ref} onClick={handleClick} title={v.name}>
      <span className={cn('flex items-center gap-1 rounded-full border-2 border-white px-2.5 py-1.5 text-sm font-semibold shadow-lg', selected ? 'scale-110 bg-[hsl(12_88%_64%)] text-white' : 'bg-white text-[hsl(252_32%_14%)]')}>
        <span aria-hidden>{primaryCategory(v.categories)?.emoji ?? '📍'}</span>
        {v.rating != null ? <span className="text-xs">{v.rating.toFixed(1)}</span> : null}
      </span>
    </AdvancedMarker>
  )
}

function PanToSelected({ venues, selectedId }: { venues: ClientVenue[]; selectedId: string | null }) {
  const map = useMap()
  useEffect(() => {
    const v = venues.find((x) => x.placeId === selectedId)
    if (map && v) map.panTo({ lat: v.lat, lng: v.lng })
  }, [map, selectedId, venues])
  return null
}

export default function GoogleMapView({ venues, center, radiusMiles, selectedId, onSelect }: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
  return (
    <APIProvider
      apiKey={apiKey}
      onError={() => {
        // The Maps JS script failed to load (key, referrer, billing or network). No location data is sent.
        track('GOOGLE_MAPS_LOAD_FAILED', {}, undefined, 'warn')
        reportError('Google Maps JS failed to load', { area: 'google', op: 'maps_js_load', level: 'warning', fingerprint: ['google-maps-js'] })
      }}
    >
      <Map
        className="h-full w-full"
        defaultCenter={center}
        defaultZoom={zoomForRadius(radiusMiles)}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        onClick={() => onSelect(null)}
      >
        <ClusteredMarkers venues={venues} selectedId={selectedId} onSelect={onSelect} />
        <PanToSelected venues={venues} selectedId={selectedId} />
      </Map>
    </APIProvider>
  )
}
