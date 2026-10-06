/**
 * Launch waitlist: validation, attribution, and failure handling of POST /api/waitlist with a mocked database —
 * including that the email address never reaches Sentry, logs or analytics.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaitlistRequest, attributionFrom, cleanTag, normalizeEmail } from '@/lib/waitlist'

describe('waitlist request', () => {
  it('normalizes the email and trims the optional first name', () => {
    const r = WaitlistRequest.parse({ email: '  Parent.One@Example.COM ', firstName: '  Sam  ' })
    expect(r).toMatchObject({ email: 'parent.one@example.com', firstName: 'Sam' })
    expect(normalizeEmail(' A@B.Co ')).toBe('a@b.co')
    expect(WaitlistRequest.parse({ email: 'a@b.co', firstName: '   ' }).firstName).toBeUndefined()
    expect(WaitlistRequest.parse({ email: 'a@b.co', firstName: '<b>Sam</b>' }).firstName).toBe('bSam/b')
  })

  it('rejects invalid emails and oversized input', () => {
    for (const email of ['', 'not-an-email', 'a@b', '@b.co', 'a b@c.co', `${'x'.repeat(250)}@b.co`, 42, null]) {
      expect(WaitlistRequest.safeParse({ email }).success, String(email)).toBe(false)
    }
    expect(WaitlistRequest.safeParse({ email: 'a@b.co', firstName: 'x'.repeat(61) }).success).toBe(false)
    expect(WaitlistRequest.safeParse(null).success).toBe(false)
  })

  it('keeps only short slug attribution values', () => {
    expect(cleanTag(' Instagram ')).toBe('instagram')
    expect(cleanTag('prelaunch_oct13')).toBe('prelaunch_oct13')
    expect(cleanTag('<script>')).toBeUndefined()
    expect(cleanTag('a b')).toBeUndefined()
    expect(cleanTag(5)).toBeUndefined()
    const r = WaitlistRequest.parse({ email: 'a@b.co', utm_source: 'Reddit', utm_campaign: 'oct13-launch', utm_medium: 'x y', source: 'javascript:alert(1)' })
    expect(r).toMatchObject({ utm_source: 'reddit', utm_campaign: 'oct13-launch', utm_medium: undefined, source: undefined })
  })

  it('reads attribution from the landing URL, falling back to the referrer host', () => {
    expect(attributionFrom('?utm_source=instagram&utm_medium=story&utm_campaign=prelaunch_oct13&utm_content=d07_story&fbclid=zzz')).toEqual({ utm_source: 'instagram', utm_medium: 'story', utm_campaign: 'prelaunch_oct13', utm_content: 'd07_story' })
    expect(attributionFrom('?ref=youtube')).toEqual({ source: 'youtube' })
    expect(attributionFrom('', 'https://www.reddit.com/r/Parenting/comments/1')).toEqual({ source: 'reddit.com' })
    expect(attributionFrom('', 'https://magicalbirthdayplanner.app/privacy')).toEqual({})
    expect(attributionFrom('', 'not a url')).toEqual({})
  })
})

// ------------------------------------------------------------------ route
const sentry = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@sentry/nextjs', () => {
  const rec = (name: string) => (...args: unknown[]) => void sentry.calls.push([name, ...args])
  const scope = { setLevel: rec('setLevel'), setTag: rec('setTag'), setFingerprint: rec('setFingerprint') }
  return {
    withScope: (fn: (s: typeof scope) => void) => fn(scope),
    captureException: rec('captureException'),
    captureMessage: rec('captureMessage'),
    metrics: { count: rec('metrics.count'), distribution: rec('metrics.distribution') },
    logger: { info: rec('logger.info'), warn: rec('logger.warn') },
  }
})
const db = vi.hoisted(() => ({ rpc: vi.fn(), calls: [] as unknown[] }))
vi.mock('@/lib/server/supabase-admin', () => ({
  hasServiceRole: () => true,
  getSupabaseAdmin: () => ({
    rpc: db.rpc,
    from: () => ({ insert: (row: unknown) => (db.calls.push(row), Promise.resolve({ error: null })) }),
  }),
}))

const EMAIL = 'Secret.Parent@Example.test'
const post = async (body: unknown, ip = '203.0.113.1') => {
  const { POST } = await import('@/app/api/waitlist/route')
  return POST(new Request('http://app.test/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }))
}
const leaked = () => JSON.stringify([sentry.calls, db.calls]).toLowerCase().includes('secret.parent')

describe('POST /api/waitlist', () => {
  let logs: string[]
  beforeEach(async () => {
    const { resetRateLimits } = await import('@/lib/server/rate-limit')
    resetRateLimits()
    sentry.calls.length = 0
    db.calls.length = 0
    db.rpc.mockReset()
    logs = []
    for (const k of ['log', 'info', 'warn', 'error'] as const) vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
  })
  afterEach(() => vi.restoreAllMocks())

  it('stores a valid sign-up through the service-role RPC (normalized email, attribution) and records success', async () => {
    db.rpc.mockResolvedValue({ data: 'joined', error: null })
    const res = await post({ email: EMAIL, firstName: 'Sam', utm_source: 'instagram', utm_campaign: 'prelaunch_oct13', form: 'hero' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(db.rpc).toHaveBeenCalledWith('join_launch_waitlist', expect.objectContaining({ p_email: 'secret.parent@example.test', p_first_name: 'Sam', p_utm_source: 'instagram', p_utm_campaign: 'prelaunch_oct13' }))
    expect(JSON.stringify(sentry.calls)).toContain('waitlist_signup_success')
    expect(db.calls).toEqual([expect.objectContaining({ event: 'waitlist_signup_success', properties: { form: 'hero', source: 'instagram', campaign: 'prelaunch_oct13' } })])
    expect(leaked()).toBe(false)
  })

  it('a duplicate gets the same answer (no way to test who signed up) and is recorded as a duplicate', async () => {
    db.rpc.mockResolvedValue({ data: 'duplicate', error: null })
    const res = await post({ email: EMAIL })
    expect([res.status, await res.json()]).toEqual([200, { ok: true }])
    expect(JSON.stringify(sentry.calls)).toContain('waitlist_signup_duplicate')
  })

  it('rejects an invalid email without touching the database', async () => {
    const res = await post({ email: 'nope' })
    expect(res.status).toBe(400)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(JSON.stringify(sentry.calls)).toContain('waitlist_signup_validation_error')
    expect((await post('not json')).status).toBe(400)
  })

  it('a filled honeypot looks like success but stores nothing', async () => {
    const res = await post({ email: EMAIL, website: 'http://spam.example' })
    expect(res.status).toBe(200)
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('rate-limits a single device', async () => {
    db.rpc.mockResolvedValue({ data: 'joined', error: null })
    const codes: number[] = []
    for (let i = 0; i < 7; i++) codes.push((await post({ email: `p${i}@example.test` }, '198.51.100.7')).status)
    expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429])
  })

  it('a database error is a friendly 500 + a Sentry issue carrying only the error code — never the email', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { code: '23514', message: `new row violates check constraint, Failing row contains (${EMAIL})`, details: EMAIL } })
    const res = await post({ email: EMAIL })
    expect(res.status).toBe(500)
    expect((await res.json()).error.message).not.toContain('@')
    const s = JSON.stringify(sentry.calls)
    expect(s).toContain('captureMessage')
    expect(s).toContain('waitlist_signup_server_error')
    expect(s).toContain('23514')
    expect(leaked()).toBe(false)
    expect(logs.join('\n').toLowerCase()).not.toContain('secret.parent')
  })

  it('an unreachable database is handled the same way', async () => {
    db.rpc.mockRejectedValue(new TypeError('fetch failed'))
    const res = await post({ email: EMAIL })
    expect(res.status).toBe(500)
    expect(JSON.stringify(sentry.calls)).toContain('unreachable')
    expect(leaked()).toBe(false)
  })
})
