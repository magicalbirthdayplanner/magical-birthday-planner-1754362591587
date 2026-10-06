/**
 * Waitlist emails: content rules (launch date, no pricing, unsubscribe, escaping) and that delivery failures are
 * observable without the email address ever reaching Sentry or analytics.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@sentry/nextjs', () => {
  const rec = (name: string) => (...args: unknown[]) => void sentry.calls.push([name, ...args])
  const scope = { setLevel: rec('setLevel'), setTag: rec('setTag'), setFingerprint: rec('setFingerprint') }
  return { withScope: (fn: (s: typeof scope) => void) => fn(scope), captureException: rec('captureException'), captureMessage: rec('captureMessage'), metrics: { count: rec('metrics.count'), distribution: rec('metrics.distribution') }, logger: { info: rec('logger.info'), warn: rec('logger.warn') } }
})
const analytics = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/lib/analytics/server', () => ({ trackServer: (...a: unknown[]) => void analytics.calls.push(a) }))

const EMAIL = 'secret.parent@example.test'
const row = { id: '11111111-1111-4111-8111-111111111111', first_name: 'Sam', unsubscribe_token: '22222222-2222-4222-8222-222222222222', status: 'subscribed', confirmation_sent_at: null as string | null }
const db = vi.hoisted(() => ({ row: null as unknown, updates: [] as unknown[] }))
vi.mock('@/lib/server/supabase-admin', () => ({
  hasServiceRole: () => true,
  getSupabaseAdmin: () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) q[m] = () => q
      q.maybeSingle = async () => ({ data: db.row, error: null })
      q.update = (u: unknown) => (db.updates.push(u), q)
      q.then = (res: (v: unknown) => unknown) => res({ error: null })
      return q
    },
  }),
}))
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/notifications', async (orig) => ({ ...(await orig<typeof import('@/lib/server/notifications')>()), sendTransactional: send }))

const { confirmationEmail, reminderEmail, sendWaitlistConfirmation } = await import('@/lib/server/waitlist-email')
const PRICING = /\$\s?\d|9\.99|19\.99|29\.99|\bStarter\b|\bPlus\b|\bPro\b|pricing|price|free trial|subscription/i

describe('email content', () => {
  for (const [name, make] of [['confirmation', confirmationEmail], ['reminder', reminderEmail]] as const) {
    it(`${name}: launch date, unsubscribe + privacy links, no pricing, escaped name`, () => {
      const m = make({ firstName: '<b>Sam</b>', unsubscribeToken: row.unsubscribe_token })
      expect(m.subject).toContain('🎂')
      for (const part of [m.html, m.text]) {
        expect(part).toContain('October 13')
        expect(part).toContain(`/api/waitlist/unsubscribe?t=${row.unsubscribe_token}`)
        expect(part).toContain('/privacy')
        expect(part).not.toMatch(PRICING)
        expect(part).not.toMatch(/lifetime|guarantee/i)
      }
      expect(m.html).toContain('&lt;b&gt;Sam&lt;/b&gt;')
      expect(m.html).not.toContain('<b>Sam</b>')
    })
  }
  it('subjects', () => {
    expect(confirmationEmail({ unsubscribeToken: 'x' }).subject).toBe('You’re on the list 🎂 Magical Birthday Planner launches October 13')
    expect(reminderEmail({ unsubscribeToken: 'x' }).subject).toBe('Tomorrow: Magical Birthday Planner opens 🎂')
  })
})

describe('sendWaitlistConfirmation', () => {
  beforeEach(() => {
    sentry.calls.length = 0
    analytics.calls.length = 0
    db.updates.length = 0
    db.row = { ...row }
    send.mockReset()
  })

  it('sends once per row (idempotency key = row id, one-click unsubscribe headers) and records it', async () => {
    send.mockResolvedValue({ ok: true, id: 're_1' })
    expect(await sendWaitlistConfirmation(EMAIL)).toBe('sent')
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: EMAIL, idempotencyKey: `waitlist-confirm:${row.id}`, headers: expect.objectContaining({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }) }))
    expect(db.updates).toEqual([{ confirmation_sent_at: expect.any(String) }])
  })

  it('skips rows that already got it, or unsubscribed', async () => {
    db.row = { ...row, confirmation_sent_at: '2026-10-06T00:00:00Z' }
    expect(await sendWaitlistConfirmation(EMAIL)).toBe('skipped')
    db.row = { ...row, status: 'unsubscribed' }
    expect(await sendWaitlistConfirmation(EMAIL)).toBe('skipped')
    expect(send).not.toHaveBeenCalled()
  })

  it('a Resend failure is observable (metric + Sentry issue with the error code) and never carries the email', async () => {
    send.mockResolvedValue({ ok: false, error: 'rate_limit_exceeded' })
    expect(await sendWaitlistConfirmation(EMAIL)).toBe('failed')
    expect(db.updates).toEqual([]) // not marked: a later repeat sign-up can retry
    const s = JSON.stringify(sentry.calls)
    expect(s).toContain('waitlist_confirmation_failed')
    expect(s).toContain('captureMessage')
    expect(s).toContain('rate_limit_exceeded')
    expect(JSON.stringify([sentry.calls, analytics.calls])).not.toContain('secret.parent')
  })

  it('a thrown error is caught the same way', async () => {
    send.mockRejectedValue(new Error(`boom for ${EMAIL}`))
    expect(await sendWaitlistConfirmation(EMAIL)).toBe('failed')
    expect(JSON.stringify([sentry.calls, analytics.calls])).not.toContain('secret.parent')
  })
})
