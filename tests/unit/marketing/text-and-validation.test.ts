/** Founder marketing agent: X length rules, claim/safety validation, idea fingerprint. */
import { describe, expect, it } from 'vitest'
import { conceptSet, ideaSimilarity, openingWords, xWeightedLength } from '@/lib/marketing/text'
import { claimIssues, validatePost } from '@/lib/marketing/validation'
import { utmUrl } from '@/lib/marketing/strategy'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const LINK = utmUrl(ID)
const v = (text: string, extra: Partial<Parameters<typeof validatePost>[1]> = {}) => validatePost(text, { pillar: 'founder_journey', maxChars: 280, allowedLink: null, ...extra })
const codes = (text: string, extra: Partial<Parameters<typeof validatePost>[1]> = {}) => v(text, extra).errors.map((e) => e.code)
const OK = 'I started building a birthday planner because planning one party turned into tabs, texts and sticky notes. There had to be a calmer way.'

describe('X weighted length', () => {
  it('counts Latin text 1, URLs 23, emoji 2, CJK 2', () => {
    expect(xWeightedLength('hello')).toBe(5)
    expect(xWeightedLength(`hi ${LINK}`)).toBe(3 + 23)
    expect(xWeightedLength('party 🎉')).toBe(8)
    expect(xWeightedLength('👨‍👩‍👧')).toBe(2) // one ZWJ sequence
    expect(xWeightedLength('生日')).toBe(4)
  })
})

describe('validatePost — length', () => {
  it('accepts a normal post', () => {
    const r = v(OK)
    expect(r.ok).toBe(true)
    expect(r.weightedLength).toBe(OK.length)
  })
  it('rejects posts over the account limit and very short ones; warns above 250', () => {
    expect(codes('a '.repeat(150))).toContain('too_long')
    expect(codes('Hi there.')).toContain('too_short')
    expect(v('word '.repeat(52).trim()).warnings.map((w) => w.code)).toContain('long')
    expect(v('word '.repeat(52).trim(), { maxChars: 25_000 }).errors).toEqual([])
  })
})

describe('validatePost — unsupported claims', () => {
  const bad: [string, string][] = [
    ['Over 500 parents already use it to plan parties.', 'user_count'],
    ['Hundreds of parents love this planner.', 'user_count'],
    ['We just passed 1,200 sign-ups this week.', 'user_count'],
    ['Trusted by busy parents everywhere.', 'social_proof'],
    ['We hit $5k MRR this month, thank you all.', 'revenue'],
    ['Rated 4.9 by parents in our beta.', 'rating'],
    ['"This saved my weekend!" — Sarah, mom of two', 'testimonial'],
    ['A mom told me this saved her weekend.', 'testimonial'],
    ['Featured in TechCrunch this morning.', 'press_award'],
    ['Award-winning birthday planning, finally.', 'press_award'],
    ['Proud to be partnered with a big toy brand.', 'partnership'],
    ['Only 3 spots left — hurry before it sells out.', 'scarcity'],
    ['Limited time: plan your party today.', 'scarcity'],
    ['Pro plan is $29.99 per party.', 'pricing'],
    ['Try it for free this weekend.', 'pricing'],
    ['The best birthday planner on the internet.', 'superlative'],
    ['Built on ChatGPT so it is smart.', 'ai_vendor'],
    ['Better than Evite for RSVPs.', 'competitor'],
    ['This will revolutionize birthday planning.', 'marketing_speak'],
    ['Seamlessly plan every detail.', 'marketing_speak'],
    ['Like and retweet if you agree with me.', 'engagement_bait'],
    ['Tag a mom friend who needs this today.', 'engagement_bait'],
    ['My take on the election and birthday parties.', 'off_topic'],
    ['Lazy parents always forget the RSVP list.', 'offensive'],
    ['Don’t let a bad venue ruin the party for everyone.', 'fear'],
    ['Our Paw Patrol party kit is the cutest one yet.', 'protected_name'],
  ]
  for (const [text, code] of bad) {
    it(`rejects: ${text}`, () => expect(claimIssues(text).map((i) => i.code)).toContain(code))
  }
  const good = [
    'Before you send invitations, lock down the date, the headcount and the venue. Everything else gets easier.',
    'Question for parents: venue or guest list — which one stresses you out more?',
    'One thing I am learning while building this: parents do not need another app to manage. They need fewer things to manage.',
    'A 5.0 rating from 3 reviews should not beat a 4.7 from hundreds. So the venue ranking does not let it.',
    'Plan for about 70% of invited kids to come, then adjust when RSVPs land.',
    'For a 6-year-old, 90 minutes is plenty. Two hours if there is food and cake.',
  ]
  for (const text of good) it(`accepts: ${text.slice(0, 50)}…`, () => expect(claimIssues(text)).toEqual([]))

  it('forbidden terms (founder/family names) are rejected, case-insensitively, whole words only', () => {
    expect(claimIssues('Built for Maya and her friends.', ['maya']).map((i) => i.code)).toContain('forbidden_term')
    expect(claimIssues('Mayan-themed parties are fun.', ['maya'])).toEqual([])
  })
})

describe('validatePost — links, mentions, hashtags, emoji', () => {
  it('only the exact UTM link chosen for this post', () => {
    expect(v(`${OK}\n\n${LINK}`, { allowedLink: LINK }).ok).toBe(true)
    expect(codes(`${OK}\n\n${LINK}`)).toContain('link_not_allowed')
    expect(codes(`${OK}\n\nhttps://magicalbirthdayplanner.app/`, { allowedLink: LINK })).toContain('link_not_allowed')
    expect(codes(`${OK} https://example.com`)).toContain('foreign_link')
    expect(codes(`${OK}\n\n${LINK}`, { allowedLink: LINK, pillar: 'community_question' })).toContain('link_not_allowed')
  })
  it('no @mentions, at most two hashtags/emoji', () => {
    expect(codes(`${OK} @someone`)).toContain('mention')
    expect(codes(`${OK} #a #b #c`)).toContain('hashtags')
    expect(v(`${OK} #parenting`).ok).toBe(true)
    expect(codes(`${OK} 🎉🎈🎂`)).toContain('emoji')
    expect(v(`${OK} 🎉`).ok).toBe(true)
  })
})

describe('idea similarity', () => {
  it('recognises the same idea in different words', () => {
    const a = 'Planning a birthday is stressful because you need 20 tabs'
    const b = 'Why do parents need 20 browser tabs to plan a birthday?'
    expect(ideaSimilarity(a, b)).toBeGreaterThanOrEqual(0.6)
    expect(conceptSet(b).has('tab')).toBe(true)
  })
  it('keeps different ideas apart', () => {
    expect(ideaSimilarity('Planning a birthday is stressful because you need 20 tabs', 'Set an RSVP date a week before the party and send one friendly reminder.')).toBeLessThan(0.4)
    expect(ideaSimilarity('Question: home party or venue party?', 'I deleted most of my old prototype instead of patching it.')).toBeLessThan(0.3)
  })
  it('opening words ignore case and punctuation', () => {
    expect(openingWords('I kept finding myself with tabs open.')).toBe(openingWords('i KEPT finding, myself lost'))
  })
})

describe('UTM link', () => {
  it('matches the documented format', () => {
    expect(utmUrl(ID)).toBe(`https://magicalbirthdayplanner.app/?utm_source=x&utm_medium=social&utm_campaign=mbp_x_growth&utm_content=${ID}`)
  })
})

describe('generated-copy checks', () => {
  it('launch dates must be right (Oct 13 2026 is a Tuesday)', async () => {
    const { dateIssues } = await import('@/lib/marketing/validation')
    const ctx = { today: '2026-10-10', launchDate: '2026-10-13' }
    expect(dateIssues('Launching Monday. Tell me what to fix.', ctx)[0]).toMatch(/Wrong launch day: launch is Tuesday/)
    expect(dateIssues('Launching Tuesday. Tell me what to fix.', ctx)).toEqual([])
    expect(dateIssues('It launches tomorrow!', ctx)).toEqual(['Says the launch is tomorrow, which is not true.'])
    expect(dateIssues('It launches tomorrow!', { ...ctx, today: '2026-10-12' })).toEqual([])
    expect(dateIssues('We are launching soon.', { ...ctx, today: '2026-10-20' })[0]).toMatch(/already happened/)
    expect(dateIssues('Monday is a good day to send invitations.', ctx)).toEqual([])
  })
  it('the model may not invent counts for the founder story', async () => {
    const { inventedSpecifics } = await import('@/lib/marketing/validation')
    expect(inventedSpecifics('I planned a party with 11 tabs and 3 threads.')).toHaveLength(1)
    expect(inventedSpecifics('I planned a party across a lot of tabs.')).toEqual([])
    expect(inventedSpecifics('Invite 12 kids for a 90 minute party.')).toEqual([])
  })
})
