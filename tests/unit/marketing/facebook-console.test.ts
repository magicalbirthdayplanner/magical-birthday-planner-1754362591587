/** Facebook Page provider (mocked Graph API) + the single marketing console: schedule, approve-day, regenerate, pause. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAIConfig } from '@/lib/ai/config'
import { resetMock, scriptMock } from '@/lib/ai/providers/mock'
import { runPublish } from '@/lib/marketing/agent'
import { generateDay, regenerateSlot } from '@/lib/marketing/batch'
import { readMarketingConfig } from '@/lib/marketing/config'
import { approveDay, checkConnection, platformOverview, writeNextDay } from '@/lib/marketing/console'
import { FacebookProvider } from '@/lib/marketing/providers/facebook'
import { setMarketingProviderOverride } from '@/lib/marketing/providers'
import type { MarketingProvider, PublishInput } from '@/lib/marketing/providers/types'
import { MemoryMarketingStore } from '../../helpers/marketing-memory-store'

const NOW = new Date('2026-10-19T10:00:00Z')
const TOKEN = 'EAA-test-SECRET-page-token'
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let store: MemoryMarketingStore

/** Batch mock: one valid item per slot in the prompt (distinct ideas). */
const IDEAS = ['Before you send invitations, lock down the date, the place and a realistic headcount.', 'Plan one more activity than you think you need, just in case.', 'What is the birthday task you wish someone else would handle?', 'Ninety minutes is plenty for little ones; two hours once there is food.']
let n = 0
const reply = (req: { messages: { content: string }[] }) => {
  const slots = [...req.messages[1].content.matchAll(/SLOT (\d+) — [^\n]*\n[^\n]*\n\s*Format: ([A-Z" ]+)/g)].map((m) => ({ slot: Number(m[1]), format: m[2] }))
  return JSON.stringify({ posts: slots.map(({ slot, format }) => ({ slot, paragraphs: [`${IDEAS[(slot + n++) % IDEAS.length]} (${slot}-${n})`], hook: `hook ${slot}-${n}`, topic: `topic ${slot}`, cta: null, factsUsed: [], card: /IMAGE|CAROUSEL/.test(format) ? { headline: 'Plan the party calmly', bullets: ['Pick the date', 'Count the kids', 'Set the budget'] } : null, poll: /POLL|QUESTION/.test(format) ? { options: ['Venue', 'Guest list'] } : null, thread: null })) })
}

beforeEach(() => {
  Object.assign(process.env, { AI_PROVIDER: 'mock', AI_ENABLED: 'true' })
  resetAIConfig()
  resetMock()
  n = 0
  store = new MemoryMarketingStore()
  store.clock = () => NOW
})
afterEach(() => {
  setMarketingProviderOverride(null)
  delete process.env.AI_PROVIDER
  resetAIConfig()
})

describe('FacebookProvider', () => {
  function fake(handler: (url: string, body: URLSearchParams | null) => Response) {
    const calls: { url: string; body: URLSearchParams | null }[] = []
    const f = vi.fn(async (u: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? new URLSearchParams(String(init.body)) : null
      calls.push({ url: String(u), body })
      return handler(String(u), body)
    }) as unknown as typeof fetch
    return { f, calls }
  }
  const provider = (f: typeof fetch) => new FacebookProvider({ token: TOKEN, pageId: '1387953677730770', baseUrl: 'https://fb.test/v26.0', videoBaseUrl: 'https://fbv.test/v26.0', fetchImpl: f })

  it('text and link posts go to /feed; a single photo to /photos with the caption', async () => {
    const { f, calls } = fake((url) => (url.endsWith('/photos') ? json(200, { id: 'ph1', post_id: 'p_2' }) : json(200, { id: 'p_1' })))
    expect(await provider(f).publish({ text: 'Hello parents https://magicalbirthdayplanner.app/?utm_source=facebook' })).toMatchObject({ externalId: 'p_1', url: 'https://www.facebook.com/p_1' })
    expect(calls[0].url).toBe('https://fb.test/v26.0/1387953677730770/feed')
    expect(calls[0].body!.get('message')).toContain('utm_source=facebook')
    await provider(f).publish({ text: 'Caption', media: { url: 'https://signed/a.png', mimeType: 'image/png' } })
    expect(calls[1].body!.get('url')).toBe('https://signed/a.png')
    expect(calls[1].body!.get('caption')).toBe('Caption')
  })

  it('several photos: unpublished uploads then one feed post with attached_media; video via graph-video', async () => {
    let i = 0
    const { f, calls } = fake((url) => (url.endsWith('/photos') ? json(200, { id: `ph${++i}` }) : url.endsWith('/videos') ? json(200, { id: 'v1' }) : json(200, { id: 'p_9' })))
    await provider(f).publish({ text: 'Slides', media: [1, 2].map((k) => ({ url: `https://signed/${k}.png`, mimeType: 'image/png' })) })
    expect(calls.slice(0, 2).every((c) => c.body!.get('published') === 'false')).toBe(true)
    expect(calls[2].body!.get('attached_media[1]')).toBe(JSON.stringify({ media_fbid: 'ph2' }))
    await provider(f).publish({ text: 'Reel', media: { url: 'https://signed/v.mp4', mimeType: 'video/mp4' } })
    expect(calls.at(-1)!.url).toBe('https://fbv.test/v26.0/1387953677730770/videos')
    expect(calls.at(-1)!.body!.get('file_url')).toBe('https://signed/v.mp4')
  })

  it('polls become a question with options; errors never leak the token', async () => {
    const { f, calls } = fake(() => json(200, { id: 'p_3' }))
    await provider(f).publish({ text: 'Which theme wins?', poll: { options: ['Dinosaurs', 'Space'], durationMinutes: 1440 } })
    expect(calls[0].body!.get('message')).toBe('Which theme wins?\n\n• Dinosaurs\n• Space')
    const bad = fake(() => json(400, { error: { message: `Invalid token access_token=${TOKEN}`, code: 190 } }))
    const err = await provider(bad.f).publish({ text: 'x' }).catch((e) => e)
    expect(err.kind).toBe('auth')
    expect(String(err.message)).not.toContain(TOKEN)
  })

  it('metrics: reactions, comments, shares, impressions, clicks', async () => {
    const { f } = fake((url) => (url.includes('/insights') ? json(200, { data: [{ name: 'post_impressions', values: [{ value: 140 }] }, { name: 'post_clicks', values: [{ value: 9 }] }] }) : json(200, { reactions: { summary: { total_count: 7 } }, comments: { summary: { total_count: 2 } }, shares: { count: 1 } })))
    expect((await provider(f).getMetrics(['1387953677730770_123'])).get('1387953677730770_123')).toEqual({ impressions: 140, likes: 7, reposts: 1, replies: 2, quotes: null, bookmarks: null, profileVisits: null, linkClicks: 9 })
  })
})

describe('marketing console', () => {
  const cfg = readMarketingConfig({ MARKETING_PLATFORMS: 'x,instagram,facebook', MARKETING_FB_POSTS_PER_DAY: '2', MARKETING_BANK_DAYS: '30' })

  it('Facebook days are written with Facebook rules (links free on soft conversions, polls as questions)', async () => {
    scriptMock(reply, reply, reply)
    const r = await generateDay(store, cfg, { date: '2026-10-19', now: NOW, env: {}, platform: 'facebook' })
    expect(r.generated.length + r.library.length).toBe(2)
    const posts = [...store.rows.values()]
    expect(posts.every((p) => p.platform === 'facebook' && Number(p.est_cost_usd) === 0)).toBe(true)
    expect(posts.map((p) => p.scheduled_at).sort()).toEqual(['2026-10-19T13:00:00.000Z', '2026-10-19T21:00:00.000Z'])
  }, 30_000)

  it('the schedule lays out 30 days slot by slot; approve-day queues the drafts; regenerate rewrites one slot', async () => {
    scriptMock(reply, reply, reply, reply)
    const w = await writeNextDay(store, cfg, 'facebook', 'admin', NOW)
    expect(w.date).toBe('2026-10-19')
    const view = await platformOverview(store, cfg, 'facebook', NOW)
    expect(view.days).toHaveLength(30)
    const day = view.days[0]
    expect(day.slots.map((s) => s.time)).toEqual(['09:00', '17:00'])
    expect(day.slots.every((s) => s.post?.status === 'draft')).toBe(true)
    expect(view.days[1].unwritten).toBe(2)

    const a = await approveDay(store, cfg, 'facebook', '2026-10-19', 'admin', NOW)
    expect(a.approved).toBe(2)
    expect([...store.rows.values()].every((p) => p.status === 'scheduled' && p.autonomous === false)).toBe(true)

    const first = [...store.rows.values()].sort((x, y) => x.scheduled_at!.localeCompare(y.scheduled_at!))[1]
    const rg = await regenerateSlot(store, cfg, { postId: first.id, now: NOW, env: {} })
    expect(rg.ok).toBe(true)
    expect(store.rows.get(first.id)!.status).toBe('cancelled')
    const fresh = store.rows.get((rg as { postId: string }).postId)!
    expect(fresh.slot_index).toBe(first.slot_index)
    expect(fresh.status).toBe('draft')
  }, 30_000)

  it('a paused platform publishes nothing; connection checks use the platform provider', async () => {
    const posted: PublishInput[] = []
    const fb = { platform: 'facebook', mediaByUrl: true, maxChars: 5000, configured: () => true, setMeter() {}, verify: async () => ({ id: '1', username: 'Magical Birthday Planner', name: 'Magical Birthday Planner' }), publish: async (i: PublishInput) => (posted.push(i), { externalId: '1_2', url: 'u', mediaId: null }) } as unknown as MarketingProvider
    setMarketingProviderOverride(fb)
    store.seed({ platform: 'facebook', content_pillar: 'useful_tips', topic: 't', text: 'Plan one more activity than you think you need, so nobody improvises in front of a room of kids.', status: 'scheduled', scheduled_at: NOW.toISOString() })
    const c = readMarketingConfig({ MARKETING_PLATFORMS: 'facebook', AUTONOMOUS_PUBLISHING: 'true', MARKETING_DRY_RUN: 'false' })
    await store.setAutonomous(true)
    await store.setPaused('facebook', true)
    expect((await runPublish({ store, cfg: c, now: NOW })).publish).toEqual([expect.objectContaining({ platform: 'facebook', reason: 'platform_paused' })])
    await store.setPaused('facebook', false)
    expect((await runPublish({ store, cfg: c, now: NOW })).publish).toEqual([expect.objectContaining({ platform: 'facebook', ok: true, status: 'published' })])
    expect(posted).toHaveLength(1)
    Object.assign(process.env, { FB_PAGE_ACCESS_TOKEN: 'x', FB_PAGE_ID: '1387953677730770' })
    expect(await checkConnection(store, c, 'facebook')).toMatchObject({ ok: true, message: 'Connected as Magical Birthday Planner.' })
    delete process.env.FB_PAGE_ACCESS_TOKEN
    expect(await checkConnection(store, c, 'facebook')).toMatchObject({ ok: false })
  })
})
