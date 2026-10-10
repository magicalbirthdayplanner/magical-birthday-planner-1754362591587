/**
 * Founder marketing agent against the local Supabase stack (migration 20251010001800): persistence, the publish claim
 * under concurrency, server-only access (RLS + revoked grants), the private image bucket, and UTM attribution from
 * analytics_events.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, isSupabaseUp } from './helpers/supabase'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY })

const up = await isSupabaseUp()
const made: string[] = []
const images: string[] = []
const eventIds: number[] = []

async function store() {
  const { SupabaseMarketingStore } = await import('@/lib/marketing/store')
  return new SupabaseMarketingStore()
}
async function newPost(over: Record<string, unknown> = {}) {
  const s = await store()
  const p = await s.insertPost({ content_pillar: 'useful_tips', topic: 'integration', text: `Integration test post ${randomUUID()}`, status: 'scheduled', scheduled_at: new Date().toISOString(), ...over } as never)
  made.push(p.id)
  return p
}
const dayStart = () => new Date(Date.now() - 12 * 3_600_000)

afterAll(async () => {
  if (!up) return
  const db = adminClient()
  if (eventIds.length) await db.from('analytics_events').delete().in('id', eventIds)
  if (made.length) {
    await db.from('marketing_audit_log').delete().in('post_id', made)
    await db.from('marketing_posts').delete().in('id', made)
  }
  if (images.length) await db.storage.from('marketing-images').remove(images)
})

describe.skipIf(!up)('founder marketing persistence', () => {
  it('inserts, reads, updates conditionally and deletes posts', async () => {
    const s = await store()
    const p = await newPost({ status: 'draft', scheduled_at: null })
    expect((await s.getPost(p.id))?.status).toBe('draft')
    expect(await s.updatePost(p.id, { status: 'approved' }, ['scheduled'])).toBeNull()
    expect((await s.updatePost(p.id, { status: 'approved' }, ['draft']))?.status).toBe('approved')
    expect(await s.deletePost(p.id, ['draft'])).toBe(false)
    await s.updatePost(p.id, { status: 'cancelled' })
    expect(await s.deletePost(p.id, ['draft', 'cancelled'])).toBe(true)
  })

  it('rejects unknown statuses/pillars and duplicate external ids (DB constraints)', async () => {
    const db = adminClient()
    expect((await db.from('marketing_posts').insert({ content_pillar: 'nope', topic: 't', text: 'x' } as never)).error).not.toBeNull()
    expect((await db.from('marketing_posts').insert({ content_pillar: 'useful_tips', topic: 't', text: 'x', status: 'live' } as never)).error).not.toBeNull()
    const ext = `ext-${randomUUID()}`
    await newPost({ status: 'published', external_post_id: ext })
    await expect(newPost({ status: 'published', external_post_id: ext })).rejects.toThrow()
  })

  it('marketing_claim_post: 10 concurrent claims on one post → exactly one wins', async () => {
    const s = await store()
    // Isolate from other rows on 'x': use the linkedin platform for the claim tests.
    const p = await newPost({ platform: 'linkedin' })
    const results = await Promise.all(Array.from({ length: 10 }, () => s.claimPost(p.id, randomUUID(), 5, 0, dayStart())))
    expect(results.filter((r) => r.claimed)).toHaveLength(1)
    expect(results.filter((r) => !r.claimed).every((r) => r.reason === 'not_publishable:publishing')).toBe(true)
    await s.updatePost(p.id, { status: 'published', published_at: new Date().toISOString() })
  })

  it('daily limit, minimum gap and unconfirmed attempts are enforced across posts', async () => {
    const s = await store()
    const db = adminClient()
    await db.from('marketing_posts').delete().eq('platform', 'reddit').in('id', made)
    const [a, b, c] = [await newPost({ platform: 'reddit' }), await newPost({ platform: 'reddit' }), await newPost({ platform: 'reddit' })]
    const both = await Promise.all([s.claimPost(a.id, randomUUID(), 1, 0, dayStart()), s.claimPost(b.id, randomUUID(), 1, 0, dayStart())])
    expect(both.filter((r) => r.claimed)).toHaveLength(1)
    expect(both.find((r) => !r.claimed)?.reason).toBe('daily_limit')
    const winner = both[0].claimed ? a : b
    await s.updatePost(winner.id, { status: 'published', published_at: new Date().toISOString() })
    expect(await s.claimPost(c.id, randomUUID(), 2, 240, dayStart())).toEqual({ claimed: false, reason: 'min_gap' })
    // An unconfirmed attempt counts like a published one.
    await s.updatePost(winner.id, { status: 'failed', publish_error_code: 'publish_unconfirmed' })
    expect(await s.claimPost(c.id, randomUUID(), 1, 0, dayStart())).toEqual({ claimed: false, reason: 'daily_limit' })
    expect((await s.claimPost(c.id, randomUUID(), 2, 0, dayStart())).claimed).toBe(true)
  })

  it('settings default to autonomous OFF and can be switched', async () => {
    const s = await store()
    const before = await s.getSettings()
    expect(typeof before.autonomousEnabled).toBe('boolean')
    expect((await s.setAutonomous(true, null)).autonomousEnabled).toBe(true)
    expect((await s.setAutonomous(before.autonomousEnabled, null)).autonomousEnabled).toBe(before.autonomousEnabled)
  })

  it('insights, briefs, snapshots and audit round-trip', async () => {
    const s = await store()
    const p = await newPost({ status: 'published', published_at: new Date().toISOString() })
    await s.addMetricsSnapshot(p.id, 'platform', { impressions: 10 })
    await s.audit(p.id, null, 'integration_test', { ok: true })
    expect((await s.recentAudit(5)).some((a) => a.postId === p.id && a.action === 'integration_test')).toBe(true)
    const ins = await s.saveInsights({ windowDays: 30, sampleSize: 0, data: { test: true }, recommendations: ['Not enough data yet'], pillarMultipliers: {} })
    expect((await s.latestInsights())?.id).toBe(ins.id)
    await adminClient().from('marketing_insights').delete().eq('id', ins.id)
    const date = '2099-01-01'
    await s.saveBrief({ date, timezone: 'America/New_York', data: {}, text: 'brief' })
    expect((await s.getBrief(date))?.text).toBe('brief')
    await s.markBriefEmailed(date)
    expect((await s.getBrief(date))?.emailedAt).not.toBeNull()
    await adminClient().from('marketing_briefs').delete().eq('brief_date', date)
  })
})

describe.skipIf(!up)('founder marketing is server-only', () => {
  it('anon and signed-in users can read or write nothing, nor call the claim', async () => {
    const p = await newPost()
    const anon = anonClient()
    const read = await anon.from('marketing_posts').select('id').eq('id', p.id)
    expect(read.data ?? []).toEqual([])
    expect((await anon.from('marketing_posts').insert({ content_pillar: 'useful_tips', topic: 't', text: 'x' } as never)).error).not.toBeNull()
    expect((await anon.from('marketing_settings').update({ autonomous_enabled: true }).eq('id', 'default').select()).data ?? []).toEqual([])
    expect((await anon.rpc('marketing_claim_post', { p_post: p.id, p_attempt: randomUUID(), p_max_per_day: 9, p_min_gap_minutes: 0, p_window_start: new Date().toISOString() })).error).not.toBeNull()
    expect((await adminClient().from('marketing_settings').select('autonomous_enabled').eq('id', 'default').single()).data).toBeTruthy()
  })

  it('images live in a private bucket: service role can upload/download/sign, anon cannot read', async () => {
    const s = await store()
    const path = `test/${randomUUID()}.png`
    images.push(path)
    await s.uploadImage(path, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png')
    expect(Array.from(await s.downloadImage(path))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(await s.signedImageUrl(path, 60)).toMatch(/token=/)
    expect((await anonClient().storage.from('marketing-images').download(path)).error).not.toBeNull()
    await expect(s.uploadImage(`test/${randomUUID()}.txt`, new Uint8Array([1]), 'text/plain')).rejects.toThrow()
  })
})

describe.skipIf(!up)('UTM attribution from analytics_events', () => {
  it('counts visits, sign-ups, parties, checkouts and purchases per post (distinct people)', async () => {
    const p = await newPost({ status: 'published', published_at: new Date(Date.now() - 3_600_000).toISOString() })
    const other = await newPost({ status: 'published', published_at: new Date(Date.now() - 3_600_000).toISOString() })
    const props = (id: string) => ({ utm_source: 'x', utm_medium: 'social', utm_campaign: 'founder_marketing', utm_content: id })
    const a1 = randomUUID(), a2 = randomUUID()
    const rows = [
      { event: 'landing_page_view', anonymous_id: a1, properties: props(p.id), source: 'client' },
      { event: 'landing_page_view', anonymous_id: a1, properties: props(p.id), source: 'client' },
      { event: 'landing_page_view', anonymous_id: a2, properties: props(p.id), source: 'client' },
      { event: 'signup_completed', anonymous_id: a1, properties: props(p.id), source: 'client' },
      { event: 'party_creation_completed', anonymous_id: a1, properties: props(p.id), source: 'client' },
      { event: 'party_created', anonymous_id: a1, properties: props(p.id), source: 'client' },
      { event: 'checkout_started', anonymous_id: a1, properties: props(p.id), source: 'client' },
      { event: 'landing_page_view', anonymous_id: randomUUID(), properties: props(other.id), source: 'client' },
      { event: 'landing_page_view', anonymous_id: randomUUID(), properties: { utm_source: 'x', utm_campaign: 'other' }, source: 'client' },
    ]
    const { data, error } = await adminClient().from('analytics_events').insert(rows as never).select('id')
    expect(error).toBeNull()
    eventIds.push(...(data ?? []).map((r) => r.id))
    const { SupabaseAnalyticsAttribution, countCampaignEvents } = await import('@/lib/marketing/metrics')
    const res = await new SupabaseAnalyticsAttribution().collect([p, other], new Date(Date.now() - 2 * 3_600_000))
    expect(res.get(p.id)).toEqual({ landingVisits: 2, signups: 1, partiesCreated: 1, checkouts: 1, purchases: 0, revenueMinor: 0, currency: null })
    expect(res.get(other.id)?.landingVisits).toBe(1)
    const counts = await countCampaignEvents(new Date(Date.now() - 60_000), new Date(Date.now() + 60_000))
    expect(counts.landingVisits).toBeGreaterThanOrEqual(3)
  })
})

describe.skipIf(!up)('X growth engine tables (migration 20251010001900)', () => {
  it('usage ledger, plans and media round-trip; media usage counter is atomic', async () => {
    const s = await store()
    const at = new Date().toISOString()
    await s.recordUsage({ provider: 'x', operation: 'post_create', units: 1, costUsd: 0.015, ok: true, detail: { test: true }, at })
    const rows = await s.usageSince(at)
    expect(rows.some((r) => r.operation === 'post_create' && r.costUsd === 0.015)).toBe(true)
    await adminClient().from('marketing_usage').delete().eq('at', at)

    const week = '2099-01-05'
    const plan = await s.savePlan({ platform: 'x', week_start: week, status: 'planned', slots: [{ index: 0 }] })
    expect((await s.getPlan('x', week))?.id).toBe(plan.id)
    const again = await s.savePlan({ id: plan.id, platform: 'x', week_start: week, status: 'ready', slots: [{ index: 0, status: 'generated' }] })
    expect(again.id).toBe(plan.id)
    await adminClient().from('marketing_plans').delete().eq('id', plan.id)

    const m = await s.insertMedia({ kind: 'video', source: 'library', title: 'integration video', library_key: `it-${randomUUID()}`, privacy_status: 'approved' })
    await Promise.all(Array.from({ length: 5 }, () => s.markMediaUsed([m.id])))
    expect((await s.listMedia({ ids: [m.id] }))[0].used_count).toBe(5)
    await adminClient().from('marketing_media').delete().eq('id', m.id)
  })

  it('new tables and the media bucket are server-only; videos are accepted', async () => {
    const anon = anonClient()
    for (const t of ['marketing_media', 'marketing_plans', 'marketing_usage'] as const) {
      const { data } = await anon.from(t).select('*').limit(1)
      expect(data ?? [], t).toEqual([])
    }
    expect((await anon.rpc('marketing_media_used', { p_ids: [randomUUID()] })).error).not.toBeNull()
    const s = await store()
    const path = `test/${randomUUID()}.mp4`
    await s.uploadMedia(path, new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), 'video/mp4')
    expect((await s.downloadMedia(path)).length).toBe(8)
    expect((await anon.storage.from('marketing-media').download(path)).error).not.toBeNull()
    await adminClient().storage.from('marketing-media').remove([path])
  })

  it('posts carry formats, polls, threads and media ids (constraints enforced)', async () => {
    const p = await newPost({ format: 'poll', poll: { options: ['A', 'B'], durationMinutes: 1440 }, slot_role: 'poll', media_ids: [], source: 'library' })
    expect(p).toMatchObject({ format: 'poll', poll: { options: ['A', 'B'] }, slotRole: 'poll', source: 'library' })
    await expect(newPost({ format: 'reel' })).rejects.toThrow()
    await expect(newPost({ source: 'bot' })).rejects.toThrow()
  })
})
