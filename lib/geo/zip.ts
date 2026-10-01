import type { LatLng } from './distance'

export interface ZipLocation extends LatLng {
  zip: string
  city: string | null
  state: string | null
  source: 'dataset' | 'geocoding'
}

/**
 * Accepts "48084", " 48084 ", "48084-1234". Returns the 5-digit ZIP or null.
 * Does not check that the ZIP exists — see resolveZip().
 */
export function normalizeZip(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null
  const m = String(input).trim().match(/^(\d{5})(?:-\d{4})?$/)
  if (!m || m[1] === '00000') return null
  return m[1]
}

type ZipTable = Record<string, [number, number, string, string]>
let table: ZipTable | null = null

async function loadTable(): Promise<ZipTable> {
  if (!table) {
    // US ZIP centroids from GeoNames (CC BY 4.0, https://www.geonames.org). Server-only.
    table = (await import('@/data/geo-us-zips.json')).default as unknown as ZipTable
  }
  return table
}

/** Offline lookup in the bundled dataset (~41k ZIPs incl. PO boxes). */
export async function lookupZip(zip: string): Promise<ZipLocation | null> {
  const row = (await loadTable())[zip]
  if (!row) return null
  return { zip, lat: row[0], lng: row[1], city: row[2] || null, state: row[3] || null, source: 'dataset' }
}

export type ZipGeocoder = (zip: string) => Promise<ZipLocation | null>

/**
 * ZIP → coordinates. Dataset first (free, instant, deterministic); Google Geocoding
 * fallback only for valid-looking ZIPs missing from the dataset (new ZIPs).
 */
export async function resolveZip(input: unknown, geocode?: ZipGeocoder): Promise<ZipLocation | null> {
  const zip = normalizeZip(input)
  if (!zip) return null
  const hit = await lookupZip(zip)
  if (hit) return hit
  if (!geocode) return null
  try {
    return await geocode(zip)
  } catch {
    return null
  }
}
