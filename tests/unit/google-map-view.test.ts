// @vitest-environment jsdom
/**
 * Regression: GoogleMapView must not re-register markers on every render. An inline
 * `ref={(m) => …}` caused React error #185 (maximum update depth) as soon as the real
 * map rendered with venues. The map library is mocked to behave like @vis.gl's
 * AdvancedMarker, which hands its marker instance to the ref.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const clusterer = { add: 0, clear: 0 }
vi.mock('@googlemaps/markerclusterer', () => ({
  MarkerClusterer: class {
    clearMarkers() { clusterer.clear++ }
    addMarkers() { clusterer.add++ }
  },
}))
vi.mock('@vis.gl/react-google-maps', () => {
  const map = { panTo: vi.fn() }
  return {
    APIProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    Map: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'gmap' }, children),
    useMap: () => map,
    AdvancedMarker: React.forwardRef(function AdvancedMarker(props: { title: string; children: React.ReactNode; onClick: () => void }, ref) {
      React.useImperativeHandle(ref, () => ({ title: props.title }), [props.title])
      return React.createElement('button', { title: props.title, onClick: props.onClick }, props.children)
    }),
  }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'browser-key-for-test'

const venues = Array.from({ length: 112 }, (_, i) => ({ placeId: `ChIJtest${String(i).padStart(6, '0')}`, name: `Venue ${i}`, lat: 42.56 + i * 0.001, lng: -83.18, rating: 4.5, categories: ['bowling'] }))

describe('GoogleMapView markers', () => {
  afterEach(() => { clusterer.add = clusterer.clear = 0 })

  it('renders 112 markers and settles (no render loop), also across parent re-renders', async () => {
    const { default: GoogleMapView } = await import('@/components/discover/GoogleMapView')
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((e) => { errors.push(e) })
    const el = document.createElement('div'); document.body.appendChild(el)
    const root = createRoot(el)
    const props = (selectedId: string | null) => ({ venues: venues as never, center: { lat: 42.56, lng: -83.18 }, radiusMiles: 20, selectedId, onSelect: () => {} })
    await act(async () => root.render(React.createElement(GoogleMapView, props(null))))
    const afterMount = clusterer.add
    // Parent re-renders with new inline callbacks and a selection, like DiscoverScreen does.
    for (const sel of [null, venues[3].placeId, venues[7].placeId]) await act(async () => root.render(React.createElement(GoogleMapView, props(sel))))
    expect(el.querySelectorAll('button[title]').length).toBe(112)
    expect(errors.filter((e) => /Maximum update depth|#185/.test(String(e)))).toEqual([])
    expect(afterMount).toBeLessThanOrEqual(3) // initial registration, not one per marker per render
    expect(clusterer.add - afterMount).toBe(0) // re-renders don't re-register markers
    act(() => root.unmount()); spy.mockRestore()
  })
})
