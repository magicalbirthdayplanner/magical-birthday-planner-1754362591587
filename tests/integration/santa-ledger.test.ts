/**
 * Santa minutes wallet + free previews (migration 20251122002400): the database decides who may start a Santa
 * session, for how long, and how much time it used. Browser timers and flags are never trusted.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { adminClient, anonClient, isSupabaseUp } from './helpers/supabase'

const up = await isSupabaseUp()
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const NOTICE = '2026-11-22.1'
const made: string[] = []
const previews: string[] = []
let savedSettings: Record<string, unknown> | null = null

const db = () => adminClient()
const hash = (s: string) => createHash('sha256').update(s).digest('hex')

async function parent(label: string, { consent = true, approved = true } = {}) {
  const address = `santa-${label}-${stamp}@test.invalid`
  const { data, error } = await db().auth.admin.createUser({ email: address, password: `pw-${stamp}-A1!`, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('createUser failed')
  made.push(data.user.id)
  const { data: child } = await db().from('santa_children').insert({ user_id: data.user.id, first_name: 'Emma', age: 6, approved_at: approved ? new Date().toISOString() : null }).select('id').single()
  if (consent) await db().from('santa_consents').insert({ user_id: data.user.id, notice_version: NOTICE, affirmations: ['parent_or_guardian'], method: 'signed_in_parent_checkbox' })
  return { user: data.user.id, child: child!.id, email: address }
}
const pay = (user: string, ref: string, seconds = 180, status = 'active') =>
  db().from('santa_orders').insert({ user_id: user, provider_ref: `${ref}-${stamp}`, pack: 'SANTA_TIME', status, quantity: Math.max(1, Math.min(10, Math.round(seconds / 180))), seconds_granted: seconds }).select('id').single()
const start = (user: string, child: string) =>
  db().rpc('santa_start_session', { p_user: user, p_child: child, p_notice_version: NOTICE, p_provider: 'mock', p_prompt_version: 'test' })
const preview = (client: string) =>
  db().rpc('santa_start_preview', { p_client_hash: hash(client), p_token_hash: hash(randomUUID()), p_provider: 'mock', p_prompt_version: 'test' })
const end = (session: string, reason: string, status: 'ended' | 'failed' = 'ended') =>
  db().rpc('santa_end_session', { p_session: session, p_status: status, p_ended_at: new Date().toISOString(), p_reason: reason, p_billed_seconds: null as never, p_cost_cents: null as never })
async function connectedAgo(session: string, secondsAgo: number) {
  await db().rpc('santa_mark_connected', { p_session: session, p_at: new Date(Date.now() - secondsAgo * 1000).toISOString() })
}
const balance = async (user: string) => (await db().rpc('santa_balance', { p_user: user })).data![0]

beforeAll(async () => {
  if (!up) return
  savedSettings = (await db().from('santa_settings').select('*').eq('id', true).single()).data
  await db().from('santa_settings').update({ calls_enabled: true, previews_enabled: true, max_concurrent_sessions: 100, daily_session_cap: 100000, previews_per_client_per_day: 2, daily_preview_cap: 100000, min_charge_seconds: 15, preview_seconds: 30, max_call_seconds: 600 }).eq('id', true)
})
afterAll(async () => {
  if (!up) return
  // Close this suite's open sessions so they don't count against the shared concurrency cap afterwards.
  const ids = [...previews]
  if (made.length) {
    const { data } = await db().from('santa_sessions').select('id').in('user_id', made)
    ids.push(...(data ?? []).map((r) => r.id))
  }
  if (ids.length) {
    const { data: open } = await db().from('santa_sessions').select('id').in('id', ids).in('status', ['reserved', 'connecting', 'active'])
    for (const s of open ?? []) await end(s.id, 'no_connect', 'failed')
  }
  if (savedSettings) await db().from('santa_settings').update(savedSettings).eq('id', true)
  await Promise.all(made.splice(0).map((id) => db().auth.admin.deleteUser(id)))
})

describe.skipIf(!up)('Santa minutes wallet', () => {
  it('needs consent, approval and time', async () => {
    const a = await parent('noconsent', { consent: false })
    expect((await start(a.user, a.child)).error?.message).toBe('consent_required')
    const b = await parent('notapproved', { approved: false })
    expect((await start(b.user, b.child)).error?.message).toBe('not_approved')
    const c = await parent('notime')
    expect((await start(c.user, c.child)).error?.message).toBe('no_credit')
    await pay(c.user, 'pending', 180, 'pending')
    expect((await start(c.user, c.child)).error?.message).toBe('no_credit')
    await pay(c.user, 'paid')
    const { data, error } = await start(c.user, c.child)
    expect(error).toBeNull()
    expect(data).toMatchObject({ kind: 'call', status: 'reserved', max_seconds: 180 })
  })

  it('editing the child clears approval', async () => {
    const p = await parent('edit')
    await pay(p.user, 'edit')
    await db().from('santa_children').update({ profile: { loves: ['dinosaurs'] } }).eq('id', p.child)
    expect((await start(p.user, p.child)).error?.message).toBe('not_approved')
  })

  it('a call may use the whole balance (top-ups add up), capped per call', async () => {
    const p = await parent('topup')
    await pay(p.user, 'first')
    await pay(p.user, 'topup', 360)
    expect(await balance(p.user)).toMatchObject({ seconds_remaining: 540 })
    expect((await start(p.user, p.child)).data!.max_seconds).toBe(540)
    const q = await parent('cap')
    await pay(q.user, 'big', 1800)
    expect((await start(q.user, q.child)).data!.max_seconds).toBe(600)
  })

  it('charges only connected seconds; a drop keeps the rest for the next call', async () => {
    const p = await parent('drop')
    await pay(p.user, 'drop')
    const { data: s1 } = await start(p.user, p.child)
    await connectedAgo(s1!.id, 70)
    const { data: e1 } = await end(s1!.id, 'dropped')
    expect(e1).toMatchObject({ status: 'ended', connected_seconds: 70, charged_seconds: 70 })
    expect(await balance(p.user)).toMatchObject({ seconds_used: 70, seconds_remaining: 110 })
    const { data: s2 } = await start(p.user, p.child)
    expect(s2!.max_seconds).toBe(110)
  })

  it('a call that never connects, or lasts under 15 s, is free', async () => {
    const p = await parent('free')
    await pay(p.user, 'free')
    const { data: s1 } = await start(p.user, p.child)
    expect((await end(s1!.id, 'no_connect', 'failed')).data).toMatchObject({ status: 'failed', charged_seconds: 0 })
    const { data: s2 } = await start(p.user, p.child)
    await connectedAgo(s2!.id, 10)
    expect((await end(s2!.id, 'parent_ended')).data).toMatchObject({ connected_seconds: 10, charged_seconds: 0 })
    expect(await balance(p.user)).toMatchObject({ seconds_remaining: 180 })
  })

  it('never charges more than the call was allowed, and ending twice changes nothing', async () => {
    const p = await parent('cap2')
    await pay(p.user, 'cap2')
    const { data: s } = await start(p.user, p.child)
    await connectedAgo(s!.id, 999)
    await end(s!.id, 'time_up')
    await end(s!.id, 'time_up')
    expect(await balance(p.user)).toMatchObject({ seconds_used: 180, seconds_remaining: 0 })
    expect((await start(p.user, p.child)).error?.message).toBe('no_credit')
  })

  it('one live session per parent; another parent’s child is refused', async () => {
    const a = await parent('one-a')
    const b = await parent('one-b')
    await pay(a.user, 'one')
    expect((await start(a.user, b.child)).error?.message).toBe('child_not_found')
    expect((await start(a.user, a.child)).error).toBeNull()
    expect((await start(a.user, a.child)).error?.message).toBe('session_in_progress')
  })

  it('a refunded order stops counting', async () => {
    const p = await parent('refund')
    const { data: o } = await pay(p.user, 'rf')
    await db().from('santa_orders').update({ status: 'refunded' }).eq('id', o!.id)
    expect((await start(p.user, p.child)).error?.message).toBe('no_credit')
  })

  it('the kill switch stops new sessions', async () => {
    const p = await parent('kill')
    await pay(p.user, 'kill')
    await db().from('santa_settings').update({ calls_enabled: false }).eq('id', true)
    try {
      expect((await start(p.user, p.child)).error?.message).toBe('calls_disabled')
      expect((await preview(`kill-${stamp}`)).error?.message).toBe('calls_disabled')
    } finally {
      await db().from('santa_settings').update({ calls_enabled: true }).eq('id', true)
    }
  })

  it('clients cannot write the ledger or call the RPCs', async () => {
    const p = await parent('client')
    const client = anonClient()
    await client.auth.signInWithPassword({ email: p.email, password: `pw-${stamp}-A1!` })
    expect((await client.from('santa_orders').insert({ user_id: p.user, provider_ref: `x-${stamp}`, pack: 'SANTA_TIME', status: 'active', seconds_granted: 9999 })).error).not.toBeNull()
    expect((await client.rpc('santa_start_session', { p_user: p.user, p_child: p.child, p_notice_version: NOTICE, p_provider: 'mock', p_prompt_version: 'x' })).error).not.toBeNull()
    expect((await anonClient().rpc('santa_start_preview', { p_client_hash: hash('x'), p_token_hash: hash('y'), p_provider: 'mock', p_prompt_version: 'x' })).error).not.toBeNull()
    expect((await client.from('santa_settings').select('*')).data ?? []).toEqual([])
    expect((await client.from('santa_children').select('id')).data).toEqual([{ id: p.child }])
  })
})

describe.skipIf(!up)('free previews (no sign-up)', () => {
  it('are 30 seconds, anonymous, never charged', async () => {
    const { data: s, error } = await preview(`a-${stamp}`)
    expect(error).toBeNull()
    previews.push(s!.id)
    expect(s).toMatchObject({ kind: 'preview', user_id: null, child_id: null, max_seconds: 30 })
    await connectedAgo(s!.id, 30)
    expect((await end(s!.id, 'time_up')).data).toMatchObject({ connected_seconds: 30, charged_seconds: 0 })
  })

  it('are limited per client per day (failed ones don’t count)', async () => {
    const client = `b-${stamp}`
    const { data: f } = await preview(client)
    previews.push(f!.id)
    await end(f!.id, 'no_connect', 'failed')
    for (let i = 0; i < 2; i++) {
      const { data, error } = await preview(client)
      expect(error).toBeNull()
      previews.push(data!.id)
      await connectedAgo(data!.id, 20)
      await end(data!.id, 'time_up')
    }
    expect((await preview(client)).error?.message).toBe('preview_limit')
    const other = await preview(`c-${stamp}`)
    expect(other.error).toBeNull()
    previews.push(other.data!.id)
  })

  it('stop when previews are switched off', async () => {
    await db().from('santa_settings').update({ previews_enabled: false }).eq('id', true)
    try {
      expect((await preview(`d-${stamp}`)).error?.message).toBe('previews_disabled')
    } finally {
      await db().from('santa_settings').update({ previews_enabled: true }).eq('id', true)
    }
  })
})
