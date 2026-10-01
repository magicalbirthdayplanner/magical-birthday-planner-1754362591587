import { describe, expect, it } from 'vitest'
import { formatMiles, haversineMiles, isValidLatLng, milesToMeters } from '@/lib/geo/distance'
import { lookupZip, normalizeZip, resolveZip } from '@/lib/geo/zip'

describe('normalizeZip', () => {
  it.each([
    ['48084', '48084'],
    [' 48084 ', '48084'],
    ['48084-1234', '48084'],
    [48084, '48084'],
  ])('accepts %s', (input, out) => expect(normalizeZip(input)).toBe(out))

  it.each(['4808', '480845', 'abcde', '', '00000', null, undefined, '48084-12', 'SW1A 1AA'])('rejects %s', (input) =>
    expect(normalizeZip(input)).toBeNull(),
  )
})

describe('ZIP dataset', () => {
  it('resolves 48084 to Troy, MI', async () => {
    const z = await lookupZip('48084')
    expect(z).toMatchObject({ zip: '48084', city: 'Troy', state: 'MI', source: 'dataset' })
    expect(z!.lat).toBeCloseTo(42.56, 1)
    expect(z!.lng).toBeCloseTo(-83.18, 1)
  })

  it('resolves arbitrary valid US ZIPs (not hard-coded)', async () => {
    expect(await lookupZip('10001')).toMatchObject({ city: 'New York', state: 'NY' })
    expect(await lookupZip('94103')).toMatchObject({ state: 'CA' })
    expect(await lookupZip('99501')).toMatchObject({ state: 'AK' })
  })

  it('uses the geocoder only for ZIPs missing from the dataset', async () => {
    let calls = 0
    const geocode = async (zip: string) => {
      calls++
      return { zip, lat: 1, lng: 2, city: 'X', state: 'YY', source: 'geocoding' as const }
    }
    await resolveZip('48084', geocode)
    expect(calls).toBe(0)
    const missing = await resolveZip('00601x', geocode)
    expect(missing).toBeNull()
    const unknown = await resolveZip('99999', geocode)
    expect(calls).toBe(1)
    expect(unknown?.source).toBe('geocoding')
  })

  it('returns null when the fallback geocoder throws', async () => {
    expect(await resolveZip('99999', async () => { throw new Error('boom') })).toBeNull()
  })
})

describe('distance', () => {
  it('computes great-circle miles', () => {
    // Troy, MI → Detroit, MI ≈ 16 miles
    expect(haversineMiles({ lat: 42.5627, lng: -83.1799 }, { lat: 42.3314, lng: -83.0458 })).toBeGreaterThan(15)
    expect(haversineMiles({ lat: 42.5627, lng: -83.1799 }, { lat: 42.3314, lng: -83.0458 })).toBeLessThan(18)
    expect(haversineMiles({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0)
  })
  it('formats and converts', () => {
    expect(formatMiles(6.234)).toBe('6.2 mi')
    expect(formatMiles(23.6)).toBe('24 mi')
    expect(formatMiles(null)).toBeNull()
    expect(milesToMeters(20)).toBe(32187)
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false)
    expect(isValidLatLng({ lat: 42, lng: -83 })).toBe(true)
  })
})
