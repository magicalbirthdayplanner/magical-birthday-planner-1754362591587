/**
 * Google Places / Geocoding observability (server). Operation, latency, HTTP status category and result count.
 * Never the API key, the query text, coordinates, addresses or the raw Google payload.
 */
import 'server-only'
import { reportError, timing, track } from './telemetry'

export type PlacesOp = 'search' | 'details' | 'photo' | 'geocode'

const statusClass = (s?: number) => (s ? `${Math.floor(s / 100)}xx` : 'none')

export function placesSucceeded(op: PlacesOp, ms: number, resultCount?: number) {
  track('GOOGLE_PLACES_REQUEST', { operation: op })
  track('GOOGLE_PLACES_SUCCESS', { operation: op }, { latency_ms: Math.round(ms), result_count: resultCount })
  timing('GOOGLE_PLACES_LATENCY', ms, { operation: op, success: true })
}

/** kind = PlacesErrorKind (quota / auth / timeout / network / unavailable / not_configured / not_found / invalid_request). */
export function placesFailed(op: PlacesOp, ms: number, kind: string, status?: number) {
  track('GOOGLE_PLACES_REQUEST', { operation: op })
  track('GOOGLE_PLACES_FAILURE', { operation: op, kind, status: statusClass(status) }, { latency_ms: Math.round(ms), http_status: status }, 'warn')
  timing('GOOGLE_PLACES_LATENCY', ms, { operation: op, success: false })
  // A missing place or a bad id is normal; key, billing, quota and outages are not.
  if (kind === 'not_found' || kind === 'invalid_request') return
  const level = kind === 'timeout' || kind === 'network' ? 'warning' : 'error'
  reportError(`Google Places ${op} failed: ${kind}`, { area: 'google', op: `places_${op}`, level, tags: { operation: op, kind, http_status: status }, fingerprint: ['google-places', kind] })
}
