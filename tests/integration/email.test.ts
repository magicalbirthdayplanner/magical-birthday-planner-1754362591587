/**
 * Resend workflows against a fake Resend API (RESEND_BASE_URL): invitation,
 * RSVP confirmation, host notification. No real email is sent.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, createTestUser, deleteTestUser, isSupabaseUp, type TestUser } from './helpers/supabase'

interface Sent {
  body: { from: string; to: string[]; subject: string; html: string; text?: string; reply_to?: string[] | string }
  idempotencyKey?: string
}
const sent: Sent[] = []
let failMode = false
const fake = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (req.method === 'POST' && req.url?.startsWith('/emails') && req.headers.authorization === 'Bearer re_fake_key') {
      if (failMode) {
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name: 'application_error', message: 'boom' }))
        return
      }
      sent.push({ body: JSON.parse(body), idempotencyKey: req.headers['idempotency-key'] as string | undefined })
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: `email_${sent.length}` }))
      return
    }
    res.writeHead(401).end('{}')
  })
})
await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()))

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  RESEND_API_KEY: 're_fake_key',
  RESEND_BASE_URL: `http://127.0.0.1:${(fake.address() as AddressInfo).port}`,
  EMAIL_FROM: 'Magical Birthday Planner <noreply@magicalbirthdayplanner.com>',
  NEXT_PUBLIC_BASE_URL: 'https://preview.example.test',
})

const inviteRoute = await import('@/app/api/invitations/send/route')
const rsvpRoute = await import('@/app/api/invite/[token]/rsvp/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

let H: TestUser
let partyId: string
let token: string

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  H = await createTestUser('email-host')
  const { data: p } = await H.client.from('parties').insert({ user_id: H.id, child_name: 'Ava Smith', child_age: 7, party_date: '2026-12-12' }).select('id').single()
  partyId = p!.id
  const { data: inv } = await H.client.from('party_invitations').insert({ party_id: partyId, host_name: 'Sam', location_text: 'Clay Cafe, Troy', start_time: '14:00', end_time: '16:00', message: 'Bring a smock!' }).select('token').single()
  token = inv!.token
  await H.client.from('guests').insert([
    { party_id: partyId, user_id: H.id, name: 'Patel family', email: 'patel@example.test' },
    { party_id: partyId, user_id: H.id, name: 'No Email family' },
    { party_id: partyId, user_id: H.id, name: '<img src=x onerror=alert(1)>', email: 'xss@example.test' },
  ])
})
afterAll(async () => {
  for (const k of ["RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]) delete process.env[k]
  fake.close()
  await deleteTestUser(H)
})
beforeEach(() => {
  sent.length = 0
  failMode = false
  resetRateLimits()
})

const sendInvites = (body: unknown, tok = H.accessToken) =>
  inviteRoute.POST(new Request('http://app.test/api/invitations/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }))
const rsvp = (body: unknown, ip = '203.0.113.50') =>
  rsvpRoute.POST(new Request(`http://app.test/api/invite/${token}/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }), { params: { token } })

describe('invitation emails', () => {
  it('emails only guests with an address, from the configured sender, with the RSVP link', async () => {
    const res = await sendInvites({ partyId })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 2, failed: 0 })
    expect(sent.map((s) => s.body.to[0]).sort()).toEqual(['patel@example.test', 'xss@example.test'])
    for (const s of sent) {
      expect(s.body.from).toBe('Magical Birthday Planner <noreply@magicalbirthdayplanner.com>')
      expect(s.body.subject).toBe('You’re invited to Ava’s birthday party!')
      expect(s.body.html).toContain(`https://preview.example.test/invite/${token}`)
      expect(s.idempotencyKey).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('escapes hostile guest names (no HTML injection)', async () => {
    await adminClient().from('guests').update({ invite_status: 'NOT_SENT' }).eq('party_id', partyId)
    await sendInvites({ partyId })
    const xss = sent.find((s) => s.body.to[0] === 'xss@example.test')!
    expect(xss.body.html).not.toContain('<img src=x')
    expect(xss.body.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('does not re-send to guests already invited unless asked', async () => {
    await sendInvites({ partyId })
    sent.length = 0
    const res = await sendInvites({ partyId })
    expect((await res.json()).sent).toBe(0)
    expect(sent).toHaveLength(0)
    const again = await sendInvites({ partyId, resend: true })
    expect((await again.json()).sent).toBe(2)
  })

  it('marks guests as invited', async () => {
    const { data } = await H.client.from('guests').select('invite_status').eq('email', 'patel@example.test')
    expect(data![0].invite_status).toBe('SENT')
  })

  it('other users cannot send invitations for this party', async () => {
    const other = await createTestUser('email-other')
    try {
      expect((await sendInvites({ partyId }, other.accessToken)).status).toBe(404)
      expect(sent).toHaveLength(0)
    } finally {
      await deleteTestUser(other)
    }
  })
})

describe('RSVP emails', () => {
  it('sends the guest a confirmation and notifies the host', async () => {
    const res = await rsvp({ name: 'Nguyen family', email: 'nguyen@example.test', status: 'CONFIRMED', adults: 2, children: 1, note: 'Peanut allergy' })
    expect(res.status).toBe(200)
    expect((await res.json()).emailed).toEqual({ guest: true, host: true })
    const toGuest = sent.find((s) => s.body.to[0] === 'nguyen@example.test')!
    const toHost = sent.find((s) => s.body.to[0] === H.email)!
    expect(toGuest.body.subject).toBe('Your RSVP for Ava’s party')
    expect(toHost.body.subject).toContain('Nguyen family is coming')
    expect(toHost.body.html).toContain('1 kid, 2 adults')
    expect(toHost.body.html).toContain('Peanut allergy')
  })

  it('escapes hostile RSVP input in the host email', async () => {
    await rsvp({ name: '<script>x</script>', status: 'MAYBE', adults: 1, children: 0, note: '<b>hi</b>' }, '203.0.113.51')
    const toHost = sent.find((s) => s.body.to[0] === H.email)!
    expect(toHost.body.html).not.toContain('<script>x</script>')
    expect(toHost.body.html).toContain('&lt;script&gt;')
    expect(toHost.body.subject).not.toMatch(/[\r\n]/)
  })

  it('respects the host’s email preference', async () => {
    await adminClient().from('users').update({ email_notifications: false }).eq('id', H.id)
    await rsvp({ name: 'Quiet family', status: 'DECLINED', adults: 0, children: 0 }, '203.0.113.52')
    expect(sent.find((s) => s.body.to[0] === H.email)).toBeUndefined()
    await adminClient().from('users').update({ email_notifications: true }).eq('id', H.id)
  })

  it('an email outage never fails the RSVP', async () => {
    failMode = true
    const res = await rsvp({ name: 'Resilient family', email: 'r@example.test', status: 'CONFIRMED', adults: 1, children: 1 }, '203.0.113.53')
    expect(res.status).toBe(200)
    expect((await res.json()).emailed).toEqual({ guest: false, host: false })
    const { data } = await adminClient().from('guests').select('name').eq('party_id', partyId).eq('name', 'Resilient family')
    expect(data).toHaveLength(1)
    const { data: logs } = await adminClient().from('email_logs').select('status').eq('party_id', partyId).eq('status', 'FAILED')
    expect(logs!.length).toBeGreaterThan(0)
  })
})
