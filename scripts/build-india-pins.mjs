#!/usr/bin/env node
/**
 * Builds data/geo-in-pins.json from the GeoNames India postal-code dump (CC BY 4.0, https://www.geonames.org —
 * the same source and licence as data/geo-us-zips.json).
 *
 *   curl -O https://download.geonames.org/export/zip/IN.zip && unzip IN.zip   (in an empty scratch directory)
 *   node scripts/build-india-pins.mjs /path/to/IN.txt
 *
 * Output: { "<6-digit PIN>": [lat, lng, district, state, [locality, …]] }. A PIN covers several post-office
 * localities, so all (up to 8) are kept and none is assumed to be "the" locality. GeoNames coordinates for India are
 * approximate (often several km off), so lib/geo/pin.ts prefers Google Geocoding for coordinates and uses these
 * only as a fallback; district, state and localities come from here.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/build-india-pins.mjs /path/to/IN.txt')
  process.exit(1)
}
const clean = (s) => s.replace(/\s+(G\.?P\.?O\.?|H\.?O\.?|S\.?O\.?|B\.?O\.?|P\.?O\.?)$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

const by = new Map()
for (const line of readFileSync(src, 'utf8').split('\n')) {
  const f = line.split('\t')
  if (f.length < 11 || f[0] !== 'IN' || !/^[1-9]\d{5}$/.test(f[1])) continue
  const lat = Number(f[9])
  const lng = Number(f[10])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
  const e = by.get(f[1]) ?? { lats: [], lngs: [], district: f[5] || null, state: f[3] || null, places: new Set() }
  e.lats.push(lat)
  e.lngs.push(lng)
  const place = clean(f[2])
  if (place && e.places.size < 8) e.places.add(place)
  by.set(f[1], e)
}

const out = {}
for (const [pin, e] of [...by.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  out[pin] = [Number(median(e.lats).toFixed(4)), Number(median(e.lngs).toFixed(4)), e.district, e.state, [...e.places]]
}
const dest = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data/geo-in-pins.json')
writeFileSync(dest, JSON.stringify(out))
console.log(`wrote ${Object.keys(out).length} PINs to ${dest}`)
