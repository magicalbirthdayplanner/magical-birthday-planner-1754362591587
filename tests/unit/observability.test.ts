/**
 * Observability (Sentry) without a network: @sentry/nextjs is replaced by an in-memory recorder.
 * Covers privacy scrubbing, fail-safety, AI / Dodo / auth / Google telemetry and the health endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('@sentry/nextjs', async () => (await import('../helpers/sentry-mock')).sentryMock)
vi.mock('@/lib/billing/server', () => ({ processWebhookEvent: vi.fn(), BillingError: class extends Error {}, createCheckout: vi.fn(), getUserPlan: vi.fn() }))
vi.mock('@/lib/server/supabase-admin', () => ({ hasServiceRole: () => true, getSupabaseAdmin: () => ({}) }))

const { sentry } = await import('../helpers/sentry-mock')
const { scrubEvent, scrubString, scrubUrl, scrubAttributes, scrubBreadcrumb } = await import('@/lib/observability/privacy')
const { track, reportError, withSpan, safeId } = await import('@/lib/observability/telemetry')
const { observeAICall, estimateCostUsd } = await import('@/lib/observability/ai')
const { authFailed, authCallbackFailed } = await import('@/lib/observability/auth')
const { sentryOptions } = await import('@/lib/observability/sentry-options')
const { createPlacesClient } = await import('@/lib/google/places')
const { callStructured } = await import('@/lib/ai/client')
const { readAIConfig } = await import('@/lib/ai/config')
const { setProviderOverride } = await import('@/lib/ai/provider')
const { MockProvider, resetMock, scriptMock } = await import('@/lib/ai/providers/mock')
const { processWebhookEvent } = await import('@/lib/billing/server')
const { signWebhook } = await import('@/lib/billing/webhook-signature')
const webhook = await import('@/app/api/webhooks/dodo/route')
const health = await import('@/app/api/health/route')

const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const SECRET = 'whsec_' + Buffer.from('observability-test-signing-key').toString('base64')

beforeEach(() => sentry.reset())
afterEach(() => {
  vi.unstubAllEnvs()
  setProviderOverride(null)
})

describe('privacy scrubbing', () => {
  it('URLs lose query strings, fragments (Supabase tokens) and invite tokens', () => {
    expect(scrubUrl('https://magicalbirthdayplanner.app/home#access_token=abc&refresh_token=def')).toBe('https://magicalbirthdayplanner.app/home')
    expect(scrubUrl('https://maps.googleapis.com/maps/api/geocode/json?components=postal_code:48084&key=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')).toBe('https://maps.googleapis.com/maps/api/geocode/json')
    expect(scrubUrl('/invite/Zk3x9Qp_secret-token/rsvp')).toBe('/invite/[token]/rsvp')
  })
  it('free text loses emails, JWTs, bearer tokens, API keys and phone numbers', () => {
    const s = scrubString(`user mom@example.com token ${JWT} Bearer abcdefghijklmnop key sk-abcdefghijklmnopqrstuv whsec_abcdefghijklmnopqrstuv call +1 (248) 555-0199`)
    expect(s).not.toMatch(/mom@example\.com|eyJhbGci|abcdefghijklmnop|sk-abc|whsec_abc|555-0199/)
  })
  it('events lose cookies, headers, bodies, user details and local variables', () => {
    const e = scrubEvent({
      request: { url: 'https://x.app/reset-password#access_token=1', cookies: { sb: 'x' }, headers: { authorization: `Bearer ${JWT}` }, data: { password: 'hunter2' }, query_string: 'a=b' },
      user: { id: 'u1', email: 'mom@example.com', ip_address: '1.2.3.4' },
      exception: { values: [{ value: 'failed for mom@example.com', stacktrace: { frames: [{ vars: { password: 'hunter2' } }] } }] },
      extra: { password: 'hunter2', note: 'ok' },
    })!
    const json = JSON.stringify(e)
    expect(json).not.toMatch(/hunter2|mom@example|access_token|1\.2\.3\.4|cookies|authorization/)
    expect(e.user).toEqual({ id: 'u1' })
  })
  it('console breadcrumbs are dropped; fetch breadcrumbs lose query strings', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'Session loaded' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x.supabase.co/rest/v1/guests?email=eq.mom@example.com' } })!.data.url).toBe('https://x.supabase.co/rest/v1/guests')
  })
  it('span/log attributes: headers, AI inputs/outputs and user fields are removed; URLs scrubbed', () => {
    const a = scrubAttributes({ 'url.full': 'https://places.googleapis.com/v1/places?key=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'http.request.header.authorization': 'Bearer x', 'gen_ai.input.messages': 'my daughter Ava', 'user.email': 'a@b.co', 'url.query': { value: '?email=a@b.co', type: 'string' } } as Record<string, unknown>)
    expect(a).toEqual({ 'url.full': 'https://places.googleapis.com/v1/places', 'url.query': { value: '', type: 'string' } })
  })
  it('Sentry options: no DSN → disabled; privacy-first data collection; replay is not configured', () => {
    const off = sentryOptions('server', undefined)
    expect(off.enabled).toBe(false)
    const on = sentryOptions('client', 'https://k@o1.ingest.us.sentry.io/1')
    expect(on.enabled).toBe(true)
    expect(on.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, genAI: { inputs: false, outputs: false }, stackFrameVariables: false })
    expect(JSON.stringify(on.integrations ?? [])).not.toMatch(/replay/i)
  })
})

describe('fail-safe: Sentry failures never break the app', () => {
  it('track / reportError / withSpan swallow SDK errors; the wrapped work runs exactly once', async () => {
    sentry.explode = true
    expect(() => track('X', { a: 1 })).not.toThrow()
    expect(() => reportError(new Error('x'), { area: 'api', op: 'test' })).not.toThrow()
    let runs = 0
    await expect(withSpan({ name: 's', op: 'test' }, async () => ++runs)).resolves.toBe(1)
    expect(runs).toBe(1)
  })
  it('errors thrown by the wrapped work still propagate unchanged', async () => {
    await expect(withSpan({ name: 's', op: 'test' }, async () => Promise.reject(new Error('real failure')))).rejects.toThrow('real failure')
  })
  it('the real SDK without init (no DSN) is a no-op', async () => {
    const real = await vi.importActual<typeof import('@sentry/nextjs')>('@sentry/nextjs')
    expect(() => real.metrics.count('x', 1)).not.toThrow()
    expect(() => real.captureMessage('x')).not.toThrow()
    await expect(real.startSpan({ name: 'x' }, async () => 42)).resolves.toBe(42)
  })
  it('AI requests succeed even when Sentry is broken', async () => {
    sentry.explode = true
    setProviderOverride(new MockProvider())
    resetMock()
    scriptMock('{"title":"Art party"}')
    const cfg = readAIConfig({ AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_ENABLED_FEATURES: 'party_planner', NODE_ENV: 'test' } as unknown as NodeJS.ProcessEnv)
    const r = await observeAICall({ feature: 'party_planner', plan: 'PLUS', provider: 'mock', model: 'mock-1' }, () =>
      callStructured({ feature: 'party_planner', schema: z.object({ title: z.string() }), system: 's', user: 'u', sessionId: 's1', cfg }),
    )
    expect(r.ok).toBe(true)
  })
})

describe('AI telemetry', () => {
  const meta = { feature: 'party_planner', plan: 'PLUS', provider: 'opencode', model: 'deepseek-v4-pro', requestId: 'gen-123', partyId: '7c1d2c55-1111-4222-8333-944444444444' }
  const ok = { ok: true, model: 'deepseek-v4-pro', durationMs: 18_432, attempts: 1, inputTokens: 950, outputTokens: 2000 }

  it('success → started + succeeded, a gen_ai span with usage, latency + token + estimated-cost metrics', async () => {
    await observeAICall(meta, async () => ok)
    expect(sentry.names()).toEqual(['AI_REQUEST_STARTED', 'AI_REQUEST_SUCCEEDED'])
    const succeeded = sentry.metrics.find((m) => m.name === 'AI_REQUEST_SUCCEEDED')!
    expect(succeeded.attributes).toEqual({ feature: 'party_planner', plan: 'PLUS', provider: 'opencode', model: 'deepseek-v4-pro' })
    const span = sentry.spans[0]
    expect(span).toMatchObject({ op: 'gen_ai.chat', attributes: { 'gen_ai.request.model': 'deepseek-v4-pro', 'gen_ai.usage.input_tokens': 950, 'gen_ai.usage.output_tokens': 2000, 'mbp.ai.feature': 'party_planner', 'mbp.plan': 'PLUS', 'mbp.ai.retry_count': 0, 'mbp.request_id': 'gen-123' } })
    expect(sentry.metrics.find((m) => m.name === 'PLAN_MY_PARTY_LATENCY')!.value).toBe(18_432)
    expect(sentry.metrics.find((m) => m.name === 'ai.estimated_cost_usd')!.value).toBeGreaterThan(0)
    expect(sentry.captured).toEqual([])
  })
  it('ids are never metric dimensions; the party id is only sent hashed', async () => {
    await observeAICall(meta, async () => ok)
    for (const m of sentry.metrics) expect(Object.keys(m.attributes)).not.toEqual(expect.arrayContaining(['request_id', 'party', 'party_id', 'user_id']))
    expect(sentry.dump()).not.toContain(meta.partyId)
    expect(sentry.dump()).toContain(safeId(meta.partyId)!)
  })
  it('provider failure → failed metric + an AI provider issue', async () => {
    await observeAICall(meta, async () => ({ ok: false, code: 'provider_error', detail: 'unavailable', model: 'deepseek-v4-pro', durationMs: 900, attempts: 1, inputTokens: null, outputTokens: null }))
    expect(sentry.names()).toEqual(['AI_REQUEST_STARTED', 'AI_REQUEST_FAILED'])
    expect(sentry.metrics.find((m) => m.name === 'AI_REQUEST_FAILED')!.attributes).toMatchObject({ failure: 'provider_error', detail: 'unavailable', plan: 'PLUS' })
    expect(sentry.captured).toHaveLength(1)
    expect(sentry.captured[0]).toMatchObject({ level: 'error', tags: { area: 'ai', feature: 'party_planner' }, fingerprint: ['ai-provider', 'opencode', 'unavailable'] })
    // unknown usage is reported as unknown, never as a made-up number
    expect(sentry.logs.find((l) => l.message === 'AI_REQUEST_FAILED')!.attributes).toMatchObject({ input_tokens: 'unknown', estimated_cost_usd: 'unknown' })
  })
  it('timeout → failed + timeout metrics and a warning issue', async () => {
    await observeAICall(meta, async () => ({ ok: false, code: 'timeout', detail: 'aborted', model: 'deepseek-v4-pro', durationMs: 55_000, attempts: 1 }))
    expect(sentry.names()).toEqual(['AI_REQUEST_STARTED', 'AI_REQUEST_FAILED', 'AI_REQUEST_TIMEOUT'])
    expect(sentry.spans[0].status).toBe('timeout') // drives the AI failure-rate monitor
    expect(sentry.captured[0]).toMatchObject({ level: 'warning', fingerprint: ['ai-timeout', 'party_planner'] })
  })
  it('validation failure → validation metric, no issue; client abort → no issue', async () => {
    await observeAICall(meta, async () => ({ ok: false, code: 'invalid_response', detail: 'schema', model: 'm', durationMs: 1, attempts: 2 }))
    expect(sentry.names()).toContain('AI_REQUEST_VALIDATION_FAILED')
    await observeAICall(meta, async () => ({ ok: false, code: 'provider_error', detail: 'aborted', model: 'm', durationMs: 1, attempts: 1 }))
    expect(sentry.metrics.filter((m) => m.name === 'AI_REQUEST_FAILED').map((m) => m.attributes.failure)).toEqual(['invalid_response', 'client_abort'])
    expect(sentry.captured).toEqual([])
  })
  it('a retry is recorded with its reason, and prompts / model output are never sent', async () => {
    setProviderOverride(new MockProvider())
    resetMock()
    scriptMock('not json — my daughter Ava loves Taylor Swift', '{"title":"Art party"}')
    const cfg = readAIConfig({ AI_ENABLED: 'true', AI_PROVIDER: 'mock', AI_ENABLED_FEATURES: 'party_planner', NODE_ENV: 'test' } as unknown as NodeJS.ProcessEnv)
    const r = await observeAICall({ ...meta, provider: 'mock', model: 'mock-1' }, () =>
      callStructured({ feature: 'party_planner', schema: z.object({ title: z.string() }), system: 'SYSTEM PROMPT secret rules', user: 'Party for Ava, 7, ZIP 48084', sessionId: 's1', cfg }),
    )
    expect(r.ok).toBe(true)
    expect(sentry.metrics.find((m) => m.name === 'AI_REQUEST_RETRIED')!.attributes).toMatchObject({ feature: 'party_planner', reason: 'json' })
    expect(sentry.spans[0].attributes).toMatchObject({ 'mbp.ai.retry_count': 1, 'mbp.ai.attempts': 2 })
    expect(sentry.dump()).not.toMatch(/Ava|Taylor|SYSTEM PROMPT|48084|Art party/)
  })
  it('estimated cost uses the published DeepSeek prices, peak vs off-peak; unknown model or usage → null', () => {
    expect(estimateCostUsd('deepseek-v4-pro', 1_000_000, 0, new Date('2026-10-04T12:00:00Z'))).toBe(0.66) // Sunday
    expect(estimateCostUsd('deepseek-v4-pro', 1_000_000, 0, new Date('2026-10-05T07:00:00Z'))).toBe(1.32) // Monday 07 UTC
    expect(estimateCostUsd('mystery-model', 100, 100)).toBeNull()
    expect(estimateCostUsd('deepseek-v4-pro', null, 100)).toBeNull()
  })
})

describe('Dodo webhook telemetry', () => {
  const event = { type: 'payment.succeeded', data: { payment_id: 'pay_1', product_cart: [{ product_id: 'pdt_testStarter01' }], customer: { email: 'mom@example.com', name: 'Jane Doe' }, card_last_four: '4242' } }
  const send = (body: unknown, opts: { secret?: string } = {}) => {
    const raw = JSON.stringify(body)
    const id = `msg_${Math.random().toString(36).slice(2)}`
    const ts = Math.floor(Date.now() / 1000)
    return webhook.POST(new Request('http://app.test/api/webhooks/dodo', { method: 'POST', headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': signWebhook(opts.secret ?? SECRET, id, ts, raw) }, body: raw }))
  }
  beforeEach(() => {
    vi.stubEnv('DODO_PAYMENTS_WEBHOOK_SECRET', SECRET)
    vi.stubEnv('DODO_PAYMENTS_ENVIRONMENT', 'test_mode')
    vi.stubEnv('DODO_PRODUCT_STARTER', 'pdt_testStarter01')
  })

  it('success → received / processed / PAYMENT_SUCCEEDED with plan + product, and no error', async () => {
    vi.mocked(processWebhookEvent).mockResolvedValueOnce({ status: 'processed', detail: 'active', userId: 'u1' })
    expect((await send(event)).status).toBe(200)
    expect(sentry.names()).toEqual(['WEBHOOK_RECEIVED', 'WEBHOOK_PROCESSED', 'PAYMENT_SUCCEEDED'])
    expect(sentry.metrics.find((m) => m.name === 'PAYMENT_SUCCEEDED')!.attributes).toMatchObject({ plan: 'STARTER', product_id: 'pdt_testStarter01', environment: 'test' })
    expect(sentry.captured).toEqual([])
    expect(sentry.dump()).not.toMatch(/mom@example|Jane|4242|whsec_/)
  })
  it('processing failure → WEBHOOK_PROCESSING_FAILED + an error issue (and Dodo gets a 500 to retry)', async () => {
    vi.mocked(processWebhookEvent).mockRejectedValueOnce(new Error('connection reset'))
    expect((await send(event)).status).toBe(500)
    expect(sentry.names()).toContain('WEBHOOK_PROCESSING_FAILED')
    expect(sentry.captured[0]).toMatchObject({ kind: 'exception', level: 'error', tags: { area: 'billing', op: 'webhook_processing', event_type: 'payment.succeeded' } })
  })
  it('invalid signature → security event (warning metric/log), no issue, nothing processed', async () => {
    const before = vi.mocked(processWebhookEvent).mock.calls.length
    expect((await send(event, { secret: 'whsec_' + Buffer.from('wrong-key-wrong-key').toString('base64') })).status).toBe(401)
    expect(sentry.names()).toEqual(['WEBHOOK_RECEIVED', 'WEBHOOK_INVALID_SIGNATURE'])
    expect(sentry.logs.find((l) => l.message === 'WEBHOOK_INVALID_SIGNATURE')!.level).toBe('warn')
    expect(sentry.captured).toEqual([])
    expect(vi.mocked(processWebhookEvent).mock.calls.length).toBe(before)
  })
  it('a paid event that matches no user is an error issue; duplicates are just counted', async () => {
    vi.mocked(processWebhookEvent).mockResolvedValueOnce({ status: 'unmatched', detail: 'unknown_customer' })
    await send(event)
    expect(sentry.captured[0]).toMatchObject({ level: 'error', fingerprint: ['dodo-unmatched', 'payment.succeeded'] })
    sentry.reset()
    vi.mocked(processWebhookEvent).mockResolvedValueOnce({ status: 'duplicate' })
    await send(event)
    expect(sentry.names()).toEqual(['WEBHOOK_RECEIVED', 'WEBHOOK_DUPLICATE'])
    expect(sentry.captured).toEqual([])
  })
})

describe('auth telemetry', () => {
  it('wrong password is a low-noise metric, not an issue, and never carries credentials', () => {
    authFailed('login', { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login for mom@example.com with password hunter2' })
    expect(sentry.names()).toEqual(['AUTH_LOGIN_FAILED'])
    expect(sentry.metrics[0].attributes).toMatchObject({ code: 'invalid_credentials', category: 'expected', status: 400 })
    expect(sentry.captured).toEqual([])
    expect(sentry.dump()).not.toMatch(/mom@example|hunter2/)
  })
  it('an auth server failure becomes an issue (still without credentials); offline is not', () => {
    authFailed('signup', { name: 'AuthApiError', status: 500, code: 'unexpected_failure', message: `token ${JWT}` })
    expect(sentry.captured[0]).toMatchObject({ tags: { area: 'auth', flow: 'signup', code: 'unexpected_failure' }, fingerprint: ['auth', 'signup', 'unexpected_failure'] })
    authFailed('login', { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })
    expect(sentry.captured).toHaveLength(1)
    expect(sentry.dump()).not.toContain('eyJhbGci')
  })
  it('callback: expired links are expected; unsafe codes are not echoed', () => {
    authCallbackFailed('otp_expired')
    authCallbackFailed('<script>alert(1)</script>')
    expect(sentry.metrics.map((m) => m.attributes.code)).toEqual(['otp_expired', 'unknown'])
    expect(sentry.captured).toHaveLength(1) // 'unknown' is treated as a system failure
  })
})

describe('Google Places telemetry', () => {
  const KEY = 'AIzaSyTESTKEYTESTKEYTESTKEYTESTKEY12345'
  it('failure is captured with operation/status only — never the key, query or location', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: `API key ${KEY} not valid` } }), { status: 403 })) as unknown as typeof fetch
    const api = createPlacesClient({ apiKey: KEY, fetchImpl })
    await expect(api.searchText({ textQuery: 'trampoline park near 12 Elm St', center: { lat: 42.5803, lng: -83.1431 }, radiusMeters: 5000 })).rejects.toThrow()
    expect(sentry.names()).toEqual(['GOOGLE_PLACES_REQUEST', 'GOOGLE_PLACES_FAILURE'])
    expect(sentry.metrics.find((m) => m.name === 'GOOGLE_PLACES_FAILURE')!.attributes).toEqual({ operation: 'search', kind: 'auth', status: '4xx' })
    expect(sentry.captured[0]).toMatchObject({ level: 'error', fingerprint: ['google-places', 'auth'] })
    expect(sentry.dump()).not.toMatch(/AIzaSy|Elm St|42\.58|83\.14|trampoline/)
  })
  it('success records latency and result count', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ places: [{ id: 'a' }, { id: 'b' }] }), { status: 200 })) as unknown as typeof fetch
    await createPlacesClient({ apiKey: KEY, fetchImpl }).searchText({ textQuery: 'x', center: { lat: 1, lng: 1 }, radiusMeters: 1000 })
    expect(sentry.logs.find((l) => l.message === 'GOOGLE_PLACES_SUCCESS')!.attributes).toMatchObject({ operation: 'search', result_count: 2 })
    expect(sentry.metrics.some((m) => m.name === 'GOOGLE_PLACES_LATENCY')).toBe(true)
    expect(sentry.captured).toEqual([])
  })
})

describe('health endpoint', () => {
  it('GET /api/health → 200 {status, service} and nothing else', async () => {
    const res = health.GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', service: 'magical-birthday-planner' })
    expect(health.HEAD().status).toBe(200)
  })
})

describe('uncaught server errors', () => {
  it('instrumentation forwards request errors to Sentry via the official hook', async () => {
    const inst = await import('@/instrumentation')
    const S = await import('@sentry/nextjs')
    expect(inst.onRequestError).toBe(S.captureRequestError)
  })
})
