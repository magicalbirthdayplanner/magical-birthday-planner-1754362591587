/** Hashtag layer: relevant tags per platform, placed above the link, within limits, idempotent. */
import { describe, expect, it } from 'vitest'
import { readMarketingConfig } from '@/lib/marketing/config'
import { addHashtags, pickHashtags, withHashtags } from '@/lib/marketing/hashtags'
import { utmUrl } from '@/lib/marketing/strategy'
import { ideaSimilarity, xWeightedLength } from '@/lib/marketing/text'
import { validatePost } from '@/lib/marketing/validation'

const cfg = readMarketingConfig({ MARKETING_PLATFORMS: 'x,instagram,facebook' })
const TIP = 'Set the RSVP date about a week before the party, then send one friendly reminder two days before it.\n\nOne nudge works better than five.'
const tags = (t: string) => t.match(/(^|\s)#[\p{L}\d_]+/gu)?.map((x) => x.trim()) ?? []
const post = (platform: 'x' | 'instagram' | 'facebook', text = TIP, linkUrl: string | null = null) => ({ platform, pillar: 'useful_tips' as const, topicKey: 'rsvp-deadline', linkUrl, text })

describe('hashtags', () => {
  it('adds 2 on X, 5 on Instagram, 3 on Facebook — topic first, no duplicates', () => {
    const x = addHashtags(post('x'), cfg)
    const ig = addHashtags(post('instagram'), cfg)
    const fb = addHashtags(post('facebook'), cfg)
    expect(tags(x)).toHaveLength(2)
    expect(tags(ig)).toHaveLength(5)
    expect(tags(fb)).toHaveLength(3)
    expect(tags(x)[0]).toBe('#BirthdayInvitations')
    expect(new Set(tags(ig).map((t) => t.toLowerCase())).size).toBe(5)
    expect(x.startsWith(TIP)).toBe(true)
    for (const [t, p] of [[x, 'x'], [ig, 'instagram'], [fb, 'facebook']] as const) expect(validatePost(t, { pillar: 'useful_tips', ...{ maxChars: p === 'x' ? 280 : 2200, maxHashtags: p === 'x' ? 2 : p === 'instagram' ? 5 : 3 }, allowedLink: null }).ok).toBe(true)
  })

  it('puts tags above a trailing link and keeps the link last', () => {
    const link = utmUrl('0f8fad5b-d9cb-469f-a165-70867728950e', 'facebook')
    const out = addHashtags(post('facebook', `${TIP}\n\n${link}`, link), cfg)
    expect(out.endsWith(`\n\n${link}`)).toBe(true)
    expect(tags(out)).toHaveLength(3)
  })

  it('is idempotent and tops up an existing closing line without repeating it', () => {
    const once = addHashtags(post('instagram'), cfg)
    expect(addHashtags(post('instagram', once), cfg)).toBe(once)
    const mine = addHashtags(post('instagram', `${TIP}\n\n#birthdayplanning #kidsparty`), cfg)
    expect(tags(mine)).toHaveLength(5)
    expect(tags(mine).slice(0, 2)).toEqual(['#birthdayplanning', '#kidsparty'])
    expect(tags(mine).filter((t) => t.toLowerCase() === '#kidsparty')).toHaveLength(1)
  })

  it('never breaks the X length limit: fewer tags, or none', () => {
    const long = 'a'.repeat(262)
    const one = withHashtags(long, { platform: 'x', pillar: 'useful_tips', target: 2, max: 2, maxChars: 280 })
    expect(xWeightedLength(one)).toBeLessThanOrEqual(280)
    expect(tags(one).length).toBeLessThan(2)
    const full = 'a'.repeat(279)
    expect(withHashtags(full, { platform: 'x', pillar: 'useful_tips', target: 2, max: 2, maxChars: 280 })).toBe(full)
  })

  it('founder and AI posts get their own audience tags', () => {
    expect(pickHashtags({ platform: 'x', pillar: 'founder_journey', text: 'I deleted the first prototype.' }, 2)).toContain('#BuildInPublic')
    expect(pickHashtags({ platform: 'instagram', pillar: 'ai_thinking', text: 'Why the AI is not a chatbot.' }, 5)).toContain('#AI')
  })

  it('shared hashtags do not make two different ideas look alike', () => {
    const a = 'Write the guest list before you pick the venue.\n\n#KidsBirthdayParty #PartyPlanning #ParentingTips'
    const b = 'Order the cake two weeks ahead and ask about allergies.\n\n#KidsBirthdayParty #PartyPlanning #ParentingTips'
    expect(ideaSimilarity(a, b)).toBeLessThan(0.3)
  })
})
