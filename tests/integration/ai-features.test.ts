/** Contextual AI features (mock provider, local Supabase): theme ideas, then checklist/budget/activities/food/… as they land. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_TIMEOUT_MS: '3000' })
process.env.AI_ENABLED_FEATURES = 'party_planner,theme_ideas,checklist,budget_optimizer,activities,food,invitation,timeline,shopping_list,discover_explain'
const { resetAIConfig } = await import('@/lib/ai/config')
const { scriptMock, resetMock, mockCalls } = await import('@/lib/ai/providers/mock')

export const up = await isSupabaseUp()
let A: TestUser, partyA: string
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const call = async (path: string, body: unknown) => {
  const mod = await import(`@/app/api/ai/${path}/route`)
  return mod.POST(new Request(`http://app.test/api/ai/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${A.accessToken}` }, body: JSON.stringify(body) }))
}
const setPlan = async (plan: 'FREE' | 'STARTER' | 'PLUS' | 'PRO') => {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', A.id)
  await db.from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', A.id)
  if (plan !== 'FREE') await db.from('plan_overrides').insert({ user_id: A.id, plan, expires_at: null })
  await db.rpc('recompute_entitlement', { p_user: A.id })
}

beforeAll(async () => {
  if (!up) return
  A = await createTestUser('ai-feat')
  partyA = (await A.client.from('parties').insert({ user_id: A.id, child_name: 'Ava', child_age: 10, party_date: inDays(8), zip_code: '48084', city: 'Troy', state: 'MI', guest_count: 15, budget: 300, interests: ['art'], venue_type: 'indoor', theme: 'ai:royal-ball', theme_details: { name: 'Royal Ball' } }).select('id').single()).data!.id
  await A.client.from('party_venues').insert({ party_id: partyA, user_id: A.id, is_custom: true, custom_name: 'Little Picasso Art Studio', custom_address: '1 Main St' })
})
afterAll(async () => {
  if (!up) return
  await adminClient().from('plan_overrides').delete().eq('user_id', A.id)
  await deleteTestUser(A)
})
beforeEach(async () => {
  resetMock()
  resetAIConfig()
  if (up) {
    await adminClient().from('ai_generations').delete().eq('user_id', A.id)
    await setPlan('PRO')
  }
})

describe.skipIf(!up)('theme_ideas', () => {
  it('returns 5 themes with server ids/slugs; protected names are replaced with a notice', async () => {
    const r = await call('theme-ideas', { partyId: partyA })
    expect(r.status).toBe(200)
    const { result } = await r.json()
    expect(result.themes).toHaveLength(5)
    expect(result.themes[0]).toMatchObject({ id: 'theme-1', slug: 'wild-art-safari', emoji: '🦁' })
    scriptMock(JSON.stringify({ themes: [{ name: 'Spider-Man Training', palette: ['#ff0000'] }, { name: 'Frozen Ball' }, { name: 'Art Lab' }], assumptions: [] }))
    const j = await (await call('theme-ideas', { partyId: partyA })).json()
    expect(j.result.themes.map((t: { name: string }) => t.name)).toEqual(['web-slinger hero Training', 'ice kingdom Ball', 'Art Lab'])
    expect(j.result.assumptions.join(' ')).toMatch(/replaced with generic/)
  })
  it('allowed on Free (limited); uses party context, not the child name', async () => {
    await setPlan('FREE')
    expect((await call('theme-ideas', { partyId: partyA })).status).toBe(200)
    expect(JSON.stringify(mockCalls()[0].messages)).not.toContain('Ava')
  })
})
