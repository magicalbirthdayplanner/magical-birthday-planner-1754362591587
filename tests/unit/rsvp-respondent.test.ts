/** The RSVP page's per-device invitee key: stable per invitation, separate per invitation, resettable. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/browser', () => ({ db: {} }))

const mem = new Map<string, string>()
let storageBroken = false
vi.stubGlobal('localStorage', {
  getItem: (k: string) => { if (storageBroken) throw new Error('blocked'); return mem.get(k) ?? null },
  setItem: (k: string, v: string) => { if (storageBroken) throw new Error('blocked'); mem.set(k, v) },
  removeItem: (k: string) => { if (storageBroken) throw new Error('blocked'); mem.delete(k) },
})
const sent: Record<string, unknown>[] = []
vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
  sent.push(JSON.parse(init.body))
  return new Response('{"ok":true}', { status: 200 })
})

const { rsvpRespondent, forgetRsvpRespondent, lastRsvpName, submitRsvp } = await import('@/lib/data/invitations')
const T1 = 'a'.repeat(48), T2 = 'b'.repeat(48)
const answer = { name: 'The Nguyen family', status: 'CONFIRMED' as const, adults: 2, children: 1 }

beforeEach(() => {
  mem.clear()
  sent.length = 0
  storageBroken = false
})

describe('RSVP respondent key', () => {
  it('is random, 128-bit hex, and stable for the same invitation on this device (refresh, retry, change)', () => {
    const k = rsvpRespondent(T1)
    expect(k).toMatch(/^[a-f0-9]{32}$/)
    expect(rsvpRespondent(T1)).toBe(k)
  })
  it('differs per invitation', () => {
    expect(rsvpRespondent(T1)).not.toBe(rsvpRespondent(T2))
  })
  it('every submission (first, change, double-tap) carries the same key', async () => {
    await submitRsvp(T1, answer)
    await submitRsvp(T1, { ...answer, status: 'DECLINED', adults: 0, children: 0 })
    await Promise.all([submitRsvp(T1, answer), submitRsvp(T1, answer)])
    expect(new Set(sent.map((b) => b.respondent)).size).toBe(1)
    expect(lastRsvpName(T1)).toBe('The Nguyen family')
  })
  it('"RSVP for someone else" starts a new invitee', async () => {
    await submitRsvp(T1, answer)
    forgetRsvpRespondent(T1)
    expect(lastRsvpName(T1)).toBeNull()
    await submitRsvp(T1, { ...answer, name: 'The Garcia family' })
    expect(sent[0].respondent).not.toBe(sent[1].respondent)
  })
  it('keeps working (for this page session) when storage is blocked', async () => {
    storageBroken = true
    await submitRsvp(T2, answer)
    await submitRsvp(T2, { ...answer, status: 'MAYBE' })
    expect(sent[0].respondent).toBe(sent[1].respondent)
  })
})
