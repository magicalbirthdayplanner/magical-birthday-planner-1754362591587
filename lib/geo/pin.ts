import type { LatLng } from './distance'
import { normalizePin } from '@/lib/country/postal'

/** Where an Indian PIN code is. A PIN covers several localities, so `localities` lists them and none is assumed. */
export interface PinLocation extends LatLng {
  pin: string
  city: string | null
  district: string | null
  state: string | null
  localities: string[]
  source: 'geocoding' | 'dataset'
  /** Dataset-only coordinates (GeoNames India centroids can be several km off). */
  approximate: boolean
}

export interface PinGeocodeResult extends LatLng {
  city: string | null
  locality: string | null
  district: string | null
  state: string | null
}
export type PinGeocoder = (pin: string) => Promise<PinGeocodeResult | null>

type PinTable = Record<string, [number, number, string | null, string | null, string[]]>
let table: PinTable | null = null

async function loadTable(): Promise<PinTable> {
  if (!table) {
    // Indian PIN centroids, districts, states and post-office localities from GeoNames (CC BY 4.0,
    // https://www.geonames.org), built by scripts/build-india-pins.mjs. Server-only.
    table = (await import('@/data/geo-in-pins.json')).default as unknown as PinTable
  }
  return table
}

/** Offline lookup (~19k PINs). Coordinates are approximate; district/state/localities are what we use it for. */
export async function lookupPin(pin: string): Promise<PinLocation | null> {
  const row = (await loadTable())[pin]
  if (!row) return null
  return { pin, lat: row[0], lng: row[1], city: row[2], district: row[2], state: row[3], localities: row[4] ?? [], source: 'dataset', approximate: true }
}

/**
 * PIN → location. Google Geocoding first (accurate coordinates), merged with the offline dataset (district, state,
 * localities); the dataset alone when Google is unavailable or has no answer. Partial answers are fine: a missing
 * city or state never rejects a PIN. Null only for a malformed PIN or one neither source knows.
 */
export async function resolvePin(input: unknown, geocode?: PinGeocoder): Promise<PinLocation | null> {
  const pin = normalizePin(input)
  if (!pin) return null
  const [row, geo] = await Promise.all([lookupPin(pin), geocode ? geocode(pin).catch(() => null) : Promise.resolve(null)])
  if (geo) {
    const localities = Array.from(new Set([geo.locality, ...(row?.localities ?? [])].filter((x): x is string => !!x))).slice(0, 8)
    return {
      pin,
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city ?? row?.district ?? geo.district,
      district: row?.district ?? geo.district,
      state: geo.state ?? row?.state ?? null,
      localities,
      source: 'geocoding',
      approximate: false,
    }
  }
  return row
}
