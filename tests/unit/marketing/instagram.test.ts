/** Instagram channel: provider (mocked Graph API), planning, batch captions, publishing via signed URLs. No network. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAIConfig } from '@/lib/ai/config'
import { mockCalls, resetMock, scriptMock } from '@/lib/ai/providers/mock'
import { generateDay } from '@/lib/marketing/batch'
import { cadenceFor, readMarketingConfig } from '@/lib/marketing/config'
import { planSlots, planWeek } from '@/lib/marketing/planner'
import { InstagramProvider } from '@/lib/marketing/providers/instagram'
import type { MarketingProvider, PublishInput } from '@/lib/marketing/providers/types'
import { publishPost } from '@/lib/marketing/publish'
import { validatePost, platformRules } from '@/lib/marketing/validation'
import { MemoryMarketingStore } from '../../helpers/marketing-memory-store'

const NOW = new Date('2026-10-19T10:00:00Z')
const TOKEN = 'IGAA-test-SECRET-token'
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let store: MemoryMarketingStore

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

describe('InstagramProvider', () => {
  function fake(handler: (url: string, body: URLSearchParams | null) => Response) {
    const calls: { url: string; body: URLSearchParams | null }[] = []
    const f = vi.fn(async (u: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? new URLSearchParams(String(init.body)) : null
      calls.push({ url: String(u), body })
      return handler(String(u), body)
    }) as unknown as typeof fetch
    return { f, calls }
  }
  const provider = (f: typeof fetch) => new InstagramProvider({ token: TOKEN, userId: '17841400000000001', baseUrl: 'https://ig.test/v24.0', fetchImpl: f, sleep: async () => undefined })

  it('image: container → status → media_publish → permalink', async () => {
    const { f, calls } = fake((url) => (url.endsWith('/media') ? json(200, { id: 'c1' }) : url.endsWith('/media_publish') ? json(200, { id: '1790' }) : url.includes('/1790?') ? json(200, { permalink: 'https://www.instagram.com/p/abc/' }) : json(200, { status_code: 'FINISHED' })))
    const r = await provider(f).publish({ text: 'Caption #birthdayparty', media: { url: 'https://signed/a.png', mimeType: 'image/png', altText: 'A card' } })
    expect(r).toMatchObject({ externalId: '1790', url: 'https://www.instagram.com/p/abc/' })
    const create = calls[0].body!
    expect(create.get('image_url')).toBe('https://signed/a.png')
    expect(create.get('caption')).toBe('Caption #birthdayparty')
    expect(create.get('alt_text')).toBe('A card')
    expect(calls.find((c) => c.url.endsWith('/media_publish'))!.body!.get('creation_id')).toBe('c1')
  })

  it('carousel: one item container per image, then a CAROUSEL container', async () => {
    let n = 0
    const { f, calls } = fake((url) => (url.endsWith('/media') ? json(200, { id: `c${++n}` }) : url.endsWith('/media_publish') ? json(200, { id: '1791' }) : json(200, { status_code: 'FINISHED' })))
    await provider(f).publish({ text: 'Slides', media: [1, 2, 3].map((i) => ({ url: `https://signed/${i}.png`, mimeType: 'image/png' })) })
    const creates = calls.filter((c) => c.url.endsWith('/media')).map((c) => c.body!)
    expect(creates.slice(0, 3).every((b) => b.get('is_carousel_item') === 'true')).toBe(true)
    expect(creates[3].get('media_type')).toBe('CAROUSEL')
    expect(creates[3].get('children')).toBe('c1,c2,c3')
  })

  it('reel: waits for processing before publishing', async () => {
    let polls = 0
    const { f, calls } = fake((url) => (url.endsWith('/media') ? json(200, { id: 'r1' }) : url.endsWith('/media_publish') ? json(200, { id: '1792' }) : url.includes('/r1?') ? json(200, { status_code: polls++ < 2 ? 'IN_PROGRESS' : 'FINISHED' }) : json(200, {})))
    await provider(f).publish({ text: 'Reel', media: { url: 'https://signed/v.mp4', mimeType: 'video/mp4' } })
    expect(calls[0].body!.get('media_type')).toBe('REELS')
    expect(calls[0].body!.get('share_to_feed')).toBe('true')
    expect(polls).toBe(3)
  })

  it('maps errors, never leaks the token, refuses text-only posts', async () => {
    const { f } = fake(() => json(400, { error: { message: `Invalid OAuth access token access_token=${TOKEN}`, code: 190 } }))
    const err = await provider(f).publish({ text: 'x', media: { url: 'https://s/a.png', mimeType: 'image/png' } }).catch((e) => e)
    expect(err.kind).toBe('auth')
    expect(String(err.message)).not.toContain(TOKEN)
    await expect(provider(f).publish({ text: 'no media' })).rejects.toMatchObject({ kind: 'invalid' })
    expect(new InstagramProvider({ token: null, userId: null }).configured()).toBe(false)
  })

  it('a timeout on media_publish is unconfirmed (never retried)', async () => {
    const f = vi.fn(async (u: string | URL | Request, init?: RequestInit) => {
      if (String(u).endsWith('/media_publish')) return new Promise<Response>((_, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('abort'))))
      return String(u).endsWith('/media') ? json(200, { id: 'c1' }) : json(200, { status_code: 'FINISHED' })
    }) as unknown as typeof fetch
    const p = new InstagramProvider({ token: TOKEN, userId: '17841400000000001', baseUrl: 'https://ig.test', fetchImpl: f, timeoutMs: 20, sleep: async () => undefined })
    await expect(p.publish({ text: 'x', media: { url: 'https://s/a.png', mimeType: 'image/png' } })).rejects.toMatchObject({ kind: 'timeout', unconfirmed: true })
  })

  it('metrics: likes, comments, saves, shares, views (null when not returned)', async () => {
    const { f } = fake((url) => (url.includes('/insights') ? json(200, { data: [{ name: 'views', values: [{ value: 320 }] }, { name: 'saved', values: [{ value: 4 }] }] }) : json(200, { like_count: 12, comments_count: 3 })))
    const m = await provider(f).getMetrics(['17900000000000001'])
    expect(m.get('17900000000000001')).toEqual({ impressions: 320, likes: 12, reposts: null, replies: 3, quotes: null, bookmarks: 4, profileVisits: null, linkClicks: null })
  })
})

describe('Instagram planning, captions and publishing', () => {
  const cfg = readMarketingConfig({ MARKETING_PLATFORMS: 'x,instagram', MARKETING_IG_POSTS_PER_DAY: '2', MARKETING_IG_POST_TIMES: '12:30,20:00' })

  it('cadence: 2 posts/day, captions up to 2,200 chars, no links, 5 hashtags', () => {
    expect(cfg.platforms).toEqual(['x', 'instagram'])
    expect(cadenceFor(cfg, 'instagram')).toMatchObject({ postsPerDay: 2, postTimes: ['12:30', '20:00'], maxChars: 2200, links: false, maxHashtags: 5 })
    const caption = 'Before you send invitations, lock down the date, the place and a realistic headcount.\n\nEverything else is easier to change later.\n\nmagicalbirthdayplanner.app\n\n#BirthdayParty #KidsParty #PartyPlanning'
    expect(validatePost(caption, { ...platformRules('instagram', cfg), pillar: 'useful_tips', allowedLink: null }).ok).toBe(true)
    expect(validatePost(caption, { ...platformRules('x', cfg), pillar: 'useful_tips', allowedLink: null }).ok).toBe(false)
  })

  it('plans 14 slots a week, every one with media, no polls, threads or links', async () => {
    const slots = planSlots(await planWeek(store, cfg, { weekStart: '2026-10-19', now: NOW, budget: null, platform: 'instagram' }))
    expect(slots).toHaveLength(14)
    expect(slots.every((s) => s.media.source !== 'none' && !s.link && !s.thread && !['poll', 'thread', 'text'].includes(s.format))).toBe(true)
    expect(slots.filter((s) => s.format === 'carousel').length).toBeGreaterThanOrEqual(3)
  })

  it('one AI call writes the Instagram day with Instagram rules (hashtags ok, no links)', async () => {
    scriptMock((req) => {
      expect(req.messages[0].content).toMatch(/Instagram captions/)
      const slots = [...req.messages[1].content.matchAll(/SLOT (\d+) — /g)].map((m) => Number(m[1]))
      return JSON.stringify({ posts: slots.map((slot, i) => ({ slot, paragraphs: [i ? 'Ninety minutes is plenty for little ones; two hours once there is food and cake.' : 'Parents don’t need another app. They need fewer things to manage.', 'magicalbirthdayplanner.app', '#BirthdayParty #KidsParty #PartyPlanning'], hook: 'x hook', topic: `topic ${slot}`, cta: null, card: { headline: 'Fewer things to manage', bullets: ['Pick the date', 'Count the kids', 'Set the budget'] }, factsUsed: [] })) })
    })
    const r = await generateDay(store, cfg, { date: '2026-10-19', now: NOW, env: {}, platform: 'instagram' })
    expect(mockCalls()).toHaveLength(1)
    expect(r.generated).toHaveLength(2)
    const posts = [...store.rows.values()]
    expect(posts.every((p) => p.platform === 'instagram' && p.media_ids.length > 0 && !p.link_url && Number(p.est_cost_usd) === 0)).toBe(true)
  }, 30_000)

  it('publishes with signed URLs (no bytes), costs nothing, and refuses posts without media', async () => {
    const posted: PublishInput[] = []
    const ig = { platform: 'instagram', mediaByUrl: true, maxChars: 2200, configured: () => true, setMeter() {}, publish: async (i: PublishInput) => (posted.push(i), { externalId: '1790', url: 'https://www.instagram.com/p/x/', mediaId: 'c', mediaIds: ['c'], threadIds: [] }) } as unknown as MarketingProvider
    const m = await store.insertMedia({ kind: 'image', source: 'template', title: 'card', storage_path: 'templates/p/1.png', mime_type: 'image/png', privacy_status: 'approved' })
    const p = store.seed({ platform: 'instagram', content_pillar: 'useful_tips', topic: 't', text: 'Before you send invitations, lock down the date, the place and a realistic headcount.\n\n#BirthdayParty', status: 'scheduled', scheduled_at: NOW.toISOString(), format: 'image', media_ids: [m.id] })
    const live = readMarketingConfig({ MARKETING_PLATFORMS: 'x,instagram', MARKETING_DRY_RUN: 'false' })
    expect(await publishPost(p.id, 'scheduled', { store, provider: ig, cfg: live, env: {} }, { now: NOW })).toMatchObject({ ok: true, status: 'published' })
    expect((posted[0].media as { url: string; bytes?: unknown }[])[0]).toMatchObject({ url: 'memory://media/templates/p/1.png' })
    expect((posted[0].media as { bytes?: unknown }[])[0].bytes).toBeUndefined()
    expect(store.usage).toHaveLength(0)
    const bare = store.seed({ platform: 'instagram', content_pillar: 'useful_tips', topic: 't2', text: 'Plan one more activity than you think you need, so nobody improvises in front of a room of kids.', status: 'scheduled', scheduled_at: NOW.toISOString() })
    expect(await publishPost(bare.id, 'scheduled', { store, provider: ig, cfg: live, env: {} }, { now: NOW })).toMatchObject({ ok: false, reason: 'media' })
  })
})
