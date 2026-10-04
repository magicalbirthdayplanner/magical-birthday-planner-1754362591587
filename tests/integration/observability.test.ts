/**
 * Observability through the real AI and checkout routes (local Supabase, mock AI provider, mock Dodo API).
 * @sentry/nextjs is replaced by an in-memory recorder: nothing leaves the machine.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

vi.mock('@sentry/nextjs', async () => (await import('../helpers/sentry-mock')).sentryMock)

// Mock Dodo: always 500 (checkout provider failure).
const dodo = http.createServer((_req, res) => res.writeHead(500).end('{}'))
await new Promise<void>((r) => dodo.listen(0, '127.0.0.1', r))

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_ENABLED_FEATURES: 'party_planner', AI_TIMEOUT_MS: '3000', AI_LONG_TIMEOUT_MS: '3000',
  DODO_PAYMENTS_API_KEY: 'test_dodo_key', DODO_PAYMENTS_ENVIRONMENT: 'test_mode', DODO_API_BASE_URL: `http://127.0.0.1:${(dodo.address() as AddressInfo).port}`,
  DODO_PRODUCT_STARTER: 'pdt_obsStarter001', DODO_PRODUCT_PLUS: 'pdt_obsPlus000002', DODO_PRODUCT_PRO: 'pdt_obsPro0000003',
})
const { sentry } = await import('../helpers/sentry-mock')
const { resetAIConfig } = await import('@/lib/ai/config')
const { scriptMock, resetMock } = await import('@/lib/ai/providers/mock')
const { ProviderError } = await import('@/lib/ai/provider')
const { resetRateLimits } = await import('@/lib/server/rate-limit')
const planner = await import('@/app/api/ai/party-planner/route')
const checkout = await import('@/app/api/billing/checkout/route')

const up = await isSupabaseUp()
let U: TestUser, partyId: string
const NOTES = 'My daughter Ava loves Taylor Swift; email me at mom@example.com or 248-555-0199.'
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const ask = (u: TestUser | null) =>
  planner.POST(new Request('http://app.test/api/ai/party-planner', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(u ? { Authorization: `Bearer ${u.accessToken}` } : {}) }, body: JSON.stringify({ partyId, notes: NOTES }) }))

beforeAll(async () => {
  if (!up) return
  U = await createTestUser('obs-u')
  partyId = (await U.client.from('parties').insert({ user_id: U.id, child_name: 'Ava', child_age: 7, party_date: inDays(30), zip_code: '48084', guest_count: 12, budget: 250 }).select('id').single()).data!.id
  await adminClient().from('plan_overrides').insert({ user_id: U.id, plan: 'PLUS', expires_at: null })
  await adminClient().rpc('recompute_entitlement', { p_user: U.id })
})
afterAll(async () => {
  for (const k of ['DODO_PAYMENTS_API_KEY', 'DODO_PAYMENTS_ENVIRONMENT', 'DODO_API_BASE_URL', 'DODO_PRODUCT_STARTER', 'DODO_PRODUCT_PLUS', 'DODO_PRODUCT_PRO']) delete process.env[k]
  dodo.close()
  if (!up) return
  await adminClient().from('plan_overrides').delete().eq('user_id', U.id)
  await deleteTestUser(U)
})
beforeEach(async () => {
  sentry.reset()
  resetMock()
  resetAIConfig()
  resetRateLimits()
  if (up) await adminClient().from('ai_generations').delete().eq('user_id', U.id)
})

describe.skipIf(!up)('AI route telemetry', () => {
  it('success: feature / plan / provider / model on the metrics, a gen_ai span, no prompt or personal data anywhere', async () => {
    expect((await ask(U)).status).toBe(200)
    expect(sentry.names()).toEqual(['AI_REQUEST_STARTED', 'AI_REQUEST_SUCCEEDED'])
    expect(sentry.metrics.find((m) => m.name === 'AI_REQUEST_SUCCEEDED')!.attributes).toEqual({ feature: 'party_planner', plan: 'PLUS', provider: 'mock', model: 'mock-1' })
    expect(sentry.spans[0]).toMatchObject({ op: 'gen_ai.chat', attributes: { 'mbp.ai.success': true, 'mbp.plan': 'PLUS' } })
    expect(sentry.captured).toEqual([])
    expect(sentry.dump()).not.toMatch(/Ava|Taylor|mom@example|555-0199|48084|birthday-planning assistant/)
    expect(sentry.dump()).not.toContain(partyId)
  })
  it('provider failure: failed metric + an AI provider issue; the parent still gets the friendly 502', async () => {
    scriptMock(new ProviderError('unavailable', '503', 503))
    expect((await ask(U)).status).toBe(502)
    expect(sentry.names()).toEqual(['AI_REQUEST_STARTED', 'AI_REQUEST_FAILED'])
    expect(sentry.captured).toHaveLength(1)
    expect(sentry.captured[0]).toMatchObject({ level: 'error', tags: { area: 'ai', feature: 'party_planner', detail: 'unavailable' } })
  })
  it('timeout: failed + timeout metrics', async () => {
    scriptMock((req) => new Promise((_, rej) => req.signal.addEventListener('abort', () => rej(new ProviderError('timeout', 't')))))
    expect((await ask(U)).status).toBe(504)
    expect(sentry.names()).toEqual(['AI_REQUEST_STARTED', 'AI_REQUEST_FAILED', 'AI_REQUEST_TIMEOUT'])
  })
  it('expected 401 creates no telemetry at all (and no issue)', async () => {
    expect((await ask(null)).status).toBe(401)
    expect(sentry.metrics).toEqual([])
    expect(sentry.captured).toEqual([])
  })
})

describe.skipIf(!up)('checkout telemetry', () => {
  it('401 and invalid plans are not errors', async () => {
    const post = (token: string | null, body: unknown) => checkout.POST(new Request('http://app.test/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }))
    expect((await post(null, { plan: 'PLUS' })).status).toBe(401)
    expect((await post(U.accessToken, { plan: 'GOLD' })).status).toBe(400)
    expect(sentry.captured).toEqual([])
  })
  it('a Dodo provider failure is an issue with plan + code (no customer data) and records checkout latency', async () => {
    const res = await checkout.POST(new Request('http://app.test/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${U.accessToken}` }, body: JSON.stringify({ plan: 'PRO', partyId }) })) // U has PLUS (override): PRO is a real upgrade
    expect(res.status).toBe(502)
    expect(sentry.names()).toEqual(['CHECKOUT_FAILED'])
    expect(sentry.metrics.some((m) => m.name === 'CHECKOUT_LATENCY' && m.attributes.success === false)).toBe(true)
    expect(sentry.captured[0]).toMatchObject({ level: 'error', tags: { area: 'billing', plan: 'PRO', code: 'provider_error', environment: 'test' } })
    expect(sentry.dump()).not.toContain(U.email)
  })
})
