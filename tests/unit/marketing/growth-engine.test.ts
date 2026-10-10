/**
 * X growth engine: budget ledger + guards, weekly planner, daily batch generation (one AI call), library fallback,
 * formats (polls, threads, carousels, video), product-name fix, privacy, scoring, decisions, and the evergreen library.
 * No network: mock AI, fake X, in-memory store.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAIConfig } from '@/lib/ai/config'
import { mockCalls, resetMock, scriptMock } from '@/lib/ai/providers/mock'
import { generateDay } from '@/lib/marketing/batch'
import { allowX, budgetSnapshot, estimatePostCost, xMeter, xPrices } from '@/lib/marketing/budget'
import { readMarketingConfig, xUserIdFromEnv, type MarketingConfig } from '@/lib/marketing/config'
import { computeDecisions } from '@/lib/marketing/learning'
import { LIBRARY } from '@/lib/marketing/library'
import { planSlots, planWeek, weekStartOf } from '@/lib/marketing/planner'
import { XMarketingProvider } from '@/lib/marketing/providers/x'
import type { AccountInfo, MarketingProvider, PublishInput } from '@/lib/marketing/providers/types'
import { publishPost } from '@/lib/marketing/publish'
import { businessScore } from '@/lib/marketing/scoring'
import type { MarketingPost, PlatformMetrics } from '@/lib/marketing/types'
import { claimIssues, fixProductName, pollIssues, validatePost } from '@/lib/marketing/validation'
import { MemoryMarketingStore } from '../../helpers/marketing-memory-store'

const NOW = new Date('2026-10-19T10:00:00Z') // Monday 06:00 EDT
const cfg = (env: Record<string, string> = {}): MarketingConfig => readMarketingConfig(env)
let store: MemoryMarketingStore

class FakeX implements MarketingProvider {
  readonly platform = 'x' as const
  readonly maxChars = 280
  posted: PublishInput[] = []
  configured() { return true }
  setMeter() {}
  async verify(): Promise<AccountInfo> { return { id: '1', username: 'b', name: null } }
  async uploadImage() { return 'm' }
  async uploadVideo() { return 'v' }
  async createPost() { return { externalId: '1', url: 'u' } }
  async publish(input: PublishInput) {
    this.posted.push(input)
    return { externalId: `19000000000000${this.posted.length}`, url: 'https://x.com/b/status/1', mediaId: input.media && (input.media as unknown[]).length ? 'm1' : null, mediaIds: [], threadIds: (input.thread ?? []).map((_, i) => `t${i}`) }
  }
  async getMetrics() { return new Map<string, PlatformMetrics>() }
  async getOwnPosts() { return [] }
}

/** Mock AI for batch prompts: valid items shaped by each slot's format (distinct per slot). */
const IDEAS = [
  ['I deleted most of my first prototype instead of patching it.', 'Simpler won.'],
  ['Before you send invitations, lock down the date, the place and a realistic headcount.'],
  ['What is the one birthday task you wish someone else would just handle?'],
  ['Birthday planning is rarely one big decision. It is twenty small ones.'],
  ['Pacing a kids party: active, then calm, then active again.'],
  ['Guests can answer an invitation from a link in Magical Birthday Planner, no account needed.'],
  ['Which party theme wins at your house this year?'],
  ['Planning a birthday soon? Try planning it in one place and tell me what is missing.'],
]
function batchReply(override?: (slot: number, i: number) => Record<string, unknown> | null) {
  const n = 0
  return (req: { messages: { content: string }[] }) => {
    const prompt = req.messages[1].content
    const slots = [...prompt.matchAll(/SLOT (\d+) — [^\n]*\n[^\n]*\n\s*Format: ([A-Z" ]+)/g)].map((m) => ({ slot: Number(m[1]), format: m[2] }))
    return JSON.stringify({
      posts: slots.map(({ slot, format }, i) => {
        const custom = override?.(slot, i)
        if (custom) return { slot, ...custom }
        const idea = IDEAS[(slot + n) % IDEAS.length]
        return {
          slot, paragraphs: [`${idea[0]} (${slot})`, ...(idea[1] ? [idea[1]] : [])], hook: idea[0], topic: `topic ${slot}`, cta: null, factsUsed: [],
          card: /IMAGE|CAROUSEL/.test(format) ? { headline: `Card headline ${slot}`, bullets: ['Pick the date', 'Count the kids', 'Set the budget'], left: 'Home', right: 'Venue' } : null,
          poll: format.startsWith('POLL') ? { options: ['Venue', 'Guest list', 'Budget'] } : null,
          thread: format.startsWith('THREAD') ? ['2/ Second part of the story here.', '3/ Third and last part of it.'] : null,
        }
      }),
    })
  }
}

beforeEach(() => {
  Object.assign(process.env, { AI_PROVIDER: 'mock', AI_ENABLED: 'true' })
  resetAIConfig()
  resetMock()
  store = new MemoryMarketingStore()
  store.clock = () => NOW
})
afterEach(() => {
  delete process.env.AI_PROVIDER
  resetAIConfig()
})

describe('budget', () => {
  it('prices follow the X rate card and can be overridden', () => {
    expect(xPrices({})).toMatchObject({ post_create: 0.015, post_create_url: 0.2, owned_read: 0.001, media_metadata: 0.005 })
    expect(xPrices({ MARKETING_X_PRICE_POST_CREATE: '0.02' }).post_create).toBe(0.02)
  })
  it('estimates a post: base, link premium, thread parts, alt text', () => {
    const p = xPrices({})
    expect(estimatePostCost({ linkUrl: null, threadParts: null, mediaIds: [], imagePath: null }, p)).toBe(0.015)
    expect(estimatePostCost({ linkUrl: 'https://x', threadParts: null, mediaIds: [], imagePath: null }, p)).toBe(0.2)
    expect(estimatePostCost({ linkUrl: null, threadParts: ['a', 'b'], mediaIds: ['m1', 'm2'], imagePath: null }, p, true)).toBe(0.055)
  })
  it('8 posts/day fits $5 at the plain-post price; links do not', async () => {
    const b = await budgetSnapshot(store, cfg(), NOW, {})
    expect(b.x.status).toBe('GREEN')
    expect(b.x.projected).toBeLessThan(5)
    expect(allowX(b, 0.015, 'core').ok).toBe(true)
    expect(allowX(b, 0.185, 'discretionary').ok).toBe(true)
    // A month of 20 link posts would not fit.
    expect(allowX(b, 20 * 0.185, 'discretionary').ok).toBe(false)
  })
  it('never exceeds the hard cap; RED blocks discretionary spend; the daily allowance spreads posts over the month', async () => {
    await store.recordUsage({ provider: 'x', operation: 'post_create', units: 1, costUsd: 4.74, ok: true, at: '2026-10-02T12:00:00Z' })
    const b = await budgetSnapshot(store, cfg(), NOW, {})
    expect(b.x.status).toBe('RED')
    expect(allowX(b, 0.015, 'core')).toMatchObject({ ok: false, reason: 'x_budget_exhausted' })
    expect(allowX(b, 0.001, 'discretionary').ok).toBe(false)
    store.usage.length = 0
    for (let i = 0; i < 40; i++) await store.recordUsage({ provider: 'x', operation: 'post_create', units: 1, costUsd: 0.015, ok: true, at: NOW.toISOString() })
    const t = await budgetSnapshot(store, cfg(), NOW, {})
    expect(t.x.today).toBeCloseTo(0.6, 5)
    expect(allowX(t, 0.015, 'core')).toMatchObject({ ok: false, reason: 'x_daily_allowance' })
  })
  it('failed calls cost nothing; the meter writes the ledger', async () => {
    const meter = xMeter(store, xPrices({}), 'post-1')
    await meter('post_create_url', 1, true)
    await meter('owned_read', 16, true)
    await meter('post_create', 1, false)
    expect(store.usage.map((u) => [u.operation, u.costUsd])).toEqual([['post_create_url', 0.2], ['owned_read', 0.016], ['post_create', 0]])
  })
  it('the X user id comes from the access-token prefix (no API call)', () => {
    expect(xUserIdFromEnv({ X_ACCESS_TOKEN: '1951116851649376257-abc' })).toBe('1951116851649376257')
    expect(xUserIdFromEnv({ X_ACCESS_TOKEN: 'abc' })).toBeNull()
  })
})

describe('weekly planner', () => {
  it('plans 56 slots: 8 roles a day in the recommended order, no AI, idempotent', async () => {
    const b = await budgetSnapshot(store, cfg(), NOW, {})
    const plan = await planWeek(store, cfg(), { weekStart: '2026-10-19', now: NOW, budget: b })
    const slots = planSlots(plan)
    expect(slots).toHaveLength(56)
    expect(slots.slice(0, 8).map((s) => s.role)).toEqual(['founder_story', 'parent_tip', 'conversation', 'visual', 'educational', 'product', 'poll', 'soft_conversion'])
    expect(slots.slice(0, 8).map((s) => s.time)).toEqual(['08:00', '10:30', '12:30', '14:30', '16:30', '18:00', '19:30', '21:00'])
    expect(slots[0].at).toBe('2026-10-19T12:00:00.000Z')
    const share = (f: string) => slots.filter((s) => s.format === f).length / 56
    expect(share('text')).toBeGreaterThanOrEqual(0.3)
    expect(share('poll')).toBeCloseTo(0.125, 2)
    expect(slots.filter((s) => s.thread).length).toBeLessThanOrEqual(1)
    // No library seeded → video/carousel slots fall back to free branded cards.
    expect(slots.every((s) => s.media.source !== 'library')).toBe(true)
    expect(mockCalls()).toHaveLength(0)
    expect(planSlots(await planWeek(store, cfg(), { weekStart: '2026-10-19', now: NOW, budget: b }))[3].topicKey).toBe(slots[3].topicKey)
  })
  it('links: only what the budget absorbs, at most one a day, only on soft-conversion slots', async () => {
    const roomy = await budgetSnapshot(store, cfg(), NOW, {})
    const slots = planSlots(await planWeek(store, cfg(), { weekStart: '2026-10-19', now: NOW, budget: roomy }))
    const linked = slots.filter((s) => s.link)
    expect(linked.length).toBeGreaterThan(0)
    expect(linked.every((s) => s.role === 'soft_conversion')).toBe(true)
    expect(new Set(linked.map((s) => s.date)).size).toBe(linked.length)
    await store.recordUsage({ provider: 'x', operation: 'post_create', units: 1, costUsd: 3, ok: true, at: '2026-10-02T12:00:00Z' })
    const tight = await budgetSnapshot(store, cfg(), NOW, {})
    expect(planSlots(await planWeek(store, cfg(), { weekStart: '2026-10-26', now: NOW, budget: tight })).filter((s) => s.link)).toHaveLength(0)
  })
  it('reuses approved library media, never twice in a week, never rejected media', async () => {
    for (let i = 0; i < 3; i++) await store.insertMedia({ kind: 'video', source: 'library', title: `Video ${i}`, storage_path: `library/v${i}.mp4`, mime_type: 'video/mp4', privacy_status: 'approved' })
    await store.insertMedia({ kind: 'video', source: 'library', title: 'Rejected', storage_path: 'library/bad.mp4', mime_type: 'video/mp4', privacy_status: 'rejected' })
    const slots = planSlots(await planWeek(store, cfg(), { weekStart: '2026-10-19', now: NOW, budget: null }))
    const vids = slots.filter((s) => s.media.source === 'library').flatMap((s) => s.media.libraryIds!)
    expect(vids).toHaveLength(3)
    expect(new Set(vids).size).toBe(3)
    const rejected = [...store.media.values()].find((m) => m.privacy_status === 'rejected')!
    expect(vids).not.toContain(rejected.id)
  })
  it('3–4 posts/day: founder story + engagement pair (a poll every other day) + soft conversion', async () => {
    const c4 = cfg({ MARKETING_POSTS_PER_DAY: '4', MARKETING_POST_TIMES: '09:00,12:30,17:00,20:00' })
    const slots = planSlots(await planWeek(store, c4, { weekStart: '2026-10-19', now: NOW, budget: null }))
    expect(slots).toHaveLength(28)
    for (let d = 0; d < 7; d++) {
      const day = slots.filter((s) => s.date === slots[d * 4].date)
      expect(day[0].role).toBe('founder_story')
      expect(day[3].role).toBe('soft_conversion')
      expect(day.map((s) => s.time)).toEqual(['09:00', '12:30', '17:00', '20:00'])
    }
    expect(slots.filter((s) => s.role === 'poll')).toHaveLength(4)
    expect(slots.filter((s) => s.role === 'conversation')).toHaveLength(3)
  })

  it('learning weights swap weak roles for strong ones on alternate days', async () => {
    const slots = planSlots(await planWeek(store, cfg(), { weekStart: '2026-10-19', now: NOW, budget: null, weights: { roles: { poll: 0.5, founder_story: 1.5 } } }))
    expect(slots.filter((s) => s.role === 'poll').length).toBeLessThan(7)
    expect(slots.filter((s) => s.role === 'founder_story').length).toBeGreaterThan(7)
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19')
  })
})

describe('daily batch generation', () => {
  it('ONE model call writes the whole day: 8 validated posts, polls, cards, scheduled at their slots', async () => {
    scriptMock(batchReply())
    await store.setAutonomous(true)
    const r = await generateDay(store, cfg({ AUTONOMOUS_PUBLISHING: 'true' }), { date: '2026-10-19', now: NOW, env: {} })
    expect(r.aiCalls).toBe(1)
    expect(r.generated).toHaveLength(8)
    expect(r.skipped).toEqual([])
    const posts = [...store.rows.values()].sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    expect(posts.every((p) => p.status === 'scheduled')).toBe(true)
    const poll = posts.find((p) => p.format === 'poll')!
    expect(poll.poll).toEqual({ options: ['Venue', 'Guest list', 'Budget'], durationMinutes: 1440 })
    const carousel = posts.find((p) => p.format === 'carousel')!
    expect(carousel.media_ids.length).toBeGreaterThanOrEqual(3)
    expect(store.mediaFiles.size).toBeGreaterThan(3)
    expect(store.usage.filter((u) => u.provider === 'ai')).toHaveLength(1)
    // Idempotent: a second run writes nothing and calls no model.
    const again = await generateDay(store, cfg(), { date: '2026-10-19', now: NOW, env: {} })
    expect(again.aiCalls).toBe(0)
    expect(store.rows.size).toBe(8)
  }, 30_000)

  it('rejected items get ONE repair call; still-bad ones fall back to the free library', async () => {
    scriptMock(
      batchReply((slot, i) => (i === 0 ? { paragraphs: ['Over 500 parents already use it, trusted by families everywhere.'], hook: 'Over 500 parents already use it.', topic: 'claims', factsUsed: [] } : null)),
      batchReply(() => ({ paragraphs: ['Hundreds of parents love this planner.'], hook: 'Hundreds of parents love this.', topic: 'claims again', factsUsed: [] })),
    )
    const r = await generateDay(store, cfg(), { date: '2026-10-19', now: NOW, env: {} })
    expect(r.aiCalls).toBe(2)
    expect(mockCalls()[1].messages[1].content).toMatch(/YOUR PREVIOUS VERSION WAS REJECTED/)
    expect(r.generated).toHaveLength(7)
    expect(r.library).toHaveLength(1)
    const lib = [...store.rows.values()].find((p) => p.source === 'library')!
    expect(lib.topic_key).toMatch(/^lib:/)
  }, 30_000)

  it('no AI budget → zero model calls, the day is filled from the library', async () => {
    await store.recordUsage({ provider: 'ai', operation: 'batch_generate', units: 1, costUsd: 2, ok: true, at: '2026-10-10T00:00:00Z' })
    const r = await generateDay(store, cfg(), { date: '2026-10-19', now: NOW, env: {} })
    expect(r.aiCalls).toBe(0)
    expect(r.aiSkipped).toBe('ai_budget_exhausted')
    expect(r.library.length).toBeGreaterThan(4)
    expect(mockCalls()).toHaveLength(0)
  }, 30_000)

  it('two items with the same idea in one batch: only the first survives', async () => {
    scriptMock(
      batchReply((slot, i) => (i < 2 ? { paragraphs: ['Planning a birthday is stressful because you need so many browser tabs.'], hook: 'Planning a birthday is stressful because you need so many browser tabs.', topic: 'tabs', factsUsed: [] } : null)),
      batchReply(),
    )
    const r = await generateDay(store, cfg(), { date: '2026-10-19', now: NOW, env: {} })
    const tabs = [...store.rows.values()].filter((p) => /browser tabs/.test(p.text))
    expect(tabs).toHaveLength(1)
    expect(r.generated.length + r.library.length).toBe(8)
  }, 30_000)
})

describe('publishing formats + guards', () => {
  const seed = (over: Record<string, unknown>) => store.seed({ content_pillar: 'community_question', topic: 't', text: 'Which party theme wins at your house this year?', status: 'scheduled', scheduled_at: NOW.toISOString(), ...over })
  const live = () => cfg({ MARKETING_DRY_RUN: 'false' })

  it('polls and threads go to X as polls and replies', async () => {
    const x = new FakeX()
    const poll = seed({ format: 'poll', poll: { options: ['Superheroes', 'Animals'], durationMinutes: 1440 } })
    expect(await publishPost(poll.id, 'manual', { store, provider: x, cfg: live(), env: {} }, { now: NOW })).toMatchObject({ ok: true })
    expect(x.posted[0].poll).toEqual({ options: ['Superheroes', 'Animals'], durationMinutes: 1440 })
    const thread = seed({ content_pillar: 'founder_journey', text: 'Three things I learned building a birthday planner. A short thread.', format: 'thread', thread_parts: ['2/ Parents need fewer things to manage.', '3/ Honest beats impressive.'] })
    store.clock = () => new Date(NOW.getTime() + 20 * 60_000)
    await publishPost(thread.id, 'manual', { store, provider: x, cfg: live(), env: {} }, { now: new Date(NOW.getTime() + 20 * 60_000) })
    expect(x.posted[1].thread).toHaveLength(2)
    expect((await store.getPost(thread.id))!.externalThreadIds).toEqual(['t0', 't1'])
  })

  it('fixes the product name before publishing', async () => {
    const x = new FakeX()
    const p = seed({ content_pillar: 'founder_journey', text: 'Why I started building Magical Birthday Plannner: one party, too many tabs.' })
    await publishPost(p.id, 'manual', { store, provider: x, cfg: live(), env: {} }, { now: NOW })
    expect(x.posted[0].text).toBe('Why I started building Magical Birthday Planner: one party, too many tabs.')
    expect(store.auditLog.map((a) => a.action)).toContain('product_name_fixed')
  })

  it('never publishes unapproved media', async () => {
    const x = new FakeX()
    const m = await store.insertMedia({ kind: 'image', source: 'library', title: 'unchecked', storage_path: 'library/u.png', mime_type: 'image/png', privacy_status: 'pending' })
    await store.uploadMedia('library/u.png', new Uint8Array([1]), 'image/png')
    const p = seed({ content_pillar: 'parent_pain', text: 'Birthday planning is twenty small decisions before breakfast.', format: 'image', media_ids: [m.id] })
    expect(await publishPost(p.id, 'manual', { store, provider: x, cfg: live(), env: {} }, { now: NOW })).toMatchObject({ ok: false, reason: 'media' })
    expect(x.posted).toHaveLength(0)
  })

  it('drops an unaffordable link instead of overspending; skips when the budget is gone', async () => {
    const x = new FakeX()
    const id = '00000000-0000-4000-8000-000000000001'
    const link = `https://magicalbirthdayplanner.app/?utm_source=x&utm_medium=social&utm_campaign=mbp_x_growth&utm_content=${id}`
    await store.recordUsage({ provider: 'x', operation: 'post_create', units: 1, costUsd: 4.5, ok: true, at: '2026-10-02T12:00:00Z' })
    seed({ id, content_pillar: 'launch_invitation', text: `Planning a birthday soon? Try planning it in one place.\n\n${link}`, link_url: link })
    expect(await publishPost(id, 'manual', { store, provider: x, cfg: live(), env: {} }, { now: NOW })).toMatchObject({ ok: true })
    expect(x.posted[0].text).toBe('Planning a birthday soon? Try planning it in one place.')
    expect(store.auditLog.map((a) => a.action)).toContain('link_dropped_budget')
    await store.recordUsage({ provider: 'x', operation: 'post_create', units: 1, costUsd: 0.5, ok: true, at: '2026-10-03T12:00:00Z' })
    const q = seed({ text: 'What is the one birthday task you wish someone else would handle?' })
    store.clock = () => new Date(NOW.getTime() + 20 * 60_000)
    expect(await publishPost(q.id, 'manual', { store, provider: x, cfg: live(), env: {} }, { now: new Date(NOW.getTime() + 20 * 60_000) })).toMatchObject({ ok: false, reason: 'x_budget_exhausted' })
    expect(x.posted).toHaveLength(1)
  })
})

describe('X provider: formats and metering', () => {
  const CREDS = { consumerKey: 'k', consumerSecret: 's', token: '1951116851649376257-t', tokenSecret: 'ts' }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('video: initialize → append (4 MB chunks) → finalize → status → post; every call metered', async () => {
    const calls: string[] = []
    let status = 0
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      calls.push(`${init?.method} ${u.replace('https://x.test', '')}`)
      if (u.endsWith('/initialize')) return json(200, { data: { id: '77' } })
      if (u.includes('/append')) return new Response(null, { status: 204 })
      if (u.endsWith('/finalize')) return json(200, { data: { id: '77', processing_info: { state: 'pending', check_after_secs: 1 } } })
      if (u.includes('command=STATUS')) return json(200, { data: { processing_info: { state: status++ ? 'succeeded' : 'in_progress', check_after_secs: 1 } } })
      return json(201, { data: { id: '500' } })
    }) as unknown as typeof fetch
    const ops: string[] = []
    const p = new XMarketingProvider({ credentials: CREDS, maxChars: 280, baseUrl: 'https://x.test', fetchImpl: f, sleep: async () => undefined, meter: async (op, units) => void ops.push(`${op}×${units}`) })
    const r = await p.publish({ text: 'Our 4-week birthday countdown, in 36 seconds.', media: { bytes: new Uint8Array(9 * 1024 * 1024), mimeType: 'video/mp4' } })
    expect(r.mediaIds).toEqual(['77'])
    expect(calls.filter((c) => c.includes('/append'))).toHaveLength(3)
    expect(calls.at(-1)).toBe('POST /2/tweets')
    expect(ops.at(-1)).toBe('post_create×1')
  })

  it('a link (even a bare domain) is billed as post_create_url; polls and replies are sent as such', async () => {
    const bodies: unknown[] = []
    const f = vi.fn(async (_u: unknown, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return json(201, { data: { id: String(bodies.length) } }) }) as unknown as typeof fetch
    const ops: string[] = []
    const p = new XMarketingProvider({ credentials: CREDS, maxChars: 280, baseUrl: 'https://x.test', fetchImpl: f, meter: async (op) => void ops.push(op) })
    await p.createPost({ text: 'See magicalbirthdayplanner.app' })
    await p.publish({ text: 'Which theme wins?', poll: { options: ['A', 'B'], durationMinutes: 1440 }, thread: ['2/ more'] })
    expect(ops).toEqual(['post_create_url', 'post_create', 'post_create'])
    expect(bodies[1]).toEqual({ text: 'Which theme wins?', poll: { options: ['A', 'B'], duration_minutes: 1440 } })
    expect(bodies[2]).toEqual({ text: '2/ more', reply: { in_reply_to_tweet_id: '2' } })
  })

  it('own posts use the cheaper owned-read endpoint and are metered per post returned', async () => {
    let url = ''
    const f = vi.fn(async (u: string | URL | Request) => { url = String(u); return json(200, { data: [{ id: '9', text: 'hi', public_metrics: { like_count: 2, impression_count: 50 } }, { id: '10', text: 'yo' }] }) }) as unknown as typeof fetch
    const ops: string[] = []
    const p = new XMarketingProvider({ credentials: CREDS, maxChars: 280, baseUrl: 'https://x.test', fetchImpl: f, meter: async (op, units) => void ops.push(`${op}×${units}`) })
    const own = await p.getOwnPosts('1951116851649376257', { startTime: '2026-10-18T00:00:00.000Z', maxResults: 20 })
    expect(url).toContain('/2/users/1951116851649376257/tweets?max_results=20')
    expect(url).toContain('start_time=2026-10-18')
    expect(own[0].metrics).toMatchObject({ likes: 2, impressions: 50 })
    expect(ops).toEqual(['owned_read×2'])
  })
})

describe('scoring and decisions', () => {
  const post = (over: Partial<MarketingPost> & { m?: Partial<PlatformMetrics>; signups?: number }, i: number): MarketingPost => ({
    id: `p${i}`, platform: 'x', status: 'published', source: 'ai', publishedAt: '2026-10-15T14:00:00Z', businessScore: null, estCostUsd: 0.015, slotRole: 'founder_story', format: 'text', category: 'founder_stories', hook: 'I built this.', text: 'I built this.', cta: null,
    metrics: { impressions: 1000, likes: 10, reposts: 0, replies: 0, quotes: 0, bookmarks: 0, profileVisits: 5, linkClicks: 0, ...over.m },
    attribution: { landingVisits: 0, signups: over.signups ?? 0, partiesCreated: 0, checkouts: 0, purchases: 0, revenueMinor: 0, currency: null },
    ...over,
  }) as MarketingPost
  const w = readMarketingConfig({}).scoreWeights

  it('demand beats likes: 6 sign-ups outrank a 20k-impression poll', () => {
    const poll = businessScore(post({ m: { impressions: 20_000, likes: 500 } }, 1), w)
    const story = businessScore(post({ m: { impressions: 4_000, likes: 70 }, signups: 6 }, 2), w)
    expect(story).toBeGreaterThan(poll)
    // The literal "impressions × 0.10 …" weights can be configured — and would rank the poll first.
    const literal = readMarketingConfig({ MARKETING_SCORE_WEIGHTS: '{"impressions":0.1,"engagements":0.2,"profileVisits":0.2,"linkClicks":0.25,"signups":0.25}' }).scoreWeights
    expect(businessScore(post({ m: { impressions: 20_000, likes: 500 } }, 1), literal)).toBeGreaterThan(businessScore(post({ m: { impressions: 4_000, likes: 70 }, signups: 6 }, 2), literal))
  })

  it('decides: more of what converts, keep engagement-only content, cut costly formats', () => {
    const ps: MarketingPost[] = []
    let i = 0
    for (let k = 0; k < 3; k++) ps.push(post({ slotRole: 'founder_story', signups: 3 }, i++))
    for (let k = 0; k < 3; k++) ps.push(post({ slotRole: 'poll', format: 'poll', m: { likes: 120, linkClicks: 0 } }, i++))
    for (let k = 0; k < 3; k++) ps.push(post({ slotRole: 'product', format: 'video', estCostUsd: 0.5 }, i++))
    for (const p of ps) p.businessScore = businessScore(p, w)
    const d = computeDecisions(ps, { now: new Date('2026-10-20T00:00:00Z'), windowDays: 30 })
    expect(d.decisions.find((x) => x.dimension === 'role' && x.key === 'founder_story')).toMatchObject({ action: 'increase' })
    expect(d.decisions.find((x) => x.dimension === 'role' && x.key === 'poll')).toMatchObject({ action: 'keep' })
    expect(d.decisions.find((x) => x.dimension === 'format' && x.key === 'video')).toMatchObject({ action: 'decrease' })
    expect(d.weights.roles.founder_story).toBeGreaterThan(1)
    expect(d.decisions.find((x) => x.key === 'poll')!.reason).toMatch(/engagement .* but no clicks or sign-ups/)
  })
})

describe('content safety: product name, privacy, library', () => {
  it('fixes misspelled product names', () => {
    expect(fixProductName('Try Magical Birthday Plannner today').text).toBe('Try Magical Birthday Planner today')
    expect(fixProductName('the magical birthday planer').text).toBe('the Magical Birthday Planner')
    expect(fixProductName('Magical Birthday Planner').fixed).toBe(false)
    expect(fixProductName('https://magicalbirthdayplanner.app').fixed).toBe(false)
  })
  it('blocks child names, schools, addresses, phone numbers and emails', () => {
    for (const t of ['My daughter Maya loved it.', 'Party at Lincoln Elementary on Friday.', 'Come to 42 Maple Street at 3.', 'Text me at 555-123-4567.', 'Email party@example.com'])
      expect(claimIssues(t).map((i) => i.code), t).toContain('privacy')
    expect(claimIssues('My daughter turns 7 on launch day.')).toEqual([])
    expect(claimIssues('I’m Arun. I build birthday tools.').map((i) => i.code)).toContain('privacy')
    expect(claimIssues('Hi, I am Sam and I build things.').map((i) => i.code)).toContain('privacy')
    expect(claimIssues('I’m building a planner. I’m Not sure yet.')).toEqual([])
    expect(claimIssues('Built by Arun.', ['Arun']).map((i) => i.code)).toContain('forbidden_term')
  })
  it('a bare web address in a no-link post is rejected (X bills it as a link)', () => {
    expect(validatePost('Planning a party? Visit magicalbirthdayplanner.app to start today, it is easy.', { pillar: 'launch_invitation', maxChars: 280, allowedLink: null }).errors.map((e) => e.code)).toContain('link_not_allowed')
  })
  it('every evergreen library item is valid as written', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(40)
    for (const item of LIBRARY) {
      const r = validatePost(item.text, { pillar: item.pillar, maxChars: 280, allowedLink: null, minChars: item.format === 'poll' ? 10 : undefined })
      expect(r.errors, item.key).toEqual([])
      expect(pollIssues(item.poll), item.key).toEqual([])
      if (item.card) expect(claimIssues([item.card.headline, ...(item.card.bullets ?? [])].join(' · ')), item.key).toEqual([])
      expect(fixProductName(item.text).fixed, item.key).toBe(false)
    }
    expect(new Set(LIBRARY.map((i) => i.key)).size).toBe(LIBRARY.length)
  })
})
