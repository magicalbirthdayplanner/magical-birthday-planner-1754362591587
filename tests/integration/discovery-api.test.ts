/**
 * Discovery API routes against the local Supabase stack and the mock Google server.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

const MOCK_PORT = 4011
const MOCK = `http://127.0.0.1:${MOCK_PORT}`

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  GOOGLE_PLACES_API_KEY: 'mock-key-not-secret',
  GOOGLE_PLACES_API_BASE_URL: MOCK,
  GOOGLE_GEOCODING_API_BASE_URL: MOCK,
  DISCOVERY_MAX_QUERIES: '4',
})

let mock: ChildProcess
let A: TestUser
let B: TestUser
let partyA: string

const search = await import('@/app/api/discovery/search/route')
const details = await import('@/app/api/discovery/places/[placeId]/route')
const photo = await import('@/app/api/discovery/photo/route')
const zipRoute = await import('@/app/api/discovery/zip/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

function post(token: string | null, body: unknown) {
  return search.POST(
    new Request('http://app.test/api/discovery/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  )
}

async function setMode(mode: string) {
  await fetch(`${MOCK}/__mock/mode`, { method: 'POST', body: JSON.stringify({ mode }) })
}
async function stats() {
  return (await (await fetch(`${MOCK}/__mock/stats`)).json()) as { searchText: number; details: number; photo: number }
}

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  mock = spawn(process.execPath, ['tests/mock-google/server.mjs'], { env: { ...process.env, MOCK_GOOGLE_PORT: String(MOCK_PORT) }, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${MOCK}/health`)).ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  ;[A, B] = await Promise.all([createTestUser('disc-a'), createTestUser('disc-b')])
  // Random location per run (≈1,000 × 1,000 cache cells) so the shared venue cache starts cold.
  const lat = 33 + Math.random() * 10
  const lng = -110 + Math.random() * 30
  const { data, error } = await A.client
    .from('parties')
    .insert({
      user_id: A.id, child_name: 'Ava', child_age: 7, party_date: '2026-12-12', zip_code: '48084',
      guest_count: 20, budget: 500, interests: ['art'], venue_type: 'mixed',
      latitude: lat, longitude: lng,
    })
    .select('id')
    .single()
  if (error) throw error
  partyA = data!.id
})

afterAll(async () => {
  mock?.kill()
  await Promise.all([deleteTestUser(A), deleteTestUser(B)])
})

beforeEach(async () => {
  resetRateLimits()
  await setMode('ok')
})

describe('POST /api/discovery/search', () => {
  it('requires authentication', async () => {
    const res = await post(null, { partyId: partyA })
    expect(res.status).toBe(401)
  })

  it("does not let user B search user A's party", async () => {
    const res = await post(B.accessToken, { partyId: partyA })
    expect(res.status).toBe(404)
  })

  it('returns ranked, deduplicated local results and caches them', async () => {
    const before = await stats()
    const res = await post(A.accessToken, { partyId: partyA })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThan(5)
    expect(body.location).toMatchObject({ zip: '48084', radiusMiles: 20 })
    const ids = body.venues.map((v: { placeId: string }) => v.placeId)
    expect(new Set(ids).size).toBe(ids.length)
    const names = body.venues.map((v: { name: string }) => v.name)
    expect(names).not.toContain('Closed Forever Fun House')
    expect(names).not.toContain('Way Too Far Funland')
    expect(names.slice(0, 5).some((n: string) => /art|paint|clay|glaze|picasso|easel/i.test(n))).toBe(true)
    // No API key in anything sent to the browser.
    expect(JSON.stringify(body)).not.toContain('mock-key-not-secret')
    const withPhoto = body.venues.find((v: { photo: unknown }) => v.photo)
    expect(withPhoto.photo.url).toMatch(/^\/api\/discovery\/photo\?name=places%2F/)
    // Missing data stays missing.
    const gem = body.venues.find((v: { name: string }) => v.name === 'Hidden Gem Party Loft')
    expect(gem).toMatchObject({ rating: null, reviewCount: null, photo: null, address: null })
    const firstCalls = (await stats()).searchText - before.searchText
    expect(firstCalls).toBe(4)

    // Second run: served from Supabase cache, no Google calls.
    const again = await post(A.accessToken, { partyId: partyA })
    const body2 = await again.json()
    expect(body2.meta.cacheHits).toBe(4)
    expect((await stats()).searchText - before.searchText).toBe(4)
    expect(body2.total).toBe(body.total)

    const { count } = await adminClient().from('venues').select('id', { count: 'exact', head: true }).like('place_id', 'ChIJmock%')
    expect(count).toBeGreaterThan(5)
  })

  it('maps quota errors to a friendly 503 when nothing is cached', async () => {
    await setMode('quota')
    const res = await post(A.accessToken, { partyId: partyA, radiusMiles: 7 })
    // radius 7 → new cache keys; stored venues near the party exist from the previous test
    const body = await res.json()
    if (res.status === 200) {
      expect(body.meta.degraded).toBe('stored_venues')
    } else {
      expect(res.status).toBe(503)
      expect(body.error.code).toBe('quota')
      expect(JSON.stringify(body)).not.toMatch(/RESOURCE_EXHAUSTED|stack/i)
    }
  })

  it('searches vendor categories on demand', async () => {
    const res = await post(A.accessToken, { partyId: partyA, categories: ['bakery'] })
    const body = await res.json()
    expect(body.meta.categories).toEqual(['bakery'])
    expect(body.venues.some((v: { name: string }) => /bakery|cake|crumb/i.test(v.name))).toBe(true)
  })

  it('rejects malformed requests', async () => {
    expect((await post(A.accessToken, { partyId: 'not-a-uuid' })).status).toBe(400)
  })
})

describe('GET /api/discovery/places/:placeId', () => {
  it('fetches details once and returns why-recommended for the party', async () => {
    const list = await (await post(A.accessToken, { partyId: partyA, radiusMiles: 20 })).json()
    const target = list.venues.find((v: { name: string }) => /picasso|splash|brush|easel/i.test(v.name))
    // Mock place ids are deterministic: clear details cached by earlier runs.
    await adminClient().from('venues').update({ details_synced_at: null }).eq('place_id', target.placeId)
    const before = await stats()
    const req = () =>
      details.GET(new Request(`http://app.test/api/discovery/places/${target.placeId}?partyId=${partyA}`, { headers: { Authorization: `Bearer ${A.accessToken}` } }), {
        params: Promise.resolve({ placeId: target.placeId }),
      })
    const res = await req()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.venue.website).toBe('https://example.com/')
    expect(body.venue.openingHours.weekdayDescriptions).toHaveLength(7)
    expect(body.venue.reasons.map((r: { text: string }) => r.text)).toContain("Matches Ava's love of art")
    await req()
    expect((await stats()).details - before.details).toBe(1)
  })

  it('requires auth', async () => {
    const res = await details.GET(new Request('http://app.test/api/discovery/places/ChIJmockabcdefghijkl'), { params: Promise.resolve({ placeId: 'ChIJmockabcdefghijkl' }) })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/discovery/photo', () => {
  it('redirects known photos to a key-less URL', async () => {
    const list = await (await post(A.accessToken, { partyId: partyA, radiusMiles: 20 })).json()
    const url = list.venues.find((v: { photo: unknown }) => v.photo).photo.url as string
    const res = await photo.GET(new Request(`http://app.test${url}`))
    expect(res.status).toBe(302)
    const loc = res.headers.get('location')!
    expect(loc).toContain('/__photo/')
    expect(loc).not.toContain('key=')
  })

  it('refuses photos of places we never surfaced and malformed names', async () => {
    const unknown = await photo.GET(new Request('http://app.test/api/discovery/photo?name=places/ChIJunknown12345/photos/AUabcdefghijklmn'))
    expect(unknown.status).toBe(404)
    const bad = await photo.GET(new Request('http://app.test/api/discovery/photo?name=https://evil.example/x'))
    expect(bad.status).toBe(400)
  })
})

describe('GET /api/discovery/zip', () => {
  const get = (zip: string) => zipRoute.GET(new Request(`http://app.test/api/discovery/zip?zip=${zip}`))
  it('resolves valid ZIPs', async () => {
    expect(await (await get('48084')).json()).toMatchObject({ zip: '48084', city: 'Troy', state: 'MI' })
    expect(await (await get('60614-1234')).json()).toMatchObject({ zip: '60614', state: 'IL' })
  })
  it('rejects malformed and unknown ZIPs', async () => {
    expect((await get('abc')).status).toBe(422)
    expect((await get('99999')).status).toBe(404)
  })
})
