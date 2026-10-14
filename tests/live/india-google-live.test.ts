/**
 * Opt-in, READ-ONLY live check of Google for India (never part of `npm test`; costs a few cents). It geocodes four
 * real PIN codes and one US ZIP, then runs one Places Text Search per location through the app's own clients.
 * It prints counts and Google's own place names — nothing is stored. Run:
 *   GOOGLE_LIVE=1 GOOGLE_PLACES_API_KEY=… npx vitest run tests/live/india-google-live.test.ts -c vitest.live.config.ts
 */
import { describe, expect, it } from 'vitest'
import { createZipGeocoder } from '@/lib/google/geocoding'
import { pinGeocoder } from '@/lib/discovery/server-deps'
import { createPlacesClient, normalizePlace } from '@/lib/google/places'
import { getCategory, queryFor } from '@/lib/discovery/taxonomy'
import { resolvePin } from '@/lib/geo/pin'

const PINS = [
  { pin: '400050', where: 'Bandra West, Mumbai, Maharashtra' },
  { pin: '560034', where: 'Koramangala, Bengaluru, Karnataka' },
  { pin: '110016', where: 'Hauz Khas, Delhi' },
  { pin: '500081', where: 'Madhapur, Hyderabad, Telangana' },
]

describe.skipIf(process.env.GOOGLE_LIVE !== '1')('Google for India (live, read-only)', () => {
  const places = createPlacesClient()
  const geocodePin = pinGeocoder('live-test')
  const play = getCategory('indoor-playground')!
  const venue = getCategory('birthday-party-venue')!

  for (const { pin, where } of PINS) {
    it(`PIN ${pin} (${where}) → location → nearby venues`, async () => {
      const loc = await resolvePin(pin, geocodePin)
      expect(loc, 'PIN resolves').not.toBeNull()
      expect(loc!.source, 'Google located the PIN (Geocoding API or Places), not just the offline dataset').toBe('geocoding')
      const found: string[] = []
      for (const cat of [venue, play]) {
        const raw = await places.searchText({ textQuery: queryFor(cat, 'IN'), center: loc!, radiusMeters: 8000, regionCode: 'IN', pageSize: 10 })
        const venues = raw.map((p) => normalizePlace(p, [cat.id])).filter((v) => !!v)
        found.push(`${queryFor(cat, 'IN')}: ${venues.length}${venues[0] ? ` (e.g. ${venues[0].name}, ${venues[0].country ?? '?'})` : ''}`)
        for (const v of venues) expect(v!.country === 'IN' || v!.country == null).toBe(true)
      }
      console.info(`[${pin}] ${loc!.city ?? '?'}, ${loc!.state ?? '?'} @ ${loc!.lat.toFixed(4)},${loc!.lng.toFixed(4)} | localities: ${loc!.localities.slice(0, 3).join(', ')} | ${found.join(' | ')}`)
    })
  }

  it('US ZIP 48084 (offline dataset, as in production) still searches with regionCode US', async () => {
    const { resolveZip } = await import('@/lib/geo/zip')
    const z = await resolveZip('48084', createZipGeocoder())
    expect(z?.state).toBe('MI')
    const raw = await places.searchText({ textQuery: venue.query, center: z!, radiusMeters: 8000, pageSize: 5 })
    console.info(`[48084] ${z!.city}, ${z!.state} (${z!.source}) | ${venue.query}: ${raw.length}`)
    expect(raw.length).toBeGreaterThan(0)
  })
})
