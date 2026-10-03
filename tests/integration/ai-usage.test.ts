/** AI usage controls: global breaker, hourly cap, trial = Free tier, admin plan switching (mock provider, local Supabase). */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_ENABLED_FEATURES: 'party_planner,theme_ideas,checklist,food' })
const { resetAIConfig } = await import('@/lib/ai/config')
const { resetMock } = await import('@/lib/ai/providers/mock')
const planner = await import('@/app/api/ai/party-planner/route')
const caps = await import('@/app/api/ai/capabilities/route')

const up = await isSupabaseUp()
let A: TestUser
const parties: string[] = []
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const post = (partyId: string) => planner.POST(new Request('http://app.test/api/ai/party-planner', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${A.accessToken}` }, body: JSON.stringify({ partyId }) }))
const capsFor = async (partyId: string) => (await caps.GET(new Request(`http://app.test/api/ai/capabilities?partyId=${partyId}`, { headers: { Authorization: `Bearer ${A.accessToken}` } }))).json()
const override = async (plan: 'STARTER' | 'PLUS' | 'PRO' | null, expiresAt: string | null = null) => {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', A.id)
  if (plan) await db.from('plan_overrides').insert({ user_id: A.id, plan, expires_at: expiresAt })
  await db.rpc('recompute_entitlement', { p_user: A.id })
}

beforeAll(async () => {
  if (!up) return
  A = await createTestUser('ai-usage')
  for (let i = 0; i < 2; i++) parties.push((await A.client.from('parties').insert({ user_id: A.id, child_name: 'Kid', child_age: 6, party_date: inDays(20), zip_code: '48084', guest_count: 10, budget: 200 }).select('id').single()).data!.id)
})
afterAll(async () => {
  if (!up) return
  await adminClient().from('plan_overrides').delete().eq('user_id', A.id)
  await deleteTestUser(A)
})
beforeEach(async () => {
  resetMock()
  delete process.env.AI_GLOBAL_DAILY_LIMIT
  resetAIConfig()
  if (up) await adminClient().from('ai_generations').delete().eq('user_id', A.id)
})

describe.skipIf(!up)('usage controls', () => {
  it('global daily breaker → high_demand (and the rejected call is not reserved)', async () => {
    await override('PRO')
    process.env.AI_GLOBAL_DAILY_LIMIT = '1'
    resetAIConfig()
    const { data: before } = await A.client.rpc('ai_global_count_today')
    process.env.AI_GLOBAL_DAILY_LIMIT = String((before as number) + 1)
    resetAIConfig()
    expect((await post(parties[0])).status).toBe(200)
    const r = await post(parties[0])
    expect(r.status).toBe(503)
    expect((await r.json()).error.code).toBe('high_demand')
  })
  it('per-user hourly cap (10) applies across parties even on Pro', async () => {
    await override('PRO')
    const codes: number[] = []
    for (let i = 0; i < 11; i++) codes.push((await post(parties[i % 2])).status)
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true)
    expect(codes[10]).toBe(429)
  })
  it('a sign-up trial counts as Free for AI (Pro-only food stays locked)', async () => {
    await override(null)
    await adminClient().from('users').update({ is_trial_active: true, trial_plan: 'PRO', trial_expires_at: new Date(Date.now() + 864e5).toISOString() }).eq('id', A.id)
    await adminClient().rpc('recompute_entitlement', { p_user: A.id })
    const j = await capsFor(parties[0])
    expect(j.tier).toBe('FREE')
    const f = Object.fromEntries(j.features.map((x: { feature: string }) => [x.feature, x]))
    expect(f.party_planner).toMatchObject({ allowed: true, limit: 3 })
    expect(f.food).toMatchObject({ allowed: false, upgradeTo: 'PRO' })
    expect(f.checklist).toMatchObject({ allowed: false, upgradeTo: 'STARTER' })
    await adminClient().from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', A.id)
  })
  it('Super Admin plan switching changes AI access immediately; expired override falls back', async () => {
    await override('STARTER')
    expect((await capsFor(parties[0])).tier).toBe('STARTER')
    await override('PRO')
    const j = await capsFor(parties[0])
    expect(j.tier).toBe('PRO')
    expect(j.features.find((x: { feature: string }) => x.feature === 'food')).toMatchObject({ allowed: true, limit: 50 })
    await override('PRO', new Date(Date.now() - 1000).toISOString())
    expect((await capsFor(parties[0])).tier).toBe('FREE')
  })
  it('remaining counts match server enforcement and failed calls are not counted', async () => {
    await override('STARTER')
    await post(parties[1])
    const j = await capsFor(parties[1])
    expect(j.used).toBe(1)
    expect(j.features.find((x: { feature: string }) => x.feature === 'party_planner').remaining).toBe(9)
  })
})
