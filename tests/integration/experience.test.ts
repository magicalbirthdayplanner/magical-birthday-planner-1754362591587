/**
 * Party Experience layer (mock provider, local Supabase): activity studio, apply/sync to plan/timeline/checklist/
 * shopping/budget, host content, food, party experience, context (guest count / theme changes), entitlements, RLS.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_TIMEOUT_MS: '3000' })
const ALL = 'party_planner,theme_ideas,checklist,food,timeline,activity_studio,host_content,party_experience'
process.env.AI_ENABLED_FEATURES = ALL
const { resetAIConfig } = await import('@/lib/ai/config')
const { resetMock, mockCalls, scriptMock } = await import('@/lib/ai/providers/mock')
const { FIXTURES } = await import('@/lib/ai/fixtures')

const up = await isSupabaseUp()
let A: TestUser, B: TestUser, P: string, PB: string
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const req = (u: TestUser, path: string, body: unknown, method = 'POST') => new Request(`http://app.test/api/ai/${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.accessToken}` }, body: JSON.stringify(body) })
const call = async (path: string, body: unknown, u: TestUser = A) => (await import(`@/app/api/ai/${path}/route`)).POST(req(u, path, body)) as Promise<Response>
const apply = async (body: unknown, method: 'POST' | 'DELETE' = 'POST', u: TestUser = A) => { const m = await import('@/app/api/ai/apply/route'); return (method === 'POST' ? m.POST : m.DELETE)(req(u, 'apply', body, method)) as Promise<Response> }
const json = async (r: Promise<Response> | Response) => (await r).json()
const facts = () => JSON.parse(mockCalls().at(-1)!.messages[1].content.match(/(?:Party facts|Facts)[^:]*: (\{.*\})/)![1])
const setPlan = async (u: TestUser, plan: 'FREE' | 'STARTER' | 'PLUS' | 'PRO') => {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', u.id)
  await db.from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', u.id)
  if (plan !== 'FREE') await db.from('plan_overrides').insert({ user_id: u.id, plan, expires_at: null })
  await db.rpc('recompute_entitlement', { p_user: u.id })
}
const create = async (notes = 'A fun space game for 15 kids, 20 minutes, no mess') => json(call('activity', { partyId: P, mode: 'create', notes }))
const addActivity = async (status?: 'idea' | 'planned') => {
  const g = await create()
  const r = await json(apply({ generationId: g.generationId, itemId: 'act-1', target: 'activities', ...(status ? { edits: { status } } : {}) }))
  const row = (await A.client.from('party_ai_activities').select('*').eq('party_id', P).eq('source_generation_id', g.generationId).single()).data!
  return { g, r, row }
}

beforeAll(async () => {
  if (!up) return
  A = await createTestUser('exp-a')
  B = await createTestUser('exp-b')
  P = (await A.client.from('parties').insert({ user_id: A.id, child_name: 'Mia Johnson', child_age: 7, party_date: inDays(12), party_time: '14:00', zip_code: '48084', city: 'Troy', state: 'MI', guest_count: 15, budget: 200, interests: ['science', 'art'], venue_type: 'indoor', theme: 'ai:space', theme_details: { name: 'Space' } }).select('id').single()).data!.id
  PB = (await B.client.from('parties').insert({ user_id: B.id, child_name: 'Bo', child_age: 5, party_date: inDays(30), zip_code: '48084', guest_count: 8 }).select('id').single()).data!.id
})
afterAll(async () => {
  if (!up) return
  await adminClient().from('plan_overrides').delete().in('user_id', [A.id, B.id])
  await deleteTestUser(A)
  await deleteTestUser(B)
})
beforeEach(async () => {
  resetMock()
  process.env.AI_ENABLED_FEATURES = ALL
  resetAIConfig()
  if (!up) return
  const db = adminClient()
  await db.from('ai_generations').delete().in('user_id', [A.id, B.id])
  for (const t of ['party_timeline_items', 'party_host_content', 'party_food_items', 'party_shopping_items', 'party_budget_lines', 'checklist_items', 'party_ai_activities'] as const) await db.from(t).delete().eq('party_id', P)
  await db.from('guests').delete().eq('party_id', P)
  await db.from('parties').update({ guest_count: 15, theme: 'ai:space', theme_details: { name: 'Space' } }).eq('id', P)
  await setPlan(A, 'PRO')
})

describe.skipIf(!up)('activity studio', () => {
  it('creates a structured activity from party context (no repeated questions, no child name)', async () => {
    const g = await create()
    expect(g.result).toMatchObject({ mode: 'create', targetActivityId: null, designedForGuests: 15, designedForTheme: 'Space' })
    expect(g.result.activity).toMatchObject({ id: 'act-1', name: 'Cosmic Treasure Hunt', category: 'treasure_hunt', duration_minutes: 25, indoor_outdoor: 'indoor', age_min: 6, age_max: 8 })
    expect(facts()).toMatchObject({ childAge: 7, guestCountEstimate: 15, budget: 200, theme: 'Space', indoorOutdoor: 'indoor', partyStartTime: '14:00' })
    expect(JSON.stringify(mockCalls()[0].messages)).not.toMatch(/Mia|Johnson|48084/)
  })
  it('Add to party: planned + approved, provenance kept; a replay is a no-op; saving as idea works', async () => {
    const { g, r, row } = await addActivity()
    expect(r.status).toBe('applied')
    expect(row).toMatchObject({ status: 'planned', origin: 'ai', user_edited: false, designed_for_guests: 15, designed_for_theme: 'Space', duration_min: 25, setting: 'indoor', category: 'treasure_hunt' })
    expect(row.approved_at).not.toBeNull()
    expect((row.details as { host_script: string }).host_script).toMatch(/astronauts/)
    expect((await json(apply({ generationId: g.generationId, itemId: 'act-1', target: 'activities' }))).status).toBe('already')
    const g2 = await create()
    expect((await json(apply({ generationId: g2.generationId, itemId: 'act-1', target: 'activities' }))).status).toBe('duplicate')
    expect((await A.client.from('party_ai_activities').select('id').eq('party_id', P)).data).toHaveLength(1)
  })
  it('“Make it cheaper”: revises THAT activity (server-set target), replaces content on explicit apply, undo restores', async () => {
    const { row } = await addActivity()
    await A.client.from('party_ai_activities').update({ name: 'Galaxy Rescue Mission', user_edited: true }).eq('id', row.id)
    scriptMock(JSON.stringify({ ...(FIXTURES.activity_studio as object), activity: { ...(FIXTURES.activity_studio as { activity: object }).activity, name: 'Galaxy Rescue Mission', estimated_cost: 3, materials: ['Paper planets × 8'] }, what_changed: 'Uses paper instead of glow sticks.' }))
    const g = await json(call('activity', { partyId: P, mode: 'edit', activityId: row.id, edit: 'cheaper' }))
    expect(g.result).toMatchObject({ mode: 'edit', targetActivityId: row.id, whatChanged: 'Uses paper instead of glow sticks.' })
    expect(mockCalls().at(-1)!.messages[1].content).toMatch(/Make it cheaper/)
    expect(mockCalls().at(-1)!.messages[1].content).toMatch(/Galaxy Rescue Mission/) // the parent's version is what gets revised
    // nothing changed yet
    expect((await A.client.from('party_ai_activities').select('estimated_cost').eq('id', row.id).single()).data!.estimated_cost).toBe(12)
    expect((await json(apply({ generationId: g.generationId, itemId: 'act-1', target: 'activity_update' }))).status).toBe('applied')
    const after = (await A.client.from('party_ai_activities').select('id, name, estimated_cost, status, user_edited').eq('id', row.id).single()).data!
    expect(after).toEqual({ id: row.id, name: 'Galaxy Rescue Mission', estimated_cost: 3, status: 'planned', user_edited: false })
    await apply({ generationId: g.generationId, itemId: 'act-1', target: 'activity_update' }, 'DELETE')
    expect((await A.client.from('party_ai_activities').select('estimated_cost, user_edited').eq('id', row.id).single()).data).toEqual({ estimated_cost: 12, user_edited: true })
  })
  it('edit requests are validated: foreign/missing activity → 404 and nothing counted; no client-set target', async () => {
    const foreign = (await B.client.from('party_ai_activities').insert({ party_id: PB, user_id: B.id, name: 'B game', status: 'planned', origin: 'user' }).select('id').single()).data!.id
    expect((await call('activity', { partyId: P, mode: 'edit', activityId: foreign, edit: 'cheaper' })).status).toBe(404)
    expect((await call('activity', { partyId: P, mode: 'edit', activityId: foreign })).status).toBe(400) // no change requested
    expect((await call('activity', { partyId: P, mode: 'create', targetActivityId: foreign })).status).toBe(400)
    expect((await call('activity', { partyId: PB, mode: 'create' })).status).toBe(404)
    expect((await adminClient().from('ai_generations').select('id').eq('user_id', A.id)).data).toHaveLength(0)
    await adminClient().from('party_ai_activities').delete().eq('id', foreign)
  })
  it('theme change: new ideas use the new theme; the approved activity is never silently rewritten', async () => {
    const { row } = await addActivity()
    await A.client.from('parties').update({ theme: 'ai:dino', theme_details: { name: 'Dinosaur Dig' } }).eq('id', P)
    await create('another game')
    expect(facts().theme).toBe('Dinosaur Dig')
    expect((await A.client.from('party_ai_activities').select('name, designed_for_theme, description').eq('id', row.id).single()).data).toEqual({ name: row.name, designed_for_theme: 'Space', description: row.description })
    // explicit "Update this for my new theme"
    await call('activity', { partyId: P, mode: 'edit', activityId: row.id, edit: 'theme' })
    expect(mockCalls().at(-1)!.messages[1].content).toMatch(/The theme is now "Dinosaur Dig"/)
  })
})

describe.skipIf(!up)('activity → plan synchronisation', () => {
  it('prep tasks, supplies, cost and timeline link to the activity; removal cleans up only what is safe', async () => {
    const { row } = await addActivity()
    const db = A.client
    await db.from('checklist_items').insert([
      { party_id: P, user_id: A.id, task_key: `act-${row.id}-1`, title: 'Print the 8 clue cards', source_activity_id: row.id, is_custom: true },
      { party_id: P, user_id: A.id, task_key: `act-${row.id}-2`, title: 'Hide the planets', source_activity_id: row.id, is_custom: true, completed_at: new Date().toISOString() },
    ])
    await db.from('party_shopping_items').insert({ party_id: P, user_id: A.id, item: 'Glow sticks', qty: '15', source_activity_id: row.id })
    await db.from('party_budget_lines').insert([{ party_id: P, user_id: A.id, category: 'Activities', label: row.name, amount: 12, source_activity_id: row.id }, { party_id: P, user_id: A.id, category: 'Activities', label: 'Bought already', amount: 5, actual_amount: 4.5, source_activity_id: row.id }])
    await db.from('party_timeline_items').insert({ party_id: P, user_id: A.id, kind: 'activity', label: row.name, activity_id: row.id, sort_order: 1 })
    // one timeline row per activity
    expect((await db.from('party_timeline_items').insert({ party_id: P, user_id: A.id, kind: 'activity', label: 'again', activity_id: row.id, sort_order: 2 })).error?.code).toBe('23505')
    const { data: res, error } = await db.rpc('remove_party_activity', { p_activity: row.id })
    expect(error).toBeNull()
    expect(res).toEqual({ tasks_removed: 1, budget_lines_removed: 1 })
    expect((await db.from('checklist_items').select('title, source_activity_id').eq('party_id', P).like('task_key', 'act-%')).data).toEqual([{ title: 'Hide the planets', source_activity_id: null }])
    expect((await db.from('party_shopping_items').select('item, source_activity_id').eq('party_id', P)).data).toEqual([{ item: 'Glow sticks', source_activity_id: null }])
    expect((await db.from('party_budget_lines').select('label, actual_amount').eq('party_id', P)).data).toEqual([{ label: 'Bought already', actual_amount: 4.5 }])
    expect((await db.from('party_timeline_items').select('id').eq('party_id', P)).data).toEqual([])
  })
  it('timeline from the timeline feature links steps to the party’s activities (duration follows the activity)', async () => {
    const { row } = await addActivity()
    scriptMock(JSON.stringify({ entries: [{ minute: 0, label: 'Guests arrive' }, { minute: 15, label: 'Cosmic Treasure Hunt' }, { minute: 40, label: 'Pizza and juice' }, { minute: 70, label: 'Cake and candles' }], prepTasks: [], assumptions: [] }))
    const g = await json(call('timeline', { partyId: P }))
    expect(g.result.entries.map((e: { kind: string; duration: number }) => [e.kind, e.duration])).toEqual([['arrival', 15], ['activity', 25], ['food', 30], ['cake', 50]])
    const r = await json(apply({ generationId: g.generationId, target: 'timeline', itemIds: g.result.entries.map((e: { id: string }) => e.id) }))
    expect(r).toMatchObject({ added: 4, skipped: 0 })
    const rows = (await A.client.from('party_timeline_items').select('label, kind, activity_id, duration_min, sort_order').eq('party_id', P).order('sort_order')).data!
    expect(rows[1]).toMatchObject({ kind: 'activity', activity_id: row.id, duration_min: null })
    expect(rows.map((x) => x.sort_order)).toEqual([1, 2, 3, 4])
    expect((await json(apply({ generationId: g.generationId, target: 'timeline', itemIds: g.result.entries.map((e: { id: string }) => e.id) }))).skipped).toBe(4)
    // the next AI call sees the timeline with the activity's own length
    await create('x')
    expect(facts().timeline).toEqual([{ label: 'Guests arrive', min: 15 }, { label: 'Cosmic Treasure Hunt', min: 25 }, { label: 'Pizza and juice', min: 30 }, { label: 'Cake and candles', min: 50 }])
  })
})

describe.skipIf(!up)('guests, food, host content', () => {
  it('15 → 20 guests: AI context follows; RSVP aggregates only (no names); food quantities are for the new headcount', async () => {
    await create()
    expect(facts().guestCountEstimate).toBe(15)
    await A.client.from('parties').update({ guest_count: 20 }).eq('id', P)
    await A.client.from('guests').insert([
      { party_id: P, user_id: A.id, name: 'Emma Stone', email: 'emma@example.test', rsvp_status: 'CONFIRMED', child_count: 1, adult_count: 1, dietary_restrictions: ['Vegetarian'] },
      { party_id: P, user_id: A.id, name: 'Leo Park', rsvp_status: 'PENDING', child_count: 1, adult_count: 0 },
    ])
    const f = await json(call('food', { partyId: P }))
    const ctx = facts()
    expect(ctx).toMatchObject({ guestCountEstimate: 20, rsvp: { kids: 1, adults: 1, awaiting: 1, dietary: ['vegetarian'] } })
    expect(mockCalls().at(-1)!.messages[1].content).toMatch(/about 20 guests/)
    expect(JSON.stringify(mockCalls().at(-1)!.messages)).not.toMatch(/Emma|Leo|example\.test/)
    expect(f.result.guests).toBe(20)
    // menu → party_food_items; budget estimate line; actual spend untouched
    expect((await json(apply({ generationId: f.generationId, target: 'food', itemIds: f.result.items.map((d: { id: string }) => d.id) }))).added).toBe(5)
    expect((await json(apply({ generationId: f.generationId, itemId: 'fbud-1', target: 'budget' }))).status).toBe('applied')
    expect((await A.client.from('party_food_items').select('name, quantity, designed_for_guests').eq('party_id', P).eq('name', 'Mini cheese pizzas').single()).data).toEqual({ name: 'Mini cheese pizzas', quantity: 30, designed_for_guests: 20 })
    expect((await A.client.from('party_budget_lines').select('category, amount, actual_amount').eq('party_id', P)).data).toEqual([{ category: 'Food & drinks', amount: 83.5, actual_amount: null }])
    await create('x')
    expect(facts().menu).toContain('30 mini pizzas Mini cheese pizzas')
  })
  it('welcome speech: generated with the child’s first name, saved (edited) to the party; thank-yous per confirmed guest by first name', async () => {
    await setPlan(A, 'STARTER')
    const w = await json(call('host', { partyId: P, kind: 'welcome' }))
    expect(w.result.items[0]).toMatchObject({ id: 'host-1', kind: 'welcome', title: 'Welcome, astronauts!' })
    expect(mockCalls().at(-1)!.messages[1].content).toMatch(/"firstName":"Mia"/)
    expect(mockCalls().at(-1)!.messages[1].content).not.toMatch(/Johnson/)
    expect((await json(apply({ generationId: w.generationId, itemId: 'host-1', target: 'host', edits: { body: 'Welcome, space cadets!' } }))).status).toBe('applied')
    expect((await A.client.from('party_host_content').select('kind, body, user_edited, origin').eq('party_id', P).single()).data).toEqual({ kind: 'welcome', body: 'Welcome, space cadets!', user_edited: true, origin: 'ai' })
    const [{ data: emma }] = await Promise.all([A.client.from('guests').insert({ party_id: P, user_id: A.id, name: 'Emma Stone', email: 'emma@example.test', phone: '555-0100', rsvp_status: 'CONFIRMED', child_count: 1, adult_count: 1 }).select('id').single()])
    await A.client.from('guests').insert({ party_id: P, user_id: A.id, name: 'Zed Declined', rsvp_status: 'DECLINED', child_count: 1, adult_count: 0 })
    const t = await json(call('host', { partyId: P, kind: 'thank_you_guest' }))
    const prompt = mockCalls().at(-1)!.messages[1].content
    expect(prompt).toMatch(/"name":"Emma"/)
    expect(prompt).not.toMatch(/Stone|Zed|example\.test|555-0100/)
    expect(t.result.items).toEqual([expect.objectContaining({ kind: 'thank_you_guest', guestId: emma!.id, guestName: 'Emma' })])
    expect((await json(apply({ generationId: t.generationId, itemId: 'host-1', target: 'host' }))).status).toBe('applied')
    expect((await call('host', { partyId: P, kind: 'activity_intro' })).status).toBe(400) // needs an activity
  })
})

describe.skipIf(!up)('create my party experience', () => {
  it('returns separate sections; each applies on its own; nothing changes until applied', async () => {
    const g = await json(call('party-experience', { partyId: P, notes: 'She loves space and painting, not a typical space party, nothing too messy.' }))
    const r = g.result
    expect(Object.keys(r).sort()).toEqual(['activities', 'assumptions', 'budget', 'checklist', 'designedForGuests', 'food', 'host', 'shopping', 'summary', 'theme', 'timeline'].sort())
    expect(r.timeline.map((t: { duration: number }) => t.duration)).toEqual([15, 5, 25, 25, 25, 15, 10])
    expect(r.budget).toMatchObject({ total: 140, overBy: null })
    expect((await A.client.from('party_ai_activities').select('id').eq('party_id', P)).data).toEqual([])
    expect((await A.client.from('parties').select('theme').eq('id', P).single()).data!.theme).toBe('ai:space')
    // apply: theme, all activities, then the timeline links to them
    expect((await json(apply({ generationId: g.generationId, itemId: 'theme', target: 'theme' }))).status).toBe('applied')
    expect((await json(apply({ generationId: g.generationId, target: 'activities', itemIds: r.activities.map((a: { id: string }) => a.id) }))).added).toBe(3)
    expect((await json(apply({ generationId: g.generationId, target: 'timeline', itemIds: r.timeline.map((a: { id: string }) => a.id) }))).added).toBe(7)
    expect((await json(apply({ generationId: g.generationId, target: 'host', itemIds: r.host.map((a: { id: string }) => a.id) }))).added).toBe(3)
    expect((await json(apply({ generationId: g.generationId, target: 'checklist', itemIds: r.checklist.map((a: { id: string }) => a.id) }))).added).toBe(2)
    const tl = (await A.client.from('party_timeline_items').select('label, activity_id').eq('party_id', P).order('sort_order')).data!
    expect(tl.filter((x) => x.activity_id).map((x) => x.label)).toEqual(['Design Your Own Planet', 'Cosmic Treasure Hunt'])
    expect((await A.client.from('parties').select('theme_details').eq('id', P).single()).data!.theme_details).toMatchObject({ name: 'Cosmic Art Adventure' })
  })
})

describe.skipIf(!up)('entitlements, flags, isolation', () => {
  it('plans: Free gets none of the new features; Starter gets host content; Plus gets activities + experience', async () => {
    await setPlan(A, 'FREE')
    for (const [path, body, up] of [['activity', { partyId: P }, 'PLUS'], ['host', { partyId: P, kind: 'welcome' }, 'STARTER'], ['party-experience', { partyId: P }, 'PLUS']] as const) {
      const r = await call(path, body)
      expect(r.status).toBe(403)
      expect((await r.json()).error.upgradeTo).toBe(up)
    }
    await setPlan(A, 'STARTER')
    expect((await call('host', { partyId: P, kind: 'cake' })).status).toBe(200)
    expect((await call('activity', { partyId: P })).status).toBe(403)
    await setPlan(A, 'PLUS')
    expect((await call('activity', { partyId: P })).status).toBe(200)
    expect((await call('party-experience', { partyId: P })).status).toBe(200)
  })
  it('flags: a feature not in AI_ENABLED_FEATURES is off', async () => {
    process.env.AI_ENABLED_FEATURES = 'party_planner,theme_ideas,checklist'
    resetAIConfig()
    for (const [path, body] of [['activity', { partyId: P }], ['host', { partyId: P, kind: 'welcome' }], ['party-experience', { partyId: P }]] as const) expect((await call(path, body)).status).toBe(503)
  })
  it('RLS: another user cannot read, insert, link, remove or apply into this party’s experience data', async () => {
    const { g, row } = await addActivity()
    await A.client.from('party_timeline_items').insert({ party_id: P, user_id: A.id, kind: 'welcome', label: 'Welcome', sort_order: 1 })
    await A.client.from('party_host_content').insert({ party_id: P, user_id: A.id, kind: 'welcome', body: 'Hi!' })
    await A.client.from('party_food_items').insert({ party_id: P, user_id: A.id, name: 'Pizza' })
    for (const t of ['party_ai_activities', 'party_timeline_items', 'party_host_content', 'party_food_items'] as const) expect((await B.client.from(t).select('id').eq('party_id', P)).data).toEqual([])
    expect((await B.client.from('party_timeline_items').insert({ party_id: P, user_id: B.id, kind: 'other', label: 'x', sort_order: 9 })).error).not.toBeNull()
    expect((await B.client.from('party_ai_activities').insert({ party_id: P, user_id: B.id, name: 'x' })).error).not.toBeNull()
    // B links A's activity into B's own party → rejected by the same-party rule
    expect((await B.client.from('party_timeline_items').insert({ party_id: PB, user_id: B.id, kind: 'activity', label: 'steal', activity_id: row.id, sort_order: 1 })).error).not.toBeNull()
    expect((await B.client.from('party_shopping_items').insert({ party_id: PB, user_id: B.id, item: 'x', source_activity_id: row.id })).error).not.toBeNull()
    expect((await B.client.rpc('remove_party_activity', { p_activity: row.id })).error).not.toBeNull()
    const { data: guestA } = await A.client.from('guests').insert({ party_id: P, user_id: A.id, name: 'Emma Stone', rsvp_status: 'CONFIRMED', child_count: 1, adult_count: 0 }).select('id').single()
    expect((await B.client.from('party_host_content').insert({ party_id: PB, user_id: B.id, kind: 'thank_you_guest', body: 'x', guest_id: guestA!.id })).error).not.toBeNull()
    expect((await B.client.from('party_host_content').insert({ party_id: PB, user_id: B.id, kind: 'activity_intro', body: 'x', activity_id: row.id })).error).not.toBeNull()
    await B.client.from('party_ai_activities').update({ name: 'hacked' }).eq('id', row.id)
    await B.client.from('party_ai_activities').delete().eq('id', row.id)
    expect((await A.client.from('party_ai_activities').select('name').eq('id', row.id).single()).data!.name).toBe(row.name)
    expect((await apply({ generationId: g.generationId, itemId: 'act-1', target: 'activities' }, 'POST', B)).status).toBe(404)
    // budget actuals are never written by AI applies (only planned amounts)
    await A.client.from('party_budget_lines').insert({ party_id: P, user_id: A.id, category: 'Food & drinks', amount: 50, actual_amount: 61 })
    const f = await json(call('food', { partyId: P }))
    await apply({ generationId: f.generationId, itemId: 'fbud-1', target: 'budget' })
    expect((await A.client.from('party_budget_lines').select('amount, actual_amount').eq('party_id', P).single()).data).toEqual({ amount: 83.5, actual_amount: 61 })
  })
})
