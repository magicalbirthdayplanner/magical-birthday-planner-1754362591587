import { describe, expect, it, vi } from 'vitest'
import { PlacesError, createPlacesClient, isValidPhotoName, normalizePlace, placeIdFromPhotoName } from '@/lib/google/places'
import { rawPlace } from '../fixtures/places'

const center = { lat: 42.5627, lng: -83.1799 }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Places client', () => {
  it('sends a field-masked text search restricted to the radius box and never puts the key in the URL', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ places: [rawPlace({ name: 'Art Barn' })] }))
    const client = createPlacesClient({ apiKey: 'k-secret', baseUrl: 'https://places.test', fetchImpl })
    const places = await client.searchText({ textQuery: 'kids art studio', center, radiusMeters: 32187 })
    expect(places).toHaveLength(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://places.test/v1/places:searchText')
    expect(url).not.toContain('k-secret')
    const headers = init.headers as Record<string, string>
    expect(headers['X-Goog-Api-Key']).toBe('k-secret')
    expect(headers['X-Goog-FieldMask']).toContain('places.rating')
    expect(headers['X-Goog-FieldMask']).not.toContain('websiteUri') // contact fields only in details
    const body = JSON.parse(init.body as string)
    // Hard restriction: bounding box of the 20-mile circle around the party.
    const { low, high } = body.locationRestriction.rectangle
    expect((low.latitude + high.latitude) / 2).toBeCloseTo(center.lat, 6)
    expect((low.longitude + high.longitude) / 2).toBeCloseTo(center.lng, 6)
    expect((high.latitude - low.latitude) / 2).toBeCloseTo(32187 / 111_320, 5)
    expect(high.longitude - center.lng).toBeGreaterThan(high.latitude - center.lat) // wider in degrees at 42°N
    expect(body.pageSize).toBe(20)
  })

  it('returns [] when Google has no results', async () => {
    const client = createPlacesClient({ apiKey: 'k', fetchImpl: async () => jsonResponse({}) })
    expect(await client.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).toEqual([])
  })

  it('classifies quota errors', async () => {
    const client = createPlacesClient({
      apiKey: 'k',
      fetchImpl: async () => jsonResponse({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }, 429),
    })
    await expect(client.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'quota', status: 429 })
  })

  it('classifies auth, bad request and server errors', async () => {
    for (const [status, kind] of [[403, 'auth'], [400, 'invalid_request'], [503, 'unavailable']] as const) {
      const client = createPlacesClient({ apiKey: 'k', fetchImpl: async () => jsonResponse({ error: {} }, status) })
      await expect(client.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).rejects.toMatchObject({ kind })
    }
  })

  it('times out slow requests', async () => {
    const fetchImpl = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    const client = createPlacesClient({ apiKey: 'k', timeoutMs: 20, fetchImpl: fetchImpl as typeof fetch })
    await expect(client.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('reports network failures', async () => {
    const client = createPlacesClient({ apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed') } })
    await expect(client.searchText({ textQuery: 'x', center, radiusMeters: 1000 })).rejects.toMatchObject({ kind: 'network' })
  })

  it('refuses to run without a key', async () => {
    const client = createPlacesClient({ apiKey: '', fetchImpl: vi.fn() })
    await expect(client.searchText({ textQuery: 'x', center, radiusMeters: 1 })).rejects.toBeInstanceOf(PlacesError)
  })

  it('requests photo URIs without redirect so the key stays server-side', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ photoUri: 'https://lh3.googleusercontent.com/p/abc' }))
    const client = createPlacesClient({ apiKey: 'k', baseUrl: 'https://places.test', fetchImpl })
    const name = 'places/ChIJabcdefghij/photos/AUc7tXabcdefghij'
    expect(await client.getPhotoUri(name, 400)).toBe('https://lh3.googleusercontent.com/p/abc')
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(`https://places.test/v1/${name}/media?maxWidthPx=400&skipHttpRedirect=true`)
    await expect(client.getPhotoUri('../../etc/passwd', 400)).rejects.toMatchObject({ kind: 'invalid_request' })
  })

  it('validates photo names and place ids', async () => {
    expect(isValidPhotoName('places/ChIJabcdefghij/photos/AUc7tXabcdefghij')).toBe(true)
    expect(isValidPhotoName('places/x/photos/y?key=1')).toBe(false)
    expect(placeIdFromPhotoName('places/ChIJabcdefghij/photos/AUc7tX')).toBe('ChIJabcdefghij')
    const client = createPlacesClient({ apiKey: 'k', fetchImpl: vi.fn() })
    await expect(client.getPlace('bad id/../')).rejects.toMatchObject({ kind: 'invalid_request' })
  })
})

describe('normalizePlace', () => {
  it('maps the API shape', () => {
    const v = normalizePlace(rawPlace({ name: 'Clay Cafe', types: ['art_studio'], priceLevel: 'PRICE_LEVEL_INEXPENSIVE' }), ['pottery-studio'])!
    expect(v.name).toBe('Clay Cafe')
    expect(v.city).toBe('Troy')
    expect(v.state).toBe('MI')
    expect(v.postalCode).toBe('48084')
    expect(v.priceLevel).toBe(1)
    expect(v.categories).toEqual(['pottery-studio', 'art-studio'])
    expect(v.photos[0].attributions[0].displayName).toBe('Fixture Photographer')
    expect(JSON.stringify(v)).not.toMatch(/key=/)
  })

  it('keeps missing fields null instead of inventing them', () => {
    const v = normalizePlace(
      rawPlace({ rating: undefined, userRatingCount: undefined, photos: undefined, websiteUri: undefined, formattedAddress: undefined, priceLevel: undefined, addressComponents: undefined }),
    )!
    expect(v.rating).toBeNull()
    expect(v.reviewCount).toBeNull()
    expect(v.photos).toEqual([])
    expect(v.website).toBeNull()
    expect(v.address).toBeNull()
    expect(v.priceLevel).toBeNull()
    expect(v.city).toBeNull()
  })

  it('drops unusable places (no id, name or location)', () => {
    expect(normalizePlace(rawPlace({ id: '' }))).toBeNull()
    expect(normalizePlace(rawPlace({ displayName: { text: ' ' } }))).toBeNull()
    expect(normalizePlace(rawPlace({ location: {} }))).toBeNull()
  })

  it('ignores malformed photo names', () => {
    const v = normalizePlace(rawPlace({ photos: [{ name: 'https://evil.example/x.jpg' }] }))!
    expect(v.photos).toEqual([])
  })
})
