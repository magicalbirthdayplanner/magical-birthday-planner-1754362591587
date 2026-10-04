/**
 * AI usage-accounting security (migration 20251004001200). Reproduces the original attacks against local Supabase
 * with the browser's own credentials (anon key + user session) and the real AI route (mock provider — no model
 * calls), and proves they no longer work:
 *   A  direct POST /rest/v1/rpc/ai_reserve           B  global denial of service via 50+ direct reservations
 *   C  delete a party to get usage back               D  delete the account to shrink the global count
 *   E  party hopping                                  F  account cycling
 * plus concurrency (per-party, per-user, global), forged ids, foreign/deleted parties, no auth, privacy of
 * detached rows, and the Sentry telemetry for limits / rejected reservations.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

vi.mock('@sentry/nextjs', async () => (await import('../helpers/sentry-mock')).sentryMock)

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_ENABLED_FEATURES: 'party_planner,theme_ideas,checklist',
  AI_USER_DAILY_LIMIT: '10', // production value
})
const { sentry } = await import('../helpers/sentry-mock')
const { resetAIConfig } = await import('@/lib/ai/config')
const { resetMock } = await import('@/lib/ai/providers/mock')
const { reserveGeneration } = await import('@/lib/ai/usage')
const planner = await import('@/app/api/ai/party-planner/route')

const up = await isSupabaseUp()
const users: TestUser[] = []
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const newUser = async (label: string) => {
  const u = await createTestUser(label)
  users.push(u)
  return u
}
const newParty = async (u: TestUser) =>
  (await u.client.from('parties').insert({ user_id: u.id, child_name: 'Ava Example', child_age: 7, party_date: inDays(20), zip_code: '48084', guest_count: 10, budget: 250 }).select('id').single()).data!.id as string
const setPlan = async (u: TestUser, plan: 'STARTER' | 'PLUS' | 'PRO' | null) => {
  const db = adminClient()
  await db.from('plan_overrides').delete().eq('user_id', u.id)
  await db.from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', u.id)
  if (plan) await db.from('plan_overrides').insert({ user_id: u.id, plan, expires_at: null })
  await db.rpc('recompute_entitlement', { p_user: u.id })
}
const ask = (token: string | null, partyId: string, extra: Record<string, unknown> = {}) =>
  planner.POST(new Request('http://app.test/api/ai/party-planner', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ partyId, ...extra }) }))
const globalCount = async () => (await adminClient().rpc('ai_global_count_today')).data as number
const rowsOf = async (u: TestUser) => (await adminClient().from('ai_generations').select('id, status').eq('user_id', u.id)).data!
const counted = (rows: { status: string }[]) => rows.filter((r) => ['pending', 'success', 'failed'].includes(r.status)).length
/** Exactly what a browser can do: the public anon key + the user's own access token, straight at PostgREST. */
const restRpc = (fn: string, body: unknown, token?: string) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token ?? ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

beforeAll(async () => {
  if (!up) return
})
afterAll(async () => {
  if (!up) return
  for (const u of users) {
    await adminClient().from('plan_overrides').delete().eq('user_id', u.id)
    await deleteTestUser(u)
  }
  delete process.env.AI_GLOBAL_DAILY_LIMIT
  delete process.env.AI_USER_DAILY_LIMIT
})
beforeEach(() => {
  resetMock()
  delete process.env.AI_GLOBAL_DAILY_LIMIT
  resetAIConfig()
  sentry.reset()
})

describe.skipIf(!up)('Attack A — direct ai_reserve with browser credentials', () => {
  it('every signature and identity is refused (HTTP 401/403/404) and no row is created', async () => {
    const U = await newUser('aisec-a')
    const V = await newUser('aisec-a2')
    const party = await newParty(U)
    const before = await globalCount()
    const attempts = [
      { p_user: U.id, p_party: party, p_feature: 'party_planner' }, // own id
      { p_user: V.id, p_party: party, p_feature: 'party_planner' }, // forged id
      { p_user: U.id, p_party: party, p_feature: 'party_planner', p_input_summary: {}, p_global_limit: 0 }, // full signature, no breaker
      { p_party: party, p_feature: 'party_planner', p_input_summary: {} }, // the old (pre-1200) signature
    ]
    for (const body of attempts) {
      for (const token of [U.accessToken, undefined]) {
        const res = await restRpc('ai_reserve', body, token)
        expect([401, 403, 404], JSON.stringify(body)).toContain(res.status)
      }
      expect((await U.client.rpc('ai_reserve' as never, body as never)).error).not.toBeNull()
    }
    expect(await rowsOf(U)).toEqual([])
    expect(await globalCount()).toBe(before)
    // the breaker count itself is no longer readable by users either
    expect([401, 403, 404]).toContain((await restRpc('ai_global_count_today', {}, U.accessToken)).status)
  })
})

describe.skipIf(!up)('Attack B — global denial of service', () => {
  it('60 direct reservations fail, the global count does not move, and AI stays available', async () => {
    const U = await newUser('aisec-b')
    const victim = await newUser('aisec-b-victim')
    const party = await newParty(U)
    const victimParty = await newParty(victim)
    await setPlan(victim, 'STARTER')
    const before = await globalCount()
    process.env.AI_GLOBAL_DAILY_LIMIT = String(before + 5)
    resetAIConfig()
    // half with today's signature, half with the original (pre-1200) one that used to work
    const results = await Promise.all(Array.from({ length: 60 }, (_, i) =>
      restRpc('ai_reserve', i % 2 ? { p_user: U.id, p_party: party, p_feature: 'party_planner' } : { p_party: party, p_feature: 'party_planner' }, U.accessToken)))
    expect(results.every((r) => [401, 403, 404].includes(r.status))).toBe(true)
    expect(await globalCount()).toBe(before)
    expect((await ask(victim.accessToken, victimParty)).status).toBe(200)
  })
})

describe.skipIf(!up)('Attack C/E — party deletion and party hopping', () => {
  it('C: deleting a party never reduces usage; earlier usage still counts on the next party', async () => {
    const U = await newUser('aisec-c')
    await setPlan(U, 'STARTER') // Starter: 10 per party
    const p1 = await newParty(U)
    for (let i = 0; i < 10; i++) expect((await ask(U.accessToken, p1)).status).toBe(200)
    expect((await ask(U.accessToken, p1)).status).toBe(429) // per-party cap
    const userCountBefore = counted(await rowsOf(U))
    const globalBefore = await globalCount()
    expect(userCountBefore).toBe(10)

    expect((await U.client.from('parties').delete().eq('id', p1)).error).toBeNull()
    expect(counted(await rowsOf(U))).toBe(userCountBefore) // usage survived
    expect(await globalCount()).toBe(globalBefore)
    const detached = (await adminClient().from('ai_generations').select('party_id, user_id, result, input_summary, applied, feature, status, model, input_tokens').eq('user_id', U.id)).data!
    expect(detached.every((r) => r.party_id === null && r.result === null && JSON.stringify(r.input_summary) === '{}' && JSON.stringify(r.applied) === '[]')).toBe(true)
    expect(detached).toHaveLength(11) // 10 successes + the rejected 11th attempt
    expect(detached.every((r) => r.user_id === U.id && r.feature === 'party_planner')).toBe(true) // accounting kept
    expect(detached.filter((r) => r.status === 'success').every((r) => r.model && r.input_tokens != null)).toBe(true)
    // the owner can no longer see the content (nothing left to apply)
    expect(JSON.stringify((await U.client.from('ai_generations').select('result').eq('user_id', U.id)).data)).not.toContain('Ava')
  })

  it('E: cycling parties A→B→C (Starter) cannot exceed the hourly cap of 10 — and a deleted party id is refused', async () => {
    const U = await newUser('aisec-e')
    await setPlan(U, 'STARTER')
    const statuses: number[] = []
    let lastDeleted = ''
    for (let round = 0; round < 4; round++) {
      const p = await newParty(U)
      for (let i = 0; i < 3; i++) statuses.push((await ask(U.accessToken, p)).status)
      await U.client.from('parties').delete().eq('id', p)
      lastDeleted = p
    }
    // 12 attempts across 4 deleted parties: only 10 may ever succeed (hourly cap), whatever was deleted
    expect(statuses.filter((s) => s === 200)).toHaveLength(10)
    expect(statuses.slice(10)).toEqual([429, 429])
    expect(counted(await rowsOf(U))).toBe(10)
    const p5 = await newParty(U)
    expect((await ask(U.accessToken, p5)).status).toBe(429)
    // a deleted party id → 404, nothing reserved
    const n = (await rowsOf(U)).length
    expect((await ask(U.accessToken, lastDeleted)).status).toBe(404)
    expect((await rowsOf(U)).length).toBe(n)
  })
})

describe.skipIf(!up)('Attack D/F — account deletion and account cycling', () => {
  it('D: deleting the account never reduces the global count, and no personal content survives', async () => {
    const X = await newUser('aisec-d')
    await setPlan(X, 'STARTER')
    const px = await newParty(X)
    expect((await ask(X.accessToken, px, { notes: 'Ava loves unicorns; call me at 248-555-0199' })).status).toBe(200)
    expect((await ask(X.accessToken, px)).status).toBe(200)
    const ids = (await rowsOf(X)).map((r) => r.id)
    const before = await globalCount()
    await deleteTestUser(X)
    users.splice(users.indexOf(X), 1)
    expect(await globalCount()).toBe(before)
    const rows = (await adminClient().from('ai_generations').select('*').in('id', ids)).data!
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r).toMatchObject({ user_id: null, party_id: null, result: null, input_summary: {}, applied: [], feature: 'party_planner', status: 'success' })
      expect(r.created_at).toBeTruthy()
    }
    expect(JSON.stringify(rows)).not.toMatch(/Ava|unicorn|555-0199|@example\.test/)
  })

  it('F: a new account after deleting the old one still faces the same global breaker', async () => {
    const X = await newUser('aisec-f1')
    await setPlan(X, 'STARTER')
    const px = await newParty(X)
    const base = await globalCount()
    process.env.AI_GLOBAL_DAILY_LIMIT = String(base + 2)
    resetAIConfig()
    expect((await ask(X.accessToken, px)).status).toBe(200)
    expect((await ask(X.accessToken, px)).status).toBe(200)
    await deleteTestUser(X)
    users.splice(users.indexOf(X), 1)
    const Y = await newUser('aisec-f2')
    await setPlan(Y, 'STARTER')
    const py = await newParty(Y)
    const r = await ask(Y.accessToken, py)
    expect(r.status).toBe(503)
    expect((await r.json()).error.code).toBe('high_demand')
  })
})

describe.skipIf(!up)('Concurrency', () => {
  it('two simultaneous legitimate requests both succeed and both are counted', async () => {
    const U = await newUser('aisec-c2')
    await setPlan(U, 'PLUS')
    const p = await newParty(U)
    const res = await Promise.all([ask(U.accessToken, p), ask(U.accessToken, p)])
    expect(res.map((r) => r.status)).toEqual([200, 200])
    expect(counted(await rowsOf(U))).toBe(2)
  })

  it('per-party: 14 simultaneous requests on a Starter party → exactly 10 succeed', async () => {
    const U = await newUser('aisec-cp')
    await setPlan(U, 'STARTER')
    const p = await newParty(U)
    const res = await Promise.all(Array.from({ length: 14 }, () => ask(U.accessToken, p)))
    expect(res.filter((r) => r.status === 200)).toHaveLength(10)
    expect(res.filter((r) => r.status === 429)).toHaveLength(4)
  })

  it('per-user: 16 simultaneous requests (Pro, 2 parties) → exactly 10 succeed (hourly cap)', async () => {
    const U = await newUser('aisec-cu')
    await setPlan(U, 'PRO')
    const [p1, p2] = [await newParty(U), await newParty(U)]
    const res = await Promise.all(Array.from({ length: 16 }, (_, i) => ask(U.accessToken, i % 2 ? p1 : p2)))
    expect(res.filter((r) => r.status === 200)).toHaveLength(10)
    expect(counted(await rowsOf(U))).toBe(10)
  })

  it('global: 4 users × 5 simultaneous requests against a breaker with 7 slots left → exactly 7 succeed', async () => {
    const team = await Promise.all([1, 2, 3, 4].map((i) => newUser(`aisec-cg${i}`)))
    for (const u of team) await setPlan(u, 'PRO')
    const parties = await Promise.all(team.map((u) => newParty(u)))
    const base = await globalCount()
    process.env.AI_GLOBAL_DAILY_LIMIT = String(base + 7)
    resetAIConfig()
    const res = await Promise.all(team.flatMap((u, i) => Array.from({ length: 5 }, () => ask(u.accessToken, parties[i]))))
    expect(res.filter((r) => r.status === 200)).toHaveLength(7)
    expect(res.filter((r) => r.status === 503)).toHaveLength(13)
    expect(await globalCount()).toBe(base + 7)
    // the breaker is an availability signal in Sentry
    expect(sentry.names()).toContain('ai.limit.global')
    expect(sentry.captured.some((c) => c.fingerprint?.[0] === 'ai-global-limit' && c.level === 'warning')).toBe(true)
  })
})

describe.skipIf(!up)('Authorization through the route', () => {
  it('no auth → 401; another user’s party → 404; a forged userId in the body is rejected; nothing is reserved', async () => {
    const U = await newUser('aisec-z1')
    const V = await newUser('aisec-z2')
    const pv = await newParty(V)
    const pu = await newParty(U)
    expect((await ask(null, pu)).status).toBe(401)
    expect((await ask(U.accessToken, pv)).status).toBe(404)
    expect((await ask(U.accessToken, pu, { userId: V.id })).status).toBe(400) // strict body
    expect(await rowsOf(U)).toEqual([])
    expect(await rowsOf(V)).toEqual([])
  })

  it('the server-only reservation re-checks ownership and reports a rejected reservation to Sentry', async () => {
    const U = await newUser('aisec-z3')
    const V = await newUser('aisec-z4')
    const pv = await newParty(V)
    expect(await reserveGeneration(U.id, pv, 'party_planner', {}, 0)).toEqual({ error: 'not_found' })
    expect(await rowsOf(U)).toEqual([])
    expect(sentry.names()).toContain('ai.reserve.unauthorized')
    expect(sentry.captured[0]).toMatchObject({ level: 'warning', fingerprint: ['ai-reserve-unauthorized', 'party_not_owned'] })
    expect(sentry.dump()).not.toContain(pv)
  })

  it('limit telemetry: party and user limits are counted (no issue), the global limit raises one', async () => {
    const U = await newUser('aisec-t')
    await setPlan(U, 'STARTER')
    const p = await newParty(U)
    for (let i = 0; i < 11; i++) await ask(U.accessToken, p)
    expect(sentry.names()).toContain('ai.limit.party')
    expect(sentry.captured.filter((c) => c.fingerprint?.[0] === 'ai-global-limit')).toHaveLength(0)
  })
})

// Every AI feature the product model sells (lib/entitlements.ts) works end-to-end on the reservation path:
// auth, party context, entitlement at exactly its plan, counting, persistence, reopening, failures, isolation.
type PaidPlan = 'STARTER' | 'PLUS' | 'PRO'
const BELOW: Record<PaidPlan, 'STARTER' | 'PLUS' | null> = { STARTER: null, PLUS: 'STARTER', PRO: 'PLUS' }
describe.skipIf(!up)('Sold features regression (every advertised AI feature, at its plan)', () => {
  const FEATURES: [string, string, Record<string, unknown>, PaidPlan][] = [
    ['party_planner', 'party-planner', {}, 'STARTER'],
    ['theme_ideas', 'theme-ideas', {}, 'STARTER'],
    ['checklist', 'checklist', {}, 'STARTER'],
    ['activity_studio', 'activity', { mode: 'create', notes: 'A calm craft for 10 kids' }, 'STARTER'],
    ['food', 'food', {}, 'PLUS'],
    ['budget_optimizer', 'budget', {}, 'PLUS'],
    ['invitation', 'invitation', { tone: 'simple' }, 'PLUS'],
    ['timeline', 'timeline', {}, 'PLUS'],
    ['shopping_list', 'shopping-list', {}, 'PLUS'],
    ['host_content', 'host', { kind: 'welcome' }, 'PRO'],
    ['party_experience', 'party-experience', {}, 'PRO'],
  ]
  const callFeature = async (path: string, token: string, body: Record<string, unknown>) =>
    (await import(`@/app/api/ai/${path}/route`)).POST(new Request(`http://app.test/api/ai/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })) as Promise<Response>

  beforeEach(() => {
    process.env.AI_ENABLED_FEATURES = FEATURES.map((f) => f[0]).join(',')
    resetAIConfig()
  })

  for (const [feature, path, extra, minPlan] of FEATURES) {
    it(`${feature}: gated at ${minPlan}, counted once, persisted, private, reopenable for free, failures counted`, async () => {
      const U = await newUser(`aisec-f-${path}`)
      const V = await newUser(`aisec-g-${path}`)
      const p = await newParty(U)
      // the sign-up trial (fresh account) and the plan just below are both refused before any reservation
      for (const below of ['trial', BELOW[minPlan]] as const) {
        if (below !== 'trial') await setPlan(U, below)
        const denied = await callFeature(path, U.accessToken, { partyId: p, ...extra })
        expect(denied.status).toBe(403)
        expect((await denied.json()).error).toMatchObject({ code: 'forbidden_plan', upgradeTo: minPlan })
        expect(await rowsOf(U)).toEqual([])
      }
      await setPlan(U, minPlan)
      const ok = await callFeature(path, U.accessToken, { partyId: p, ...extra })
      expect(ok.status).toBe(200)
      const { generationId } = await ok.json()
      const rows = (await adminClient().from('ai_generations').select('id, feature, status, result, party_id').eq('user_id', U.id)).data!
      expect(rows).toEqual([expect.objectContaining({ id: generationId, feature, status: 'success', party_id: p })])
      expect(rows[0].result).not.toBeNull()
      // reopening = reading the stored result; it costs nothing
      expect((await U.client.from('ai_generations').select('result').eq('id', generationId).single()).data!.result).not.toBeNull()
      expect(counted(await rowsOf(U))).toBe(1)
      // other users can't read it or use it with their own token
      expect((await V.client.from('ai_generations').select('id').eq('id', generationId)).data).toEqual([])
      expect((await callFeature(path, V.accessToken, { partyId: p, ...extra })).status).toBe(404)
      // a provider failure is recorded as failed and still counts toward the user's caps
      const { scriptMock } = await import('@/lib/ai/providers/mock')
      const { ProviderError } = await import('@/lib/ai/provider')
      scriptMock(new ProviderError('unavailable', '503', 503))
      expect((await callFeature(path, U.accessToken, { partyId: p, ...extra })).status).toBe(502)
      const after = await rowsOf(U)
      expect(after.map((r) => r.status).sort()).toEqual(['failed', 'success'])
      expect(counted(after)).toBe(2)
    })
  }
})
