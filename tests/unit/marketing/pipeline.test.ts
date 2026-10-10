/**
 * Founder marketing agent end to end with fakes: generation → validation → repetition → image → store → scheduler
 * → publish (dry-run and mocked live X) → metrics. No network: the AI is the deterministic mock provider, X is a fake.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetAIConfig } from '@/lib/ai/config'
import { mockCalls, resetMock, scriptMock } from '@/lib/ai/providers/mock'
import { runPrepare, runPublish } from '@/lib/marketing/agent'
import { readMarketingConfig, type MarketingConfig } from '@/lib/marketing/config'
import { generateMarketingPost } from '@/lib/marketing/generate'
import { setImageProviderOverride, type ImageGenerationProvider } from '@/lib/marketing/images'
import { collectPlatformMetrics } from '@/lib/marketing/metrics'
import { MarketingProviderError, type AccountInfo, type MarketingProvider, type PublishInput } from '@/lib/marketing/providers/types'
import { publishPost, recoverStalePublishing } from '@/lib/marketing/publish'
import type { PlatformMetrics } from '@/lib/marketing/types'
import { MemoryMarketingStore } from '../../helpers/marketing-memory-store'

const NOW = new Date('2026-10-20T11:00:00Z') // 07:00 EDT, a week after launch
const SECRETS = { X_API_KEY: 'xk-SECRET-1', X_API_SECRET: 'xs-SECRET-2', X_ACCESS_TOKEN: 'xt-SECRET-3', X_ACCESS_TOKEN_SECRET: 'xts-SECRET-4' }

const DRAFTS = [
  { p: ['Before you send invitations, lock down three things: the date, the headcount and the venue.', 'Everything after that gets easier.'], h: 'Before you send invitations, lock down three things: the date, the headcount and the venue.', t: 'Lock things before invites' },
  { p: ['I deleted most of my first prototype instead of patching it.', 'It hurt for a day. Then the app got simpler.'], h: 'I deleted most of my first prototype instead of patching it.', t: 'Deleting the prototype' },
  { p: ['Venue or guest list — which one stresses you out more when planning a birthday?'], h: 'Venue or guest list — which one stresses you out more when planning a birthday?', t: 'Venue vs guest list' },
  { p: ['RSVPs that never come back are the quiet tax of every kids party.', 'Set a reply-by date a week out and send one friendly nudge.'], h: 'RSVPs that never come back are the quiet tax of every kids party.', t: 'RSVP silence' },
]
const draftJson = (i: number, over: Record<string, unknown> = {}) =>
  JSON.stringify({ paragraphs: DRAFTS[i % DRAFTS.length].p, hook: DRAFTS[i % DRAFTS.length].h, topic: DRAFTS[i % DRAFTS.length].t, cta: null, imageHeadline: 'Plan the party, not the tabs', imagePrompt: 'A paper party hat and folded invitations on a sunny kitchen table', altText: 'A paper party hat and invitations on a table.', factsUsed: [], angle: 'Useful and honest.', ...over })
/** The mock AI answers every call with the next distinct draft. */
function distinctDrafts() {
  let i = 0
  scriptMock(...Array.from({ length: 30 }, () => () => draftJson(i++)))
}

/** The mock AI answers batch prompts: one valid item per "SLOT n" line, shaped by the slot's format. */
function batchDrafts() {
  let n = 0
  const reply = (req: { messages: { content: string }[] }) => {
    const prompt = req.messages[1].content
    const slots = [...prompt.matchAll(/SLOT (\d+) — [^\n]*\n(?:[^\n]*\n){0,1}\s*Format: ([A-Z" ]+)/g)].map((m) => ({ slot: Number(m[1]), format: m[2] }))
    return JSON.stringify({
      posts: slots.map(({ slot, format }) => {
        const d = DRAFTS[n++ % DRAFTS.length]
        return {
          slot, paragraphs: d.p, hook: d.h, topic: d.t, cta: null, factsUsed: [],
          card: /IMAGE|CAROUSEL/.test(format) ? { headline: 'Plan the party, not the tabs', bullets: ['Pick the date', 'Count the kids', 'Set the budget'], left: 'Home', right: 'Venue' } : null,
          poll: format.startsWith('POLL') ? { options: ['Venue', 'Guest list', 'Budget'] } : null,
          thread: format.startsWith('THREAD') ? ['2/ The second part of the story.', '3/ The third and last part.'] : null,
        }
      }),
    })
  }
  scriptMock(...Array.from({ length: 30 }, () => reply))
}

class FakeImage implements ImageGenerationProvider {
  readonly name = 'fake'
  fail = false
  calls = 0
  configured() {
    return true
  }
  async generate() {
    this.calls++
    if (this.fail) throw new Error('image backend down')
    return { bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]), mimeType: 'image/png' as const, width: 1600, height: 900, provider: this.name, model: null, prompt: 'fake' }
  }
}

class FakeX implements MarketingProvider {
  readonly platform = 'x' as const
  readonly maxChars = 280
  posted: PublishInput[] = []
  failWith: MarketingProviderError | null = null
  metrics = new Map<string, PlatformMetrics>()
  delayMs = 0
  configured() {
    return true
  }
  setMeter() {}
  async uploadVideo() {
    return 'v1'
  }
  async getOwnPosts() {
    return []
  }
  async verify(): Promise<AccountInfo> {
    return { id: '1', username: 'founder', name: null }
  }
  async uploadImage() {
    return 'm1'
  }
  async createPost() {
    return { externalId: 'x', url: 'u' }
  }
  async publish(input: PublishInput) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs))
    if (this.failWith) throw this.failWith
    this.posted.push(input)
    const id = `188000000000000000${this.posted.length}`
    return { externalId: id, url: `https://x.com/founder/status/${id}`, mediaId: input.media ? 'media-1' : null, mediaError: null }
  }
  async getMetrics(ids: string[]) {
    return new Map([...this.metrics].filter(([k]) => ids.includes(k)))
  }
}

let store: MemoryMarketingStore
let x: FakeX
let image: FakeImage
const cfg = (env: Record<string, string> = {}): MarketingConfig => readMarketingConfig({ MARKETING_POST_TIMES: '10:00,19:30', MARKETING_POSTS_PER_DAY: '1', MARKETING_MIN_GAP_MINUTES: '240', ...env })

beforeEach(() => {
  Object.assign(process.env, { AI_PROVIDER: 'mock', AI_ENABLED: 'true', ...SECRETS })
  resetAIConfig()
  resetMock()
  store = new MemoryMarketingStore()
  store.clock = () => NOW
  x = new FakeX()
  image = new FakeImage()
  setImageProviderOverride(image)
})
afterEach(() => {
  setImageProviderOverride(undefined)
  for (const k of Object.keys(SECRETS)) delete process.env[k]
  delete process.env.AI_PROVIDER
  resetAIConfig()
})

describe('generateMarketingPost', () => {
  it('writes, validates, illustrates and stores a draft — and never publishes', async () => {
    distinctDrafts()
    const r = await generateMarketingPost({ now: NOW, pillar: 'launch_invitation' }, { store, cfg: cfg() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const p = r.post
    expect(p.status).toBe('draft')
    expect(p.pillar).toBe('launch_invitation')
    expect(p.linkUrl).toBe(`https://magicalbirthdayplanner.app/?utm_source=x&utm_medium=social&utm_campaign=mbp_x_growth&utm_content=${p.id}`)
    expect(p.text.endsWith(`\n\n${p.linkUrl}`)).toBe(true)
    expect(p.text).toContain('Before you send invitations')
    expect(p.imageStatus).toBe('generated')
    expect(store.images.get(p.imagePath!)?.contentType).toBe('image/png')
    expect(p.validation).toMatchObject({ ok: true })
    expect(p.generation).toMatchObject({ provider: 'mock', attempts: 1, objective: 'growth' })
    expect(x.posted).toHaveLength(0)
    expect(store.auditLog.map((a) => a.action)).toContain('generated')
  })

  it('rejects an unsupported claim and regenerates with the reasons', async () => {
    scriptMock(draftJson(0, { paragraphs: ['Over 500 parents already use it to plan parties.', 'Join them today.'], hook: 'Over 500 parents already use it to plan parties.' }), draftJson(1))
    const r = await generateMarketingPost({ now: NOW, pillar: 'founder_journey' }, { store, cfg: cfg() })
    expect(r.ok && r.attempts).toBe(2)
    const second = mockCalls()[1].messages[1].content
    expect(second).toContain('YOUR PREVIOUS DRAFT WAS REJECTED')
    expect(second).toMatch(/how many parents use it/i)
  })

  it('stores nothing when every attempt fails', async () => {
    const bad = draftJson(0, { paragraphs: ['We hit $5k MRR this month. Trusted by parents everywhere.'], hook: 'We hit $5k MRR this month.' })
    scriptMock(bad, bad, bad)
    const r = await generateMarketingPost({ now: NOW, pillar: 'founder_journey' }, { store, cfg: cfg() })
    expect(r).toMatchObject({ ok: false, code: 'rejected', attempts: 3 })
    expect(store.rows.size).toBe(0)
    expect(store.auditLog.at(-1)?.action).toBe('generation_rejected')
  })

  it('refuses to repeat a recent idea', async () => {
    store.seed({ content_pillar: 'parent_pain', topic: 'tabs', text: 'Planning a birthday is stressful because you need 20 tabs', status: 'published', published_at: '2026-10-18T14:00:00Z' })
    scriptMock(draftJson(0, { paragraphs: ['Why do parents need 20 browser tabs to plan a birthday?'], hook: 'Why do parents need 20 browser tabs to plan a birthday?' }), draftJson(3))
    const r = await generateMarketingPost({ now: NOW, pillar: 'community_question' }, { store, cfg: cfg() })
    expect(r.ok && r.attempts).toBe(2)
    expect(mockCalls()[1].messages[1].content).toMatch(/Same idea as a post from 2026-10-18/)
  })

  it('a failed image never blocks the post (text only)', async () => {
    distinctDrafts()
    image.fail = true
    const r = await generateMarketingPost({ now: NOW, pillar: 'useful_tips' }, { store, cfg: cfg() })
    expect(r.ok && r.post.imageStatus).toBe('failed')
    expect(r.ok && r.post.imagePath).toBeNull()
  })

  it('community questions carry no link and no image', async () => {
    distinctDrafts()
    const r = await generateMarketingPost({ now: NOW, pillar: 'community_question' }, { store, cfg: cfg() })
    expect(r.ok && r.post.linkUrl).toBeNull()
    expect(r.ok && r.post.imageStatus).toBe('none')
    expect(image.calls).toBe(0)
  })

  it('regenerate replaces the old draft', async () => {
    distinctDrafts()
    const first = await generateMarketingPost({ now: NOW, pillar: 'founder_journey' }, { store, cfg: cfg() })
    const second = await generateMarketingPost({ now: NOW, regenerateOf: first.ok ? first.post.id : '' }, { store, cfg: cfg() })
    expect(second.ok).toBe(true)
    expect((await store.getPost(first.ok ? first.post.id : ''))?.status).toBe('cancelled')
    expect(second.ok && second.post.pillar).toBe('founder_journey')
  })

  it('needs a configured AI provider', async () => {
    process.env.AI_PROVIDER = 'opencode'
    delete process.env.AI_API_KEY
    resetAIConfig()
    expect(await generateMarketingPost({ now: NOW }, { store, cfg: cfg() })).toMatchObject({ ok: false, code: 'ai_not_configured' })
  })

  it('never puts credentials into prompts or stored rows', async () => {
    distinctDrafts()
    await generateMarketingPost({ now: NOW, pillar: 'launch_invitation' }, { store, cfg: cfg() })
    const everything = JSON.stringify(mockCalls()) + JSON.stringify([...store.rows.values()]) + JSON.stringify(store.auditLog)
    for (const v of Object.values(SECRETS)) expect(everything).not.toContain(v)
  })
})

async function approvedPost(i = 0, extra: Record<string, unknown> = {}) {
  scriptMock(() => draftJson(i))
  const r = await generateMarketingPost({ now: NOW, pillar: 'useful_tips' }, { store, cfg: cfg() })
  if (!r.ok) throw new Error(r.message)
  return (await store.updatePost(r.post.id, { status: 'scheduled', scheduled_at: '2026-10-20T14:00:00Z', ...extra }))!
}

describe('publishPost', () => {
  it('dry-run records what would be posted and never calls X', async () => {
    const p = await approvedPost()
    const r = await publishPost(p.id, 'scheduled', { store, provider: x, cfg: cfg() }, { now: NOW })
    expect(r).toMatchObject({ ok: true, status: 'dry_run' })
    expect(x.posted).toHaveLength(0)
    const saved = (await store.getPost(p.id))!
    expect(saved.dryRunPayload).toMatchObject({ text: p.text, platform: 'x' })
    expect(saved.externalPostId).toBeNull()
  })

  it('live mode posts once with the image and stores the X id and URL', async () => {
    const p = await approvedPost()
    const r = await publishPost(p.id, 'scheduled', { store, provider: x, cfg: cfg({ MARKETING_DRY_RUN: 'false' }) }, { now: NOW })
    expect(r).toMatchObject({ ok: true, status: 'published' })
    expect(x.posted).toHaveLength(1)
    expect(x.posted[0].text).toBe(p.text)
    expect((x.posted[0].media as { bytes: Uint8Array }[])[0].bytes).toEqual(new Uint8Array([137, 80, 78, 71, 1, 2, 3]))
    const saved = (await store.getPost(p.id))!
    expect(saved).toMatchObject({ status: 'published', externalPostId: '1880000000000000001', externalPostUrl: 'https://x.com/founder/status/1880000000000000001', externalMediaId: 'media-1' })
  })

  it('running twice at the same time publishes exactly once', async () => {
    const p = await approvedPost()
    x.delayMs = 20
    const live = cfg({ MARKETING_DRY_RUN: 'false' })
    const [a, b] = await Promise.all([publishPost(p.id, 'scheduled', { store, provider: x, cfg: live }, { now: NOW }), publishPost(p.id, 'scheduled', { store, provider: x, cfg: live }, { now: NOW })])
    expect(x.posted).toHaveLength(1)
    expect([a.ok, b.ok].sort()).toEqual([false, true])
    expect([a, b].find((r) => !r.ok)).toMatchObject({ status: 'skipped' })
    // And again later: already published → skipped.
    expect(await publishPost(p.id, 'scheduled', { store, provider: x, cfg: live }, { now: NOW })).toMatchObject({ ok: false, reason: 'not_publishable:published' })
    expect(x.posted).toHaveLength(1)
  })

  it('enforces the daily limit and the minimum gap', async () => {
    const live = cfg({ MARKETING_DRY_RUN: 'false' })
    const a = await approvedPost(0)
    const b = await approvedPost(1)
    expect((await publishPost(a.id, 'scheduled', { store, provider: x, cfg: live }, { now: NOW })).ok).toBe(true)
    expect(await publishPost(b.id, 'scheduled', { store, provider: x, cfg: live }, { now: NOW })).toMatchObject({ ok: false, reason: 'daily_limit' })
    const two = cfg({ MARKETING_DRY_RUN: 'false', MARKETING_POSTS_PER_DAY: '2' })
    expect(await publishPost(b.id, 'scheduled', { store, provider: x, cfg: two }, { now: NOW })).toMatchObject({ ok: false, reason: 'min_gap' })
    expect(x.posted).toHaveLength(1)
  })

  it('an unconfirmed publish is failed, flagged and never retried automatically', async () => {
    const p = await approvedPost()
    x.failWith = new MarketingProviderError('timeout', 'X request timed out', undefined, true)
    const live = cfg({ MARKETING_DRY_RUN: 'false', AUTONOMOUS_PUBLISHING: 'true' })
    expect(await publishPost(p.id, 'scheduled', { store, provider: x, cfg: live }, { now: NOW })).toMatchObject({ ok: false, reason: 'publish_unconfirmed' })
    expect((await store.getPost(p.id))!.status).toBe('failed')
    x.failWith = null
    await store.setAutonomous(true)
    await runPublish({ store, provider: x, cfg: live, now: new Date('2026-10-20T14:05:00Z'), attribution: null })
    expect(x.posted).toHaveLength(0)
  })

  it('a rate-limited publish goes back to the queue (definitely not posted)', async () => {
    const p = await approvedPost()
    x.failWith = new MarketingProviderError('rate_limited', 'X rate limit reached', 429)
    expect(await publishPost(p.id, 'scheduled', { store, provider: x, cfg: cfg({ MARKETING_DRY_RUN: 'false' }) }, { now: NOW })).toMatchObject({ ok: false, status: 'requeued' })
    expect((await store.getPost(p.id))!.status).toBe('scheduled')
  })

  it('re-validates right before publishing', async () => {
    const p = await approvedPost()
    await store.updatePost(p.id, { text: 'Hundreds of parents love this planner already, join them.' })
    expect(await publishPost(p.id, 'manual', { store, provider: x, cfg: cfg({ MARKETING_DRY_RUN: 'false' }) }, { now: NOW })).toMatchObject({ ok: false, reason: 'validation' })
    expect(x.posted).toHaveLength(0)
  })

  it('stale claims become publish_unconfirmed', async () => {
    const p = await approvedPost()
    await store.updatePost(p.id, { status: 'publishing', publishing_started_at: '2026-10-20T10:00:00Z' })
    expect(await recoverStalePublishing(store, NOW)).toBe(1)
    expect((await store.getPost(p.id))!).toMatchObject({ status: 'failed', publishErrorCode: 'publish_unconfirmed' })
  })
})

describe('scheduler (runPrepare / runPublish)', () => {
  const at = (iso: string) => new Date(iso)

  it('publish does nothing unless AUTONOMOUS_PUBLISHING=true AND the admin switch is on', async () => {
    const p = await approvedPost()
    const live = cfg({ MARKETING_DRY_RUN: 'false' })
    expect((await runPublish({ store, provider: x, cfg: live, now: at('2026-10-20T14:05:00Z') })).publish).toEqual({ skipped: 'AUTONOMOUS_PUBLISHING_not_true' })
    const allowed = cfg({ MARKETING_DRY_RUN: 'false', AUTONOMOUS_PUBLISHING: 'true' })
    expect((await runPublish({ store, provider: x, cfg: allowed, now: at('2026-10-20T14:05:00Z') })).publish).toEqual({ skipped: 'autonomous_switch_off' })
    expect(x.posted).toHaveLength(0)
    expect((await store.getPost(p.id))!.status).toBe('scheduled')
  })

  it('autonomous + dry-run simulates the due post; a second run changes nothing', async () => {
    const p = await approvedPost()
    await store.setAutonomous(true)
    const c = cfg({ AUTONOMOUS_PUBLISHING: 'true' })
    const r1 = await runPublish({ store, provider: x, cfg: c, now: at('2026-10-20T14:05:00Z') })
    expect(r1.publish).toEqual([{ id: p.id, ok: true, status: 'dry_run', reason: undefined }])
    const r2 = await runPublish({ store, provider: x, cfg: c, now: at('2026-10-20T14:10:00Z') })
    expect(r2.publish).toEqual([])
    expect(x.posted).toHaveLength(0)
  })

  it('autonomous live: publishes the due post once, even if the cron fires twice', async () => {
    await approvedPost()
    await store.setAutonomous(true)
    const c = cfg({ AUTONOMOUS_PUBLISHING: 'true', MARKETING_DRY_RUN: 'false' })
    await Promise.all([runPublish({ store, provider: x, cfg: c, now: at('2026-10-20T14:05:00Z') }), runPublish({ store, provider: x, cfg: c, now: at('2026-10-20T14:05:00Z') })])
    await runPublish({ store, provider: x, cfg: c, now: at('2026-10-20T14:30:00Z') })
    expect(x.posted).toHaveLength(1)
  })

  it('turning autonomy on queues the bank’s validated drafts as their slots come due', async () => {
    batchDrafts()
    const c = cfg({ AUTONOMOUS_PUBLISHING: 'true' })
    await runPrepare({ store, provider: x, cfg: c, now: NOW, attribution: null, countCampaign: null, sendEmail: null })
    expect([...store.rows.values()].filter((p) => p.status === 'draft')).toHaveLength(2)
    await store.setAutonomous(true)
    const r = await runPublish({ store, provider: x, cfg: c, now: at('2026-10-20T14:05:00Z') })
    expect(r.publish).toEqual([expect.objectContaining({ ok: true, status: 'dry_run' })])
    expect([...store.rows.values()].filter((p) => p.status === 'draft')).toHaveLength(1) // tomorrow's waits for its slot
  })

  it('posts are never published before their slot (minus the early window)', async () => {
    const p = await approvedPost(0, { scheduled_at: '2026-10-21T14:00:00Z' })
    await store.setAutonomous(true)
    await runPublish({ store, provider: x, cfg: cfg({ AUTONOMOUS_PUBLISHING: 'true' }), now: at('2026-10-20T14:05:00Z') })
    expect((await store.getPost(p.id))!.status).toBe('scheduled')
  })

  it('prepare in autonomous mode writes today and tomorrow from the weekly plan (one batch call per day) and is idempotent', async () => {
    batchDrafts()
    await store.setAutonomous(true)
    const c = cfg({ AUTONOMOUS_PUBLISHING: 'true' })
    const r = await runPrepare({ store, provider: x, cfg: c, now: NOW, attribution: null, countCampaign: null, sendEmail: null })
    const scheduled = [...store.rows.values()].filter((p) => p.status === 'scheduled').map((p) => p.scheduled_at).sort()
    expect(scheduled).toEqual(['2026-10-20T14:00:00.000Z', '2026-10-21T14:00:00.000Z'])
    expect(r.content).toEqual([expect.objectContaining({ date: '2026-10-20', generated: 1, aiCalls: 1 }), expect.objectContaining({ date: '2026-10-21', generated: 1, aiCalls: 1 })])
    expect(store.plans.size).toBe(1)
    await runPrepare({ store, provider: x, cfg: c, now: new Date('2026-10-20T11:30:00Z'), attribution: null, countCampaign: null, sendEmail: null })
    expect([...store.rows.values()].filter((p) => p.status === 'scheduled')).toHaveLength(2)
    expect(store.briefs.size).toBe(1)
    expect(store.usage.filter((u) => u.provider === 'ai')).toHaveLength(2)
  })

  it('prepare with autonomous OFF writes the same bank as drafts for review', async () => {
    batchDrafts()
    const c = cfg()
    await runPrepare({ store, provider: x, cfg: c, now: NOW, attribution: null, countCampaign: null, sendEmail: null })
    await runPrepare({ store, provider: x, cfg: c, now: new Date('2026-10-20T15:00:00Z'), attribution: null, countCampaign: null, sendEmail: null })
    const drafts = [...store.rows.values()].filter((p) => p.status === 'draft')
    expect(drafts).toHaveLength(2)
    expect([...store.rows.values()].some((p) => ['scheduled', 'published', 'dry_run'].includes(p.status))).toBe(false)
  })

  it('just in time: the slot is here and nothing was prepared → generate and (dry-run) publish one', async () => {
    distinctDrafts()
    await store.setAutonomous(true)
    const r = await runPublish({ store, provider: x, cfg: cfg({ AUTONOMOUS_PUBLISHING: 'true' }), now: at('2026-10-20T14:10:00Z') })
    expect(r.publish).toEqual([expect.objectContaining({ ok: true, status: 'dry_run' })])
    const r2 = await runPublish({ store, provider: x, cfg: cfg({ AUTONOMOUS_PUBLISHING: 'true' }), now: at('2026-10-20T14:40:00Z') })
    expect(r2.publish).toEqual([])
  })

  it('prepare collects platform metrics for recent published posts (null stays null)', async () => {
    const p = store.seed({ content_pillar: 'founder_journey', topic: 't', text: 'I deleted most of my first prototype.', status: 'published', published_at: '2026-10-19T14:00:00Z', external_post_id: '555' })
    x.metrics.set('555', { impressions: 900, likes: 20, reposts: 2, replies: 5, quotes: 0, bookmarks: 3, profileVisits: null, linkClicks: null })
    expect(await collectPlatformMetrics(store, x, NOW)).toEqual({ updated: 1 })
    expect((await store.getPost(p.id))!.metrics).toEqual({ impressions: 900, likes: 20, reposts: 2, replies: 5, quotes: 0, bookmarks: 3, profileVisits: null, linkClicks: null })
    expect(store.snapshots).toHaveLength(1)
  })
})
