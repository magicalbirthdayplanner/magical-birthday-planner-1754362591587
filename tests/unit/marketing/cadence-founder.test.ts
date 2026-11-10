/**
 * Owner ruling 2026-11-09: X is founder-led (founder story, building in public, the solo-founder journey, feedback
 * asks — no parenting tips), Instagram and Facebook post three times a week. No network: mock AI, in-memory store.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetAIConfig } from '@/lib/ai/config'
import { mockCalls, resetMock, scriptMock } from '@/lib/ai/providers/mock'
import { daysToWrite, generateDay } from '@/lib/marketing/batch'
import { cadenceFor, parsePostDays, readMarketingConfig } from '@/lib/marketing/config'
import { LIBRARY } from '@/lib/marketing/library'
import { PILLAR_SPECS } from '@/lib/marketing/pillars'
import { X_FOUNDER_ROLES, planSlots, planWeek, xFounderRoles } from '@/lib/marketing/planner'
import { selectTopic } from '@/lib/marketing/strategy'
import { weekdayIndex } from '@/lib/marketing/time'
import { MemoryMarketingStore } from '../../helpers/marketing-memory-store'

const NOW = new Date('2026-11-09T12:00:00Z') // Monday 07:00 EST
let store: MemoryMarketingStore

beforeEach(() => {
  process.env.AI_PROVIDER = 'mock'
  resetAIConfig()
  resetMock()
  store = new MemoryMarketingStore()
  store.clock = () => NOW
})
afterEach(() => {
  delete process.env.AI_PROVIDER
  resetAIConfig()
})

describe('posting days', () => {
  it('parses weekday names (Monday = 0), "daily", and falls back on nonsense', () => {
    expect(parsePostDays('Tue,Thu,Sat', [])).toEqual([1, 3, 5])
    expect(parsePostDays('friday, monday ,wednesday', [])).toEqual([0, 2, 4])
    expect(parsePostDays('daily', [])).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(parsePostDays('someday', [6])).toEqual([6])
    expect(parsePostDays(undefined, [2])).toEqual([2])
    expect(weekdayIndex('2026-11-09')).toBe(0) // Monday
    expect(weekdayIndex('2026-11-15')).toBe(6) // Sunday
  })

  it('defaults: Instagram Tue/Thu/Sat 12:30, Facebook Mon/Wed/Fri 09:00, one post on those days; X every day', () => {
    const cfg = readMarketingConfig({ MARKETING_PLATFORMS: 'x,instagram,facebook' })
    expect(cadenceFor(cfg, 'instagram')).toMatchObject({ postsPerDay: 1, postTimes: ['12:30'], postDays: [1, 3, 5] })
    expect(cadenceFor(cfg, 'facebook')).toMatchObject({ postsPerDay: 1, postTimes: ['09:00'], postDays: [0, 2, 4] })
    expect(cadenceFor(cfg, 'x').postDays).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(cfg.xMix).toBe('founder')
    expect(readMarketingConfig({ MARKETING_X_MIX: 'full' }).xMix).toBe('full')
  })

  it('Instagram and Facebook plan 3 posts a week, only on their days, with a varied mix', async () => {
    const cfg = readMarketingConfig({ MARKETING_PLATFORMS: 'x,instagram,facebook' })
    const ig = planSlots(await planWeek(store, cfg, { weekStart: '2026-11-09', now: NOW, budget: null, platform: 'instagram' }))
    expect(ig.map((s) => [s.date, s.time])).toEqual([['2026-11-10', '12:30'], ['2026-11-12', '12:30'], ['2026-11-14', '12:30']])
    expect(new Set(ig.map((s) => s.role)).size).toBe(3)
    expect(ig.every((s) => s.media.source !== 'none')).toBe(true)
    const fb = planSlots(await planWeek(store, cfg, { weekStart: '2026-11-09', now: NOW, budget: null, platform: 'facebook' }))
    expect(fb.map((s) => s.date)).toEqual(['2026-11-09', '2026-11-11', '2026-11-13'])
    expect(new Set(fb.map((s) => s.role)).size).toBe(3)
    // The next week uses the other set of roles.
    const fb2 = planSlots(await planWeek(store, cfg, { weekStart: '2026-11-16', now: NOW, budget: null, platform: 'facebook' }))
    expect(fb2.map((s) => s.role)).not.toEqual(fb.map((s) => s.role))
  })

  it('the content bank only asks for posting days', async () => {
    const cfg = readMarketingConfig({ MARKETING_PLATFORMS: 'instagram', MARKETING_BANK_DAYS: '14' })
    const days = await daysToWrite(store, cfg, { platform: 'instagram', now: NOW })
    expect(days.length).toBe(6)
    expect(days.every((d) => [1, 3, 5].includes(weekdayIndex(d)))).toBe(true)
  })
})

describe('founder-led X', () => {
  const cfg = readMarketingConfig({ MARKETING_POSTS_PER_DAY: '2', MARKETING_POST_TIMES: '09:00,17:30', MARKETING_URL_SHARE: '0.15' })

  it('roles: the founder story every day, then a feedback ask (question or invitation to try it)', () => {
    expect(xFounderRoles(0, 2)).toEqual(['founder_story', 'conversation'])
    expect(xFounderRoles(1, 2)).toEqual(['founder_story', 'soft_conversion'])
    expect(xFounderRoles(0, 3)).toEqual(['founder_story', 'educational', 'conversation'])
    for (let d = 0; d < 7; d++) for (const n of [1, 2, 3, 4, 8]) expect(xFounderRoles(d, n).every((r) => X_FOUNDER_ROLES.includes(r))).toBe(true)
  })

  it('plans no tips, polls or product cards; questions ask for feedback; links only on invitations to try it', async () => {
    const slots = planSlots(await planWeek(store, cfg, { weekStart: '2026-11-09', now: NOW, budget: null }))
    expect(slots).toHaveLength(14)
    expect(slots.every((s) => ['founder_journey', 'ai_thinking', 'community_question', 'launch_invitation'].includes(s.pillar))).toBe(true)
    expect(slots.some((s) => ['parent_tip', 'poll', 'product', 'visual'].includes(s.role))).toBe(false)
    expect(slots.every((s) => s.format !== 'poll' && !!s.brief)).toBe(true)
    const questions = slots.filter((s) => s.role === 'conversation')
    expect(questions.length).toBeGreaterThan(0)
    const xOnly = new Set(PILLAR_SPECS.community_question.topics.filter((t) => t.platforms?.includes('x')).map((t) => t.key))
    expect(questions.every((s) => xOnly.has(s.topicKey))).toBe(true)
    expect(slots.filter((s) => s.link).every((s) => s.role === 'soft_conversion')).toBe(true)
  })

  it('the batch prompt asks for building in public, and the library fallback only uses founder and feedback items', async () => {
    scriptMock((req) => {
      expect(req.messages[0].content).toMatch(/solo founder building in public/)
      expect(req.messages[1].content).toMatch(/Build in public as a solo founder/)
      return '{"posts": []}' // nothing usable → the library fills in
    })
    const r = await generateDay(store, cfg, { date: '2026-11-10', now: NOW, env: {} })
    expect(mockCalls().length).toBeGreaterThanOrEqual(1)
    expect(r.library.length + r.skipped.length).toBe(2)
    const keys = [...store.rows.values()].map((p) => String(p.topic_key).replace(/^lib:/, ''))
    const items = LIBRARY.filter((i) => keys.includes(i.key))
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.platforms?.includes('x') || ['founder_journey', 'ai_thinking', 'launch_invitation'].includes(i.pillar))).toBe(true)
  }, 30_000)

  it('X-only topics and library items never reach Instagram or Facebook', () => {
    const shared = selectTopic('community_question', [], NOW)
    expect(shared.platforms).toBeUndefined()
    for (let i = 0; i < 20; i++) expect(selectTopic('founder_journey', [], new Date(NOW.getTime() + i * 86_400_000)).platforms).toBeUndefined()
    expect(LIBRARY.filter((i) => i.platforms?.includes('x')).length).toBeGreaterThanOrEqual(10)
  })

  it('MARKETING_X_MIX=full keeps the original eight-role mix', async () => {
    const full = readMarketingConfig({ MARKETING_X_MIX: 'full' })
    const slots = planSlots(await planWeek(store, full, { weekStart: '2026-11-16', now: NOW, budget: null }))
    expect(slots.slice(0, 8).map((s) => s.role)).toEqual(['founder_story', 'parent_tip', 'conversation', 'visual', 'educational', 'product', 'poll', 'soft_conversion'])
    expect(slots.every((s) => !s.brief)).toBe(true)
  })
})
