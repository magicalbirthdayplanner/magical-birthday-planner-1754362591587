export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_MILES = 3958.7613
export const METERS_PER_MILE = 1609.344

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const milesToMeters = (miles: number) => Math.round(miles * METERS_PER_MILE)

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  )
}

/** Human distance label: "0.4 mi", "6.2 mi", "23 mi". */
export function formatMiles(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}
