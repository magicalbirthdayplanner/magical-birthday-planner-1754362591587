/** Founder marketing agent: pillar rotation, topics, link/image policy, repetition, time slots, config defaults. */
import { describe, expect, it } from 'vitest'
import { autonomousEffective, readMarketingConfig } from '@/lib/marketing/config'
import { defaultWeights, PILLAR_SPECS } from '@/lib/marketing/pillars'
import { checkRepetition, type HistoryItem } from '@/lib/marketing/repetition'
import { currentObjective, decideImage, decideLink, selectPillar, selectTopic, type StrategyPost } from '@/lib/marketing/strategy'
import { localDate, nextFreeSlot, zonedToUtc } from '@/lib/marketing/time'
import { PILLARS, type Pillar } from '@/lib/marketing/types'

const TZ = 'America/New_York'
const day = (n: number) => new Date(Date.UTC(2026, 9, 20 + n, 14)) // Oct 20 + n, 10:00 EDT

function simulate(days: number, start = 0, multipliers?: Partial<Record<Pillar, number>>) {
  const history: StrategyPost[] = []
  for (let i = start; i < start + days; i++) {
    const now = day(i)
    const { pillar } = selectPillar(history, { now, tz: TZ, launchDate: '2026-10-13', multipliers })
    const topic = selectTopic(pillar, history, now)
    history.push({ id: `p${i}`, pillar, topicKey: topic.key, status: 'published', hasLink: decideLink(pillar, history, 0.35), hasImage: decideImage(pillar, history), at: now.toISOString() })
  }
  return history
}

describe('content pillar rotation', () => {
  it('the default weekly mix sums to 100 and matches the brief', () => {
    const w = defaultWeights()
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(100)
    expect(w).toMatchObject({ founder_journey: 30, parent_pain: 20, useful_tips: 15, product_education: 15, ai_thinking: 10, community_question: 10, launch_invitation: 0 })
  })

  it('over 60 days the mix tracks the targets, never repeats a pillar back to back (an invitation counts as product), and invites at most every 10 days', () => {
    const h = simulate(60)
    const share = (p: Pillar) => h.filter((x) => x.pillar === p).length / h.length
    expect(share('founder_journey')).toBeGreaterThan(0.2)
    expect(share('founder_journey')).toBeLessThan(0.36)
    expect(share('parent_pain')).toBeGreaterThan(0.13)
    expect(share('community_question')).toBeGreaterThan(0.05)
    const promo = (p: Pillar) => (p === 'launch_invitation' ? 'product_education' : p)
    for (let i = 1; i < h.length; i++) expect(promo(h[i].pillar), `day ${i}`).not.toBe(promo(h[i - 1].pillar))
    const launches = h.filter((x) => x.pillar === 'launch_invitation').map((x) => new Date(x.at).getTime())
    expect(launches.length).toBeGreaterThan(0)
    for (let i = 1; i < launches.length; i++) expect(launches[i] - launches[i - 1]).toBeGreaterThanOrEqual(10 * 86_400_000)
    // Majority is not promotional.
    expect(h.filter((x) => x.pillar === 'launch_invitation' || x.pillar === 'product_education').length / h.length).toBeLessThanOrEqual(0.2)
  })

  it('launch day opens with one invitation', () => {
    const now = new Date('2026-10-13T13:00:00Z')
    expect(selectPillar([], { now, tz: TZ, launchDate: '2026-10-13' }).pillar).toBe('launch_invitation')
    const after = [{ id: 'a', pillar: 'launch_invitation' as Pillar, topicKey: 'launch-day', status: 'published', hasLink: true, hasImage: true, at: now.toISOString() }]
    expect(selectPillar(after, { now, tz: TZ, launchDate: '2026-10-13' }).pillar).not.toBe('launch_invitation')
  })

  it('learning multipliers shift the mix, clamped to 0.75–1.35', () => {
    const base = simulate(60).filter((x) => x.pillar === 'parent_pain').length
    const boosted = simulate(60, 0, { parent_pain: 9, founder_journey: 0.01 }).filter((x) => x.pillar === 'parent_pain').length
    expect(boosted).toBeGreaterThan(base)
    const r = selectPillar([], { now: day(0), tz: TZ, launchDate: '2026-10-13', multipliers: { parent_pain: 9 } })
    const t = r.targets as Record<string, number>
    expect(t.parent_pain / t.useful_tips).toBeCloseTo((20 * 1.35) / 15, 5)
  })

  it('the founder can force a pillar', () => {
    expect(selectPillar([], { now: day(0), tz: TZ, launchDate: '2026-10-13', forced: 'ai_thinking' }).pillar).toBe('ai_thinking')
  })
})

describe('topics, links and images', () => {
  it('rotates topics least-recently-used', () => {
    const h = simulate(40)
    const tips = h.filter((x) => x.pillar === 'useful_tips').map((x) => x.topicKey)
    expect(new Set(tips).size).toBe(Math.min(tips.length, PILLAR_SPECS.useful_tips.topics.length))
  })
  it('keeps the link share near 35% and never on community questions; always on invitations', () => {
    const h = simulate(60)
    const linked = h.filter((x) => x.hasLink).length / h.length
    expect(linked).toBeGreaterThanOrEqual(0.25)
    expect(linked).toBeLessThanOrEqual(0.42)
    expect(h.filter((x) => x.pillar === 'community_question').every((x) => !x.hasLink && !x.hasImage)).toBe(true)
    expect(h.filter((x) => x.pillar === 'launch_invitation').every((x) => x.hasLink && x.hasImage)).toBe(true)
    for (let i = 1; i < h.length; i++) if (h[i].pillar !== 'launch_invitation') expect(h[i].hasLink && h[i - 1].hasLink).toBe(false)
  })
})

describe('objective', () => {
  it('moves from pre-launch to launch week to growth', () => {
    expect(currentObjective(new Date('2026-10-10T15:00:00Z'), '2026-10-13', TZ).phase).toBe('pre_launch')
    expect(currentObjective(new Date('2026-10-15T15:00:00Z'), '2026-10-13', TZ).phase).toBe('launch_week')
    expect(currentObjective(new Date('2026-11-01T15:00:00Z'), '2026-10-13', TZ).phase).toBe('growth')
  })
})

describe('repetition check', () => {
  const now = new Date('2026-10-20T14:00:00Z')
  const h = (over: Partial<HistoryItem>): HistoryItem => ({ id: 'old', text: '', hook: null, cta: null, topicKey: null, status: 'published', at: '2026-10-15T14:00:00Z', ...over })
  it('flags the same idea in other words', () => {
    const r = checkRepetition({ text: 'Why do parents need 20 browser tabs to plan a birthday?' }, [h({ text: 'Planning a birthday is stressful because you need 20 tabs' })], now)
    expect(r.repetitive).toBe(true)
    expect(r.reasons[0].code).toBe('same_idea')
    expect(r.closestId).toBe('old')
  })
  it('flags a reused opening, CTA and topic', () => {
    const r = checkRepetition(
      { text: 'I kept finding myself rewriting the guest list. So the app keeps one list.', cta: 'Try it for your next party.', topicKey: 'guest-list' },
      [h({ text: 'I kept finding myself lost in venue reviews late at night.', cta: 'Try it for your next party!', topicKey: 'guest-list' })],
      now,
    )
    expect(r.reasons.map((x) => x.code).sort()).toEqual(['same_cta', 'same_opening', 'same_topic'])
  })
  it('ignores old, cancelled and excluded posts', () => {
    const t = 'Planning a birthday is stressful because you need 20 tabs'
    expect(checkRepetition({ text: t }, [h({ text: t, at: '2026-08-01T00:00:00Z' })], now).repetitive).toBe(false)
    expect(checkRepetition({ text: t }, [h({ text: t, status: 'cancelled' })], now).repetitive).toBe(false)
    expect(checkRepetition({ text: t, excludeIds: ['old'] }, [h({ text: t })], now).repetitive).toBe(false)
  })
  it('accepts a genuinely new idea', () => {
    expect(checkRepetition({ text: 'Set the RSVP date a week before the party and send one friendly reminder.' }, [h({ text: 'Planning a birthday is stressful because you need 20 tabs' })], now).repetitive).toBe(false)
  })
})

describe('time slots (America/New_York, DST-safe)', () => {
  it('converts local wall-clock to UTC across DST', () => {
    expect(zonedToUtc('2026-10-20', '10:00', TZ).toISOString()).toBe('2026-10-20T14:00:00.000Z')
    expect(zonedToUtc('2026-11-20', '10:00', TZ).toISOString()).toBe('2026-11-20T15:00:00.000Z')
    expect(localDate(new Date('2026-10-21T03:30:00Z'), TZ)).toBe('2026-10-20')
  })
  it('finds the next free slot, one per day by default', () => {
    const now = new Date('2026-10-20T12:00:00Z') // 08:00 EDT
    const first = nextFreeSlot(now, { times: ['10:00'], perDay: 1, tz: TZ, taken: [] })!
    expect(first.toISOString()).toBe('2026-10-20T14:00:00.000Z')
    const second = nextFreeSlot(now, { times: ['10:00'], perDay: 1, tz: TZ, taken: [first] })!
    expect(second.toISOString()).toBe('2026-10-21T14:00:00.000Z')
    const late = nextFreeSlot(new Date('2026-10-20T13:45:00Z'), { times: ['10:00'], perDay: 1, tz: TZ, taken: [] })!
    expect(late.toISOString()).toBe('2026-10-21T14:00:00.000Z') // inside the lead time → tomorrow
  })
})

describe('configuration defaults are safe', () => {
  it('dry-run ON, autonomous OFF, 8 posts/day across the day, $5 X budget, New York', () => {
    const c = readMarketingConfig({})
    expect(c).toMatchObject({ dryRun: true, autonomousAllowed: false, postsPerDay: 8, timezone: TZ, xMaxChars: 280, imageProvider: 'brand', urlShare: 0.1, xBudgetUsd: 5, utmCampaign: 'mbp_x_growth', minGapMinutes: 60 })
    expect(c.postTimes).toEqual(['08:00', '10:30', '12:30', '14:30', '16:30', '18:00', '19:30', '21:00'])
    expect(autonomousEffective(c, true)).toBe(false)
  })
  it('only the exact strings turn things on; frequency is capped at 8/day', () => {
    expect(readMarketingConfig({ MARKETING_DRY_RUN: '0' }).dryRun).toBe(true)
    expect(readMarketingConfig({ MARKETING_DRY_RUN: 'false' }).dryRun).toBe(false)
    expect(readMarketingConfig({ AUTONOMOUS_PUBLISHING: 'yes' }).autonomousAllowed).toBe(false)
    expect(readMarketingConfig({ MARKETING_POSTS_PER_DAY: '30' }).postsPerDay).toBe(8)
    expect(readMarketingConfig({ MARKETING_POSTS_PER_DAY: '2' }).postsPerDay).toBe(2)
    expect(readMarketingConfig({ MARKETING_TIMEZONE: 'Mars/Base' }).timezone).toBe(TZ)
    expect(readMarketingConfig({ MARKETING_URL_SHARE: '0.9' }).urlShare).toBe(0.4)
    const c = readMarketingConfig({ AUTONOMOUS_PUBLISHING: 'true' })
    expect(autonomousEffective(c, false)).toBe(false)
    expect(autonomousEffective(c, true)).toBe(true)
  })
  it('every pillar has topics and a brief', () => {
    for (const p of PILLARS) {
      expect(PILLAR_SPECS[p].topics.length, p).toBeGreaterThan(2)
      expect(PILLAR_SPECS[p].brief.length, p).toBeGreaterThan(40)
    }
  })
})
