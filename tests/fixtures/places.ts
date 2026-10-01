import type { RawPlace } from '@/lib/google/places'

let seq = 0
/** Build a raw Places API (New) place. Fixture data is fictional. */
export function rawPlace(overrides: Partial<RawPlace> & { name?: string; lat?: number; lng?: number } = {}): RawPlace {
  seq++
  const { name, lat, lng, ...rest } = overrides
  const id = rest.id ?? `ChIJfixture${String(seq).padStart(6, '0')}`
  return {
    id,
    displayName: { text: name ?? `Fixture Place ${seq}` },
    formattedAddress: `${100 + seq} Main St, Troy, MI 48084, USA`,
    shortFormattedAddress: `${100 + seq} Main St, Troy`,
    addressComponents: [
      { longText: 'Troy', shortText: 'Troy', types: ['locality', 'political'] },
      { longText: 'Michigan', shortText: 'MI', types: ['administrative_area_level_1', 'political'] },
      { longText: '48084', shortText: '48084', types: ['postal_code'] },
    ],
    location: { latitude: lat ?? 42.5627 + seq * 0.002, longitude: lng ?? -83.1799 + seq * 0.002 },
    types: ['point_of_interest', 'establishment'],
    rating: 4.6,
    userRatingCount: 210,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    photos: [
      {
        name: `places/${id}/photos/AUc7tXfixturePhotoRef${seq}`,
        widthPx: 1200,
        heightPx: 800,
        authorAttributions: [{ displayName: 'Fixture Photographer', uri: 'https://maps.google.com/maps/contrib/1' }],
      },
    ],
    businessStatus: 'OPERATIONAL',
    googleMapsUri: `https://maps.google.com/?cid=${seq}`,
    ...rest,
  }
}
