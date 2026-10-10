/** Founder marketing agent: learning loop, daily brief, admin actions, image safety. Real numbers only. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetAIConfig } from '@/lib/ai/config'
import { resetMock } from '@/lib/ai/providers/mock'
import { deletePost, postAction, type AdminContext } from '@/lib/marketing/admin'
import { buildDailyBrief, runDailyBrief } from '@/lib/marketing/brief'
import { readMarketingConfig } from '@/lib/marketing/config'
import { confetti } from '@/lib/marketing/images/brand-card'
import { fullImagePrompt, imagePromptIssues, sanitizeImagePrompt } from '@/lib/marketing/images/safety'
import { computeInsights, hookStyle, runLearning } from '@/lib/marketing/learning'
import type { MarketingProvider } from '@/lib/marketing/providers/types'
import { utmUrl } from '@/lib/marketing/strategy'
import type { MarketingPost, Pillar } from '@/lib/marketing/types'
import { MemoryMarketingStore } from '../../helpers/marketing-memory-store'

const NOW = new Date('2026-10-30T12:00:00Z')
const TZ = 'America/New_York'
let store: MemoryMarketingStore

function published(pillar: Pillar, i: number, m: { impressions: number | null; likes?: number; replies?: number; profileVisits?: number | null; linkClicks?: number | null; signups?: number; visits?: number; link?: boolean; hour?: number }): MarketingPost {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
  return store.seed({
    id, content_pillar: pillar, topic: `t${i}`, topic_key: `k${i}`, text: `Post number ${i} about ${pillar}`, hook: `Post number ${i}`, status: 'published',
    published_at: new Date(Date.UTC(2026, 9, 20 + (i % 9), m.hour ?? 14)).toISOString(), external_post_id: String(1000 + i),
    impressions: m.impressions, likes: m.likes ?? 0, reposts: 0, replies: m.replies ?? 0, quotes: 0, bookmarks: 0, profile_visits: m.profileVisits ?? null, link_clicks: m.linkClicks ?? null,
    link_url: m.link ? utmUrl(id) : null, signups_attributed: m.signups ?? 0, landing_visits_attributed: m.visits ?? 0,
  })
}

beforeEach(() => {
  store = new MemoryMarketingStore()
  store.clock = () => NOW
})

describe('learning loop', () => {
  it('says "not enough data" and changes nothing with fewer than 3 posts', async () => {
    published('founder_journey', 1, { impressions: 500 })
    const r = computeInsights(await store.listPosts({}), { tz: TZ, windowDays: 30, now: NOW })
    expect(r.recommendations.at(-1)).toMatch(/Not enough data yet \(1 published post in 30 days\)/)
    expect(r.pillarMultipliers).toEqual({})
  })

  it('compares pillars with the real numbers and sample sizes, and nudges weights within 0.75–1.35', async () => {
    let i = 0
    for (let k = 0; k < 3; k++) published('founder_journey', i++, { impressions: 1000, likes: 40, profileVisits: 24, linkClicks: null })
    for (let k = 0; k < 3; k++) published('product_education', i++, { impressions: 1000, likes: 10, profileVisits: 10, linkClicks: 30, link: true, signups: 2, visits: 20 })
    const posts = await store.listPosts({ statuses: ['published'] })
    const r = computeInsights(posts, { tz: TZ, windowDays: 30, now: NOW })
    expect(r.sampleSize).toBe(6)
    expect(r.recommendations).toContain('Founder journey posts got 2.4× the profile-visit rate of Product education posts (2.4% vs 1.0%; 3 vs 3 posts).')
    expect(r.recommendations.some((s) => s.startsWith('Product education posts drove the most sign-ups (6 from 3 posts, 10.0% of 60 visits) despite below-average engagement'))).toBe(true)
    for (const v of Object.values(r.pillarMultipliers)) {
      expect(v).toBeGreaterThanOrEqual(0.75)
      expect(v).toBeLessThanOrEqual(1.35)
    }
    expect(Object.keys(r.pillarMultipliers).sort()).toEqual(['founder_journey', 'product_education'])
  })

  it('handles missing platform metrics honestly', async () => {
    for (let i = 0; i < 4; i++) published('parent_pain', i, { impressions: null })
    const r = computeInsights(await store.listPosts({}), { tz: TZ, windowDays: 30, now: NOW })
    expect(r.recommendations[0]).toMatch(/no impression data/)
  })

  it('runs every N days only (unless forced)', async () => {
    expect(await runLearning(store, { tz: TZ, windowDays: 30, intervalDays: 3, now: NOW })).not.toBeNull()
    expect(await runLearning(store, { tz: TZ, windowDays: 30, intervalDays: 3, now: NOW })).toBeNull()
    expect(await runLearning(store, { tz: TZ, windowDays: 30, intervalDays: 3, now: NOW, force: true })).not.toBeNull()
  })

  it('classifies hooks', () => {
    expect(hookStyle('What is the hardest part of planning?', '')).toBe('question')
    expect(hookStyle('I deleted most of my prototype.', '')).toBe('story')
    expect(hookStyle('Before you send invitations, do this.', '')).toBe('tip')
    expect(hookStyle('Parents need fewer things to manage.', '')).toBe('statement')
  })
})

describe('daily brief', () => {
  const cfg = readMarketingConfig({})
  it('shows yesterday’s real numbers and n/a for what X did not return', async () => {
    store.seed({ content_pillar: 'founder_journey', topic: 't', text: 'I deleted most of my first prototype.', hook: 'I deleted most of my first prototype.', status: 'published', published_at: '2026-10-29T14:00:00Z', impressions: 1842, likes: 37, replies: 8, reposts: 2, bookmarks: 1, quotes: 0, profile_visits: null, link_clicks: null, external_post_url: 'https://x.com/f/status/1' })
    const b = await buildDailyBrief(store, cfg, { now: NOW, autonomous: false, countCampaign: async () => ({ landingVisits: 23, signups: 4, partiesCreated: 2, checkouts: 1, purchases: 0 }) })
    expect(b.text).toContain('MBP MARKETING BRIEF')
    expect(b.text).toContain('Posts: 1')
    expect(b.text).toContain('Impressions: 1,842')
    expect(b.text).toContain('Likes: 37')
    expect(b.text).toContain('Profile visits: n/a')
    expect(b.text).toContain('Website visits (from X links): 23')
    expect(b.text).toContain('Signups: 4')
    expect(b.text).toContain('"I deleted most of my first prototype."')
    expect(b.text).toMatch(/Recommended content tomorrow:\n- /)
  })
  it('with no data it invents nothing', async () => {
    const b = await buildDailyBrief(store, cfg, { now: NOW, autonomous: false })
    expect(b.text).toContain('Posts: 0')
    expect(b.text).toContain('Impressions: n/a')
    expect(b.text).toContain('Signups: n/a')
    expect(b.text).toContain('No published post with metrics yet.')
  })
  it('is written once per local day and emailed once', async () => {
    const sent: string[] = []
    const c = readMarketingConfig({ MARKETING_BRIEF_EMAIL: 'founder@example.test' })
    const send = async (to: string) => (sent.push(to), true)
    expect(await runDailyBrief(store, c, { now: NOW, autonomous: false, send })).not.toBeNull()
    expect(await runDailyBrief(store, c, { now: NOW, autonomous: false, send })).toBeNull()
    expect(sent).toEqual(['founder@example.test'])
  })
})

describe('admin actions', () => {
  const provider = { platform: 'x', maxChars: 280, configured: () => true } as unknown as MarketingProvider
  const ctx = (): AdminContext => ({ store, cfg: readMarketingConfig({ MARKETING_POST_TIMES: '10:00,19:30', MARKETING_POSTS_PER_DAY: '1' }), provider, actor: '11111111-1111-4111-8111-111111111111', now: NOW })
  const draft = (over: Record<string, unknown> = {}) => store.seed({ content_pillar: 'useful_tips', topic: 't', text: 'Before you send invitations, lock down the date, the headcount and the venue. Everything else gets easier.', status: 'draft', ...over })
  beforeEach(() => {
    process.env.AI_PROVIDER = 'mock'
    resetAIConfig()
    resetMock()
  })
  afterEach(() => {
    delete process.env.AI_PROVIDER
    resetAIConfig()
  })

  it('approve → schedule (next free slot) → publish now (dry-run) → audited', async () => {
    const p = draft()
    expect(await postAction(ctx(), p.id, { action: 'approve' })).toMatchObject({ ok: true, post: { status: 'approved' } })
    const s = await postAction(ctx(), p.id, { action: 'schedule' })
    expect(s).toMatchObject({ ok: true, post: { status: 'scheduled', scheduledAt: '2026-10-30T14:00:00.000Z' } })
    expect(await postAction(ctx(), p.id, { action: 'publish_now' })).toMatchObject({ ok: true, detail: { status: 'dry_run' } })
    expect(store.auditLog.map((a) => a.action)).toEqual(['approved', 'scheduled', 'dry_run_publish'])
  })

  it('invalid text can be neither approved nor saved', async () => {
    const p = draft({ text: 'Trusted by hundreds of parents — only 3 spots left, hurry!' })
    const r = await postAction(ctx(), p.id, { action: 'approve' })
    expect(r).toMatchObject({ ok: false, status: 422 })
    expect(!r.ok && r.message).toMatch(/Social proof|scarcity|parents use it/i)
    expect(await postAction(ctx(), draft().id, { action: 'edit', text: 'This will revolutionize parties forever and ever, believe me.' })).toMatchObject({ ok: false, status: 422 })
  })

  it('editing an approved post sends it back to draft', async () => {
    const p = draft({ status: 'scheduled', scheduled_at: '2026-10-31T14:00:00Z' })
    const r = await postAction(ctx(), p.id, { action: 'edit', text: 'Set the RSVP date a week before the party, then send one friendly reminder. That is it.' })
    expect(r).toMatchObject({ ok: true, post: { status: 'draft', scheduledAt: null } })
  })

  it('schedule rejects past times; cancel + delete; published posts cannot be deleted', async () => {
    const p = draft()
    expect(await postAction(ctx(), p.id, { action: 'schedule', at: '2026-10-29T10:00:00Z' })).toMatchObject({ ok: false, status: 400 })
    expect(await deletePost(ctx(), store.seed({ content_pillar: 'useful_tips', topic: 't', text: 'x'.repeat(50), status: 'published' }).id)).toMatchObject({ ok: false, status: 409 })
    expect(await postAction(ctx(), p.id, { action: 'cancel' })).toMatchObject({ ok: true, post: { status: 'cancelled' } })
    expect(await deletePost(ctx(), p.id)).toEqual({ ok: true })
    expect(store.rows.has(p.id)).toBe(false)
  })

  it('an unconfirmed publish needs explicit confirmation, or can be linked to the live X post', async () => {
    const p = draft({ status: 'failed', publish_error_code: 'publish_unconfirmed', publishing_started_at: '2026-10-30T11:00:00Z' })
    expect(await postAction(ctx(), p.id, { action: 'publish_now' })).toMatchObject({ ok: false, status: 409 })
    expect(await postAction(ctx(), p.id, { action: 'link_external', url: 'https://evil.example/status/1' })).toMatchObject({ ok: false, status: 400 })
    expect(await postAction(ctx(), p.id, { action: 'link_external', url: 'https://x.com/founder/status/1880000000000000123' })).toMatchObject({
      ok: true,
      post: { status: 'published', externalPostId: '1880000000000000123', externalPostUrl: 'https://x.com/founder/status/1880000000000000123' },
    })
  })
})

describe('image safety and brand card', () => {
  it('flags and strips UI, social proof, numbers, logos and protected characters', () => {
    expect(imagePromptIssues('A screenshot of the app dashboard with 5 stars rating')).toEqual(expect.arrayContaining(['shows a user interface', 'shows social proof']))
    expect(imagePromptIssues('Elsa at a birthday party')).toContain('mentions a protected character or brand')
    expect(imagePromptIssues('Paper party hats and confetti on a wooden table, warm light')).toEqual([])
    expect(sanitizeImagePrompt('A dashboard with a logo and Pikachu')).not.toMatch(/dashboard|logo|pikachu/i)
    expect(fullImagePrompt('Confetti on a table')).toMatch(/no text, letters, numbers, logos/i)
  })
  it('confetti is deterministic per post and kept off the headline area', () => {
    expect(confetti('a')).toEqual(confetti('a'))
    expect(confetti('a')).not.toEqual(confetti('b'))
    for (const c of confetti('post-1')) if (c.x < 1000) expect(c.y).toBeLessThan(90)
  })
})
