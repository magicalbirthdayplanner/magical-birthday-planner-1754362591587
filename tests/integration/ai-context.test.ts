/** AI context privacy + ai_generations RLS isolation (local Supabase). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'
import { buildPartyAIContext, contextForPrompt, daysUntil } from '@/lib/ai/context'

const up = await isSupabaseUp()
let A: TestUser, B: TestUser, partyA: string, partyB: string
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

beforeAll(async () => {
  if (!up) return
  ;[A, B] = await Promise.all([createTestUser('ai-ctx-a'), createTestUser('ai-ctx-b')])
  const mk = async (u: TestUser, extra: Record<string, unknown> = {}) =>
    (await u.client.from('parties').insert({ user_id: u.id, child_name: 'Ava Smith', child_age: 7, party_date: inDays(8), zip_code: '48084', city: 'Troy', state: 'MI', guest_count: 15, budget: 250, interests: ['art', 'animals'], venue_type: 'indoor', ...extra }).select('id').single()).data!.id
  partyA = await mk(A)
  partyB = await mk(B)
  await A.client.from('guests').insert({ party_id: partyA, user_id: A.id, name: 'Garcia Family', email: 'garcia@example.test', phone: '+1 555 0100' })
  await A.client.from('party_venues').insert({ party_id: partyA, user_id: A.id, is_custom: true, custom_name: 'Little Picasso Art Studio', custom_address: '100 Main St, Troy, MI 48084' })
  await A.client.from('checklist_items').insert({ party_id: partyA, user_id: A.id, task_key: 'order-cake', title: 'Order the cake' })
})
afterAll(async () => {
  if (!up) return
  await Promise.all([deleteTestUser(A), deleteTestUser(B)])
})

describe.skipIf(!up)('buildPartyAIContext', () => {
  it('returns planning fields only — no names, ZIP, guest PII or street address', async () => {
    const ctx = await buildPartyAIContext(A.client, partyA, { plan: 'PLUS' })
    expect(ctx).toMatchObject({ childAge: 7, childInterests: ['art', 'animals'], daysUntilParty: 8, city: 'Troy', state: 'MI', guestCountEstimate: 15, budget: 250, indoorOutdoor: 'indoor', plan: 'PLUS', venue: { name: 'Little Picasso Art Studio', booked: true } })
    expect(ctx!.existingChecklist).toEqual([{ title: 'Order the cake', done: false }])
    const json = contextForPrompt(ctx!)
    for (const secret of ['Ava', 'Smith', '48084', 'garcia@example.test', '555 0100', 'Garcia', '100 Main St']) expect(json).not.toContain(secret)
  })
  it('invitation writer gets the first name + chosen venue address, nothing else extra', async () => {
    const ctx = await buildPartyAIContext(A.client, partyA, { plan: 'PLUS', includeInvitationFields: true })
    expect(ctx!.invitation).toMatchObject({ childFirstName: 'Ava', venueName: 'Little Picasso Art Studio', venueAddress: '100 Main St, Troy, MI 48084' })
    expect(contextForPrompt(ctx!)).not.toContain('Smith')
    expect(contextForPrompt(ctx!)).not.toContain('garcia@example.test')
  })
  it("another user's party is invisible (RLS)", async () => {
    expect(await buildPartyAIContext(B.client, partyA, { plan: 'PRO' })).toBeNull()
  })
})

describe.skipIf(!up)('ai_generations RLS', () => {
  it('only the server reserves (migration 1200); owners read their rows; others cannot; nobody writes directly or un-counts rows', async () => {
    // end users can no longer call the reservation RPC themselves
    expect((await A.client.rpc('ai_reserve', { p_user: A.id, p_party: partyA, p_feature: 'party_planner' })).error).not.toBeNull()
    const { data: id, error } = await adminClient().rpc('ai_reserve', { p_user: A.id, p_party: partyA, p_feature: 'party_planner', p_input_summary: { childAge: 7 } })
    expect(error).toBeNull()
    expect((await A.client.from('ai_generations').select('id, status').eq('id', id!)).data).toEqual([{ id, status: 'pending' }])
    expect((await B.client.from('ai_generations').select('id').eq('id', id!)).data).toEqual([])
    // no direct insert / update / delete for end users
    expect((await A.client.from('ai_generations').insert({ party_id: partyA, feature: 'party_planner' })).error).not.toBeNull()
    await A.client.from('ai_generations').update({ status: 'failed' }).eq('id', id!)
    await A.client.from('ai_generations').delete().eq('id', id!)
    expect((await adminClient().from('ai_generations').select('status').eq('id', id!).single()).data!.status).toBe('pending')
    // Neither B nor the owner A can finalize (service role only, migration 0900): A could otherwise mark an
    // in-flight generation failed and stop it counting toward their limits.
    const fin = (p_user: string, p_status: string, p_result: { ok?: boolean } = {}) =>
      ({ p_id: id!, p_user, p_status, p_provider: 'x', p_model: 'x', p_input_tokens: 0, p_output_tokens: 0, p_duration_ms: 0, p_error_code: 'x', p_result })
    expect((await B.client.rpc('ai_finalize', fin(B.id, 'failed'))).error).not.toBeNull()
    expect((await A.client.rpc('ai_finalize', fin(A.id, 'failed'))).error).not.toBeNull()
    expect((await adminClient().from('ai_generations').select('status').eq('id', id!).single()).data!.status).toBe('pending')
    // the server finalizes once, only for the row's owner; success rows are immutable afterwards
    await adminClient().rpc('ai_finalize', fin(B.id, 'failed'))
    expect((await adminClient().from('ai_generations').select('status').eq('id', id!).single()).data!.status).toBe('pending')
    await adminClient().rpc('ai_finalize', fin(A.id, 'success', { ok: true }))
    await adminClient().rpc('ai_finalize', fin(A.id, 'failed'))
    expect((await adminClient().from('ai_generations').select('status, result').eq('id', id!).single()).data).toEqual({ status: 'success', result: { ok: true } })
  })
  it("even the server cannot reserve against someone else's party; anon/users cannot call the RPCs", async () => {
    expect((await adminClient().rpc('ai_reserve', { p_user: A.id, p_party: partyB, p_feature: 'party_planner' })).error?.code).toBe('P0002')
    const { anonClient } = await import('./helpers/supabase')
    expect((await anonClient().rpc('ai_reserve', { p_user: A.id, p_party: partyA, p_feature: 'party_planner' })).error).not.toBeNull()
  })
  it('global breaker count is server-only and returns a number', async () => {
    expect((await A.client.rpc('ai_global_count_today')).error).not.toBeNull()
    const { data } = await adminClient().rpc('ai_global_count_today')
    expect(typeof data).toBe('number')
  })
  it('apply-target tables are owner-only', async () => {
    expect((await A.client.from('party_shopping_items').insert({ party_id: partyA, item: 'Paper plates' })).error).toBeNull()
    expect((await B.client.from('party_shopping_items').select('id').eq('party_id', partyA)).data).toEqual([])
    expect((await B.client.from('party_shopping_items').insert({ party_id: partyA, item: 'x' })).error).not.toBeNull()
    expect((await A.client.from('party_shopping_items').insert({ party_id: partyA, item: 'PAPER PLATES' })).error).not.toBeNull() // case-insensitive dedupe
  })
})

describe('daysUntil', () => {
  it('counts whole UTC days', () => {
    expect(daysUntil('2026-10-11', new Date('2026-10-03T23:00:00Z'))).toBe(8)
    expect(daysUntil(null)).toBeNull()
  })
})
