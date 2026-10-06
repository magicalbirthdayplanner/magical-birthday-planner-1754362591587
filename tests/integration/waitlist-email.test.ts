/**
 * Waitlist confirmation + launch reminder against local Supabase and an in-process mock of the Resend API
 * (POST /emails, POST /emails/batch). Covers once-only delivery, failure without data loss, the reminder's time
 * window, idempotent re-runs, unsubscribe, and the cron endpoint's auth and single-recipient test path.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, isSupabaseUp } from './helpers/supabase'

interface Sent {
  path: string
  key: string | null
  body: { to: string[]; subject: string; html: string; headers?: Record<string, string> } | { to: string[]; subject: string; html: string; headers?: Record<string, string> }[]
}
const sent: Sent[] = []
let failing = false
const resend = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    if (failing) return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name: 'application_error', message: 'down' }))
    const body = JSON.parse(raw)
    sent.push({ path: req.url!, key: (req.headers['idempotency-key'] as string) ?? null, body })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(req.url === '/emails/batch' ? { data: body.map((_: unknown, i: number) => ({ id: `re_b${sent.length}_${i}` })) } : { id: `re_${sent.length}` }))
  })
})
await new Promise<void>((r) => resend.listen(0, '127.0.0.1', () => r()))

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  RESEND_API_KEY: 're_test_key_for_integration',
  RESEND_BASE_URL: `http://127.0.0.1:${(resend.address() as AddressInfo).port}`,
  EMAIL_FROM: 'Magical Birthday Planner <noreply@example.test>',
  NEXT_PUBLIC_BASE_URL: 'https://mbp.example.test',
  CRON_SECRET: 'integration-cron-secret-0123456789',
})

const route = await import('@/app/api/waitlist/route')
const cron = await import('@/app/api/cron/launch-reminder/route')
const unsub = await import('@/app/api/waitlist/unsubscribe/route')
const { sendLaunchReminders } = await import('@/lib/server/waitlist-email')
const { REMINDER_AT, LAUNCH_AT } = await import('@/lib/launch')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const email = (n: string) => `wle-${n}-${stamp}@example.test`
const signup = (body: Record<string, unknown>) =>
  route.POST(new Request('http://app.test/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.2` }, body: JSON.stringify(body) }))
const row = async (e: string) => (await adminClient().from('launch_waitlist').select('*').eq('email', e)).data ?? []
const to = (s: Sent) => (Array.isArray(s.body) ? s.body.flatMap((b) => b.to) : s.body.to)
const sentTo = (e: string) => sent.filter((s) => to(s).includes(e))
const ON_REMINDER_DAY = REMINDER_AT.getTime() + 60_000

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  // Other suites' leftovers must not be "reminded" into this run's assertions.
  await adminClient().from('launch_waitlist').update({ launch_reminder_sent_at: new Date().toISOString() }).is('launch_reminder_sent_at', null).not('email', 'like', `%-${stamp}@example.test`)
})
afterAll(async () => {
  await adminClient().from('launch_waitlist').delete().like('email', `%-${stamp}@example.test`)
  await adminClient().from('email_logs').delete().like('recipient_email', `%-${stamp}@example.test`)
  resend.close()
})
beforeEach(() => {
  resetRateLimits()
  failing = false
})

describe('confirmation email', () => {
  it('a successful sign-up sends exactly one confirmation (idempotency key, unsubscribe header) and records it', async () => {
    expect((await signup({ email: email('a').toUpperCase(), firstName: 'Sam', utm_source: 'instagram' })).status).toBe(200)
    const mails = sentTo(email('a'))
    expect(mails).toHaveLength(1)
    const m = mails[0].body as { subject: string; html: string; headers: Record<string, string> }
    expect(m.subject).toBe('You’re on the list 🎂 Magical Birthday Planner launches October 13')
    expect(m.html).toContain('Sam')
    const [r] = await row(email('a'))
    expect(m.headers['List-Unsubscribe']).toBe(`<https://mbp.example.test/api/waitlist/unsubscribe?t=${r.unsubscribe_token}>`)
    expect(mails[0].key).toMatch(/^[0-9a-f]{64}$/)
    expect(r.confirmation_sent_at).not.toBeNull()
  })

  it('a duplicate sign-up keeps one row and sends nothing more', async () => {
    await signup({ email: email('a') })
    await signup({ email: email('a') })
    expect(await row(email('a'))).toHaveLength(1)
    expect(sentTo(email('a'))).toHaveLength(1)
  })

  it('an invalid email sends nothing', async () => {
    const before = sent.length
    expect((await signup({ email: `nope-${stamp}` })).status).toBe(400)
    expect(sent.length).toBe(before)
  })

  it('a Resend outage never loses the sign-up; the next sign-up of that email delivers it once', async () => {
    failing = true
    expect((await signup({ email: email('b'), utm_campaign: 'prelaunch_oct13' })).status).toBe(200)
    const [r] = await row(email('b'))
    expect(r).toMatchObject({ email: email('b'), utm_campaign: 'prelaunch_oct13', confirmation_sent_at: null })
    failing = false
    await signup({ email: email('b') })
    expect(sentTo(email('b'))).toHaveLength(1)
    expect((await row(email('b')))[0].confirmation_sent_at).not.toBeNull()
    await signup({ email: email('b') })
    expect(sentTo(email('b'))).toHaveLength(1)
  })
})

describe('launch reminder', () => {
  it('does nothing before Oct 12 00:00 ET or from launch on', async () => {
    const before = sent.length
    expect(await sendLaunchReminders({ now: REMINDER_AT.getTime() - 1 })).toMatchObject({ status: 'too_early', sent: 0 })
    expect(await sendLaunchReminders({ now: LAUNCH_AT.getTime() })).toMatchObject({ status: 'after_launch', sent: 0 })
    expect(sent.length).toBe(before)
  })

  it('sends one reminder per subscribed member (batches, unsubscribe headers), records it, and a re-run sends nothing', async () => {
    for (const n of ['r1', 'r2', 'r3']) await signup({ email: email(n), firstName: n.toUpperCase() })
    await signup({ email: email('gone') })
    const [gone] = await row(email('gone'))
    // the unsubscribe link: GET only asks, POST unsubscribes
    expect((await unsub.GET(new Request(`https://mbp.example.test/api/waitlist/unsubscribe?t=${gone.unsubscribe_token}`))).status).toBe(200)
    expect((await row(email('gone')))[0].status).toBe('subscribed')
    expect((await unsub.POST(new Request(`https://mbp.example.test/api/waitlist/unsubscribe?t=${gone.unsubscribe_token}`, { method: 'POST', body: 'List-Unsubscribe=One-Click' }))).status).toBe(200)
    expect((await row(email('gone')))[0].status).toBe('unsubscribed')

    const batchesBefore = sent.filter((s) => s.path === '/emails/batch').length
    const run = await sendLaunchReminders({ now: ON_REMINDER_DAY, batchSize: 2, pauseMs: 0 })
    expect(run.status).toBe('done')
    const batches = sent.filter((s) => s.path === '/emails/batch').slice(batchesBefore)
    expect(batches.length).toBeGreaterThanOrEqual(3) // a, b, r1–r3 in batches of 2
    const reminded = batches.flatMap(to)
    for (const n of ['a', 'b', 'r1', 'r2', 'r3']) expect(reminded.filter((e) => e === email(n)), n).toHaveLength(1)
    expect(reminded).not.toContain(email('gone'))
    const one = (batches[0].body as { subject: string; headers: Record<string, string> }[])[0]
    expect(one.subject).toBe('Tomorrow: Magical Birthday Planner opens 🎂')
    expect(one.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(new Set(batches.map((b) => b.key)).size).toBe(batches.length)
    for (const n of ['a', 'b', 'r1', 'r2', 'r3']) expect((await row(email(n)))[0].launch_reminder_sent_at, n).not.toBeNull()

    const again = await sendLaunchReminders({ now: ON_REMINDER_DAY, pauseMs: 0 })
    expect(again).toMatchObject({ status: 'done', sent: 0 })
    expect(sent.filter((s) => s.path === '/emails/batch').length).toBe(batchesBefore + batches.length)
  })

  it('a failed batch records nothing (so it is retried) and the retry delivers once', async () => {
    await signup({ email: email('late') })
    failing = true
    expect(await sendLaunchReminders({ now: ON_REMINDER_DAY, pauseMs: 0 })).toMatchObject({ status: 'failed', sent: 0 })
    expect((await row(email('late')))[0].launch_reminder_sent_at).toBeNull()
    failing = false
    expect(await sendLaunchReminders({ now: ON_REMINDER_DAY, pauseMs: 0 })).toMatchObject({ status: 'done', sent: 1 })
    expect(sentTo(email('late')).filter((s) => s.path === '/emails/batch')).toHaveLength(1)
  })
})

describe('cron endpoint', () => {
  const call = (method: 'GET' | 'POST', auth?: string, body?: unknown) =>
    (method === 'GET' ? cron.GET : cron.POST)(new Request('https://mbp.example.test/api/cron/launch-reminder', { method, headers: { ...(auth ? { Authorization: auth } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }))

  it('requires the cron secret', async () => {
    expect((await call('GET')).status).toBe(401)
    expect((await call('GET', 'Bearer wrong-secret-wrong-secret-xx')).status).toBe(401)
    const saved = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    try {
      expect((await call('GET', `Bearer ${saved}`)).status).toBe(503)
    } finally {
      process.env.CRON_SECRET = saved
    }
  })

  it('the scheduled run respects the window (today is before Oct 12 in this test run or after launch)', async () => {
    const res = await call('GET', `Bearer ${process.env.CRON_SECRET}`)
    expect(res.status).toBe(200)
    const now = Date.now()
    if (now < REMINDER_AT.getTime() || now >= LAUNCH_AT.getTime()) expect((await res.json()).sent).toBe(0)
  })

  it('test path: the exact reminder code for ONE existing waitlist row, nobody else', async () => {
    await signup({ email: email('tester') })
    await signup({ email: email('bystander') })
    const before = sent.length
    const res = await call('POST', `Bearer ${process.env.CRON_SECRET}`, { testEmail: email('tester').toUpperCase() })
    expect(await res.json()).toMatchObject({ status: 'done', sent: 1 })
    const batch = sent.slice(before)
    expect(batch.flatMap(to)).toEqual([email('tester')])
    expect((await row(email('bystander')))[0].launch_reminder_sent_at).toBeNull()
    expect(await (await call('POST', `Bearer ${process.env.CRON_SECRET}`, { testEmail: `nobody-${stamp}@example.test` })).json()).toMatchObject({ sent: 0 })
    expect((await call('POST', `Bearer ${process.env.CRON_SECRET}`, {})).status).toBe(400)
  })
})
