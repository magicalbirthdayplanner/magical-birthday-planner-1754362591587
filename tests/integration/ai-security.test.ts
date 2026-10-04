/** AI production hardening: un-countable generations, cost caps, request size, bulk apply, undo-once (mock provider, local Supabase). */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_TIMEOUT_MS: '3000', AI_LONG_TIMEOUT_MS: '3000' })
process.env.AI_ENABLED_FEATURES = 'party_planner,theme_ideas,checklist'
const { resetAIConfig } = await import('@/lib/ai/config')
const { scriptMock, resetMock } = await import('@/lib/ai/providers/mock')
const { ProviderError } = await import('@/lib/ai/provider')
const planner = await import('@/app/api/ai/party-planner/route')
const applyRoute = await import('@/app/api/ai/apply/route')

const up = await isSupabaseUp()
let A: TestUser
const parties: string[] = []
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${A.accessToken}` })
const plan = (partyId: string, extra: Record<string, unknown> = {}) => planner.POST(new Request('http://app.test/api/ai/party-planner', { method: 'POST', headers: headers(), body: JSON.stringify({ partyId, ...extra }) }))
const apply = (body: unknown, method: 'POST' | 'DELETE' = 'POST') => (method === 'POST' ? applyRoute.POST : applyRoute.DELETE)(new Request('http://app.test/api/ai/apply', { method, headers: headers(), body: JSON.stringify(body) }))
const setPlan = async (plan: 'FREE' | 'STARTER' | 'PRO') => {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', A.id)
  await db.from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', A.id)
  if (plan !== 'FREE') await db.from('plan_overrides').insert({ user_id: A.id, plan, expires_at: null })
  await db.rpc('recompute_entitlement', { p_user: A.id })
}

beforeAll(async () => {
  if (!up) return
  A = await createTestUser('ai-sec')
  for (let i = 0; i < 3; i++) parties.push((await A.client.from('parties').insert({ user_id: A.id, child_name: 'Kid', child_age: 7, party_date: inDays(20), zip_code: '48084', guest_count: 12, budget: 300 }).select('id').single()).data!.id)
})
afterAll(async () => {
  if (!up) return
  await adminClient().from('plan_overrides').delete().eq('user_id', A.id)
  await deleteTestUser(A)
})
beforeEach(async () => {
  resetMock()
  delete process.env.AI_USER_DAILY_LIMIT
  resetAIConfig()
  if (up) {
    await adminClient().from('ai_generations').delete().eq('user_id', A.id)
    await setPlan('PRO')
  }
})

describe.skipIf(!up)('AI hardening', () => {
  it('a user cannot un-count an in-flight generation by finalizing it themselves', async () => {
    await setPlan('STARTER') // 10 per party
    let attempts = 0
    // While the "provider" runs, the user tries to flip their pending row to failed (the S1 attack).
    scriptMock(...Array.from({ length: 12 }, () => async () => {
      attempts++
      const { data } = await A.client.from('ai_generations').select('id').eq('status', 'pending')
      for (const r of data ?? []) {
        const res = await A.client.rpc('ai_finalize', { p_id: r.id, p_user: A.id, p_status: 'failed', p_provider: '', p_model: '', p_input_tokens: 0, p_output_tokens: 0, p_duration_ms: 0, p_error_code: 'x', p_result: null as unknown as string })
        expect(res.error).not.toBeNull()
      }
      const { FIXTURES } = await import('@/lib/ai/fixtures')
      return JSON.stringify(FIXTURES.party_planner)
    }))
    const codes: number[] = []
    for (let i = 0; i < 11; i++) codes.push((await plan(parties[0])).status)
    expect(codes).toEqual([...Array(10).fill(200), 429])
    expect(attempts).toBe(10)
  })

  it('failed and cancelled calls count toward the per-user hourly cap (but not the per-party cap)', async () => {
    scriptMock(...Array.from({ length: 10 }, () => new ProviderError('unavailable', 'x', 502)))
    const codes: number[] = []
    for (let i = 0; i < 11; i++) codes.push((await plan(parties[i % 3])).status)
    expect(codes.slice(0, 10).every((c) => c === 502)).toBe(true)
    const last = await (await plan(parties[0])).json()
    expect(last.error.code).toBe('limit_reached')
    expect(last.error.message).toMatch(/last hour/)
    expect(last.error.upgradeTo).toBeNull()
  })

  it('per-user daily cap applies across parties (AI_USER_DAILY_LIMIT)', async () => {
    process.env.AI_USER_DAILY_LIMIT = '2'
    resetAIConfig()
    expect((await plan(parties[0])).status).toBe(200)
    expect((await plan(parties[1])).status).toBe(200)
    const r = await plan(parties[2])
    expect(r.status).toBe(429)
    expect((await r.json()).error.message).toMatch(/today/)
  })

  it('oversized request bodies are rejected before any work', async () => {
    const r = await plan(parties[0], { notes: 'x'.repeat(20_000) })
    expect(r.status).toBe(400)
    const { count } = await adminClient().from('ai_generations').select('id', { count: 'exact', head: true }).eq('user_id', A.id)
    expect(count).toBe(0)
    const big = await apply({ generationId: '00000000-0000-0000-0000-000000000000', target: 'activities', itemIds: Array.from({ length: 41 }, (_, i) => `act-${i + 1}`) })
    expect(big.status).toBe(400)
  })

  it('Add all applies many items once; duplicates are skipped; undo works only once', async () => {
    const g = await (await plan(parties[1])).json()
    const ids = g.result.shoppingList.map((s: { id: string }) => s.id)
    const r1 = await (await apply({ generationId: g.generationId, target: 'shopping_list', itemIds: ids })).json()
    expect(r1).toMatchObject({ status: 'applied_many', added: ids.length, skipped: 0 })
    const r2 = await (await apply({ generationId: g.generationId, target: 'shopping_list', itemIds: ids })).json()
    expect(r2).toMatchObject({ added: 0, skipped: ids.length })
    expect((await A.client.from('party_shopping_items').select('id').eq('party_id', parties[1])).data).toHaveLength(ids.length)
    // theme can't be bulk-applied
    expect((await apply({ generationId: g.generationId, target: 'theme', itemIds: ['theme'] })).status).toBe(400)
    // budget: apply → user edits amount → undo restores nothing twice
    await apply({ generationId: g.generationId, itemId: 'bud-1', target: 'budget' })
    expect((await apply({ generationId: g.generationId, itemId: 'bud-1', target: 'budget' }, 'DELETE')).status).toBe(200)
    expect((await apply({ generationId: g.generationId, itemId: 'bud-1', target: 'budget' }, 'DELETE')).status).toBe(404)
  })

  it('AI never writes actual spend; planner theme carries decorations and activities', async () => {
    const g = await (await plan(parties[2])).json()
    await apply({ generationId: g.generationId, target: 'budget', itemIds: g.result.budget.lines.map((l: { id: string }) => l.id) })
    const lines = (await A.client.from('party_budget_lines').select('category, amount, actual_amount').eq('party_id', parties[2])).data!
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => l.actual_amount === null)).toBe(true)
    // a parent-entered actual survives a later AI budget apply for the same category
    await A.client.from('party_budget_lines').update({ actual_amount: 41.5 }).eq('party_id', parties[2]).eq('category', 'Activities')
    const g2 = await (await plan(parties[2])).json()
    await apply({ generationId: g2.generationId, itemId: 'bud-1', target: 'budget', edits: { amount: 70 } })
    expect((await A.client.from('party_budget_lines').select('amount, actual_amount').eq('party_id', parties[2]).eq('category', 'Activities').single()).data).toEqual({ amount: 70, actual_amount: 41.5 })
    await apply({ generationId: g.generationId, itemId: 'theme', target: 'theme' })
    const p = (await A.client.from('parties').select('theme_details').eq('id', parties[2]).single()).data!
    expect((p.theme_details as { decorations: string[] }).decorations.length).toBeGreaterThan(0)
    expect((p.theme_details as { activities: string[] }).activities.length).toBeGreaterThan(0)
  })

  it('AI is off (fail closed) when the server has no service role', async () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      const r = await plan(parties[0])
      expect(r.status).toBe(503)
      expect((await r.json()).error.code).toBe('ai_disabled')
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = key
    }
  })
})
