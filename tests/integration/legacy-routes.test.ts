/** Hardened legacy routes: party-venue no longer trusts client-supplied ids. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY })
const route = await import('@/app/api/party-venue/route')

let A: TestUser
let B: TestUser
let partyA: string
const placeId = `ChIJlegacy${Date.now()}`

const req = (method: string, token: string | null, body?: unknown, qs = '') =>
  new Request(`http://app.test/api/party-venue${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }) as never

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  ;[A, B] = await Promise.all([createTestUser('legacy-a'), createTestUser('legacy-b')])
  const { data } = await A.client.from('parties').insert({ user_id: A.id, child_name: 'Leo', child_age: 6, party_date: '2026-12-01' }).select('id').single()
  partyA = data!.id
})
afterAll(async () => {
  await Promise.all([deleteTestUser(A), deleteTestUser(B)])
  await adminClient().from('venues').delete().eq('place_id', placeId)
})

describe('/api/party-venue', () => {
  const venue = { placeId, name: 'Legacy Fun Center', address: '1 Main St', latitude: 42.5, longitude: -83.1 }

  it('requires authentication (previously open with the service role)', async () => {
    expect((await route.POST(req('POST', null, { partyId: partyA, userId: A.id, venue }))).status).toBe(401)
    expect((await route.GET(req('GET', null, undefined, `?partyId=${partyA}`))).status).toBe(401)
    expect((await route.DELETE(req('DELETE', null, undefined, `?partyId=${partyA}&userId=${A.id}`))).status).toBe(401)
  })

  it("does not let user B set, read or delete user A's venue even with A's userId in the body", async () => {
    const set = await route.POST(req('POST', B.accessToken, { partyId: partyA, userId: A.id, venue }))
    expect(set.status).toBe(404)
    await route.POST(req('POST', A.accessToken, { partyId: partyA, venue }))
    const read = await (await route.GET(req('GET', B.accessToken, undefined, `?partyId=${partyA}`))).json()
    expect(read.venue).toBeNull()
    await route.DELETE(req('DELETE', B.accessToken, undefined, `?partyId=${partyA}`))
    const still = await adminClient().from('party_venues').select('id').eq('party_id', partyA)
    expect(still.data).toHaveLength(1)
  })

  it('lets the owner save and read their venue (legacy response shape)', async () => {
    const res = await route.POST(req('POST', A.accessToken, { partyId: partyA, venue }))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    const read = await (await route.GET(req('GET', A.accessToken, undefined, `?partyId=${partyA}`))).json()
    expect(read.venue).toMatchObject({ placeId, name: 'Legacy Fun Center' })
  })

  it('cannot overwrite existing catalogue data', async () => {
    await route.POST(req('POST', B.accessToken, { partyId: partyA, venue: { ...venue, name: 'HACKED' } }))
    const { data: bParty } = await B.client.from('parties').insert({ user_id: B.id, child_name: 'Bo', child_age: 5, party_date: '2026-12-02' }).select('id').single()
    await route.POST(req('POST', B.accessToken, { partyId: bParty!.id, venue: { ...venue, name: 'HACKED' } }))
    const { data } = await adminClient().from('venues').select('name').eq('place_id', placeId).single()
    expect(data!.name).toBe('Legacy Fun Center')
  })
})
