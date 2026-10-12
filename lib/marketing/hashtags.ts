/**
 * Hashtags are added by the system, not the model: relevant to the post's topic and pillar, in platform-sized doses
 * (X 2 · Instagram 5 · Facebook 3), on their own line after the body (before a link). Deterministic and free, so the
 * whole bank — including posts written before this existed — gets them at publish time.
 */
import type { MarketingConfig } from './config'
import { cadenceFor } from './config'
import { xWeightedLength } from './text'
import type { MarketingPost, Pillar, Platform } from './types'

/** Characters an X post leaves free for its two hashtags (the model is told to write this much shorter). */
export const X_HASHTAG_ROOM = 28

export const HASHTAG_RE = /(^|\s)#[\p{L}\d_]+/gu

/** Topic → tags, most specific first. Matched against the topic key and the post text. */
const TOPIC_RULES: [RegExp, string[]][] = [
  [/rsvp|invit/, ['BirthdayInvitations', 'PartyInvitations']],
  [/thank[- ]?you/, ['ThankYouNotes']],
  [/allerg/, ['FoodAllergies']],
  [/\bcake/, ['BirthdayCake']],
  [/party[- ]bags?|goodie|favou?rs?\b/, ['PartyFavors', 'GoodieBags']],
  [/\btheme/, ['PartyTheme', 'ThemeParty']],
  [/budget|\bcost|spend|afford/, ['PartyOnABudget']],
  [/venue|home[- ](party|or)|backyard/, ['PartyVenue', 'BirthdayPartyVenue']],
  [/\bfood|snack|pizza|menu/, ['PartyFood', 'KidsFood']],
  [/game|activit|first-15|first 15|pacing|shy/, ['PartyGames', 'KidsActivities']],
  [/headcount|guest[- ]list|guest-count|siblings/, ['GuestList']],
  [/checklist|timeline|lead-time|backwards|to-?do|tasks|night-before/, ['PartyChecklist', 'PartyPlanningTips']],
  [/stress|overwhelm|decision|fatigue|chaos|last-minute|tabs/, ['MentalLoad']],
  [/privacy/, ['PrivacyMatters']],
]

const PILLAR_TAGS: Record<'x' | 'meta', Record<Pillar, string[]>> = {
  x: {
    founder_journey: ['BuildInPublic'],
    ai_thinking: ['AI', 'BuildInPublic'],
    product_education: ['PartyPlanning'],
    launch_invitation: ['PartyPlanning'],
    useful_tips: ['ParentingTips'],
    parent_pain: ['Parenting'],
    community_question: ['Parenting'],
  },
  meta: {
    founder_journey: ['FounderStory', 'BuildInPublic'],
    ai_thinking: ['AI', 'TechForParents'],
    product_education: ['PartyPlanningApp', 'PartyPlanning'],
    launch_invitation: ['PartyPlanningApp', 'PartyPlanning'],
    useful_tips: ['ParentingTips', 'PartyPlanningTips'],
    parent_pain: ['ParentLife', 'MomLife', 'DadLife'],
    community_question: ['ParentLife', 'KidsBirthdayParty'],
  },
}

const BASE_TAGS: Partial<Record<Platform, string[]>> = {
  x: ['KidsParty', 'BirthdayParty', 'Parenting'],
  instagram: ['KidsBirthdayParty', 'BirthdayPartyIdeas', 'PartyPlanning', 'KidsParty', 'BirthdayPlanning', 'PartyIdeas', 'ParentingTips', 'KidsBirthday', 'MomLife', 'DadLife'],
  facebook: ['KidsBirthdayParty', 'PartyPlanning', 'BirthdayPartyIdeas', 'ParentingTips'],
}

const key = (t: string) => t.replace(/^#/, '').toLowerCase()
const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

export interface HashtagContext { platform: Platform; pillar: Pillar; topicKey?: string | null; text: string }

/** Relevant tags for a post, best first (topic, then pillar, then broad audience tags rotated per post). */
export function pickHashtags(c: HashtagContext, count: number): string[] {
  const hay = `${c.topicKey ?? ''} ${c.text.replace(HASHTAG_RE, ' ')}`.toLowerCase()
  const topic = TOPIC_RULES.filter(([re]) => re.test(hay)).map(([, tags]) => tags)
  // One tag from each matching topic first (breadth), then their second tags.
  const topicTags = [...topic.map((t) => t[0]), ...topic.flatMap((t) => t.slice(1))].slice(0, c.platform === 'instagram' ? 2 : 1)
  const base = BASE_TAGS[c.platform] ?? BASE_TAGS.facebook!
  const r = seedOf(`${c.topicKey ?? ''}${c.text.length}`) % base.length
  const ranked = [...topicTags, ...PILLAR_TAGS[c.platform === 'x' ? 'x' : 'meta'][c.pillar], ...base.slice(r), ...base.slice(0, r)]
  const out: string[] = []
  for (const t of ranked) if (!out.some((o) => key(o) === key(t))) out.push(t)
  return out.slice(0, count).map((t) => `#${t}`)
}

export interface HashtagOptions { platform: Platform; pillar: Pillar; topicKey?: string | null; linkUrl?: string | null; target: number; max: number; maxChars: number }

/**
 * Tops the post up to `target` hashtags on one closing line (above a trailing link), keeping tags already there and
 * never exceeding `max` or the platform's length limit (fewer tags if it doesn't fit). Idempotent.
 */
export function withHashtags(text: string, o: HashtagOptions): string {
  let body = text.trimEnd()
  let tail = ''
  if (o.linkUrl && body.endsWith(o.linkUrl)) {
    tail = o.linkUrl
    body = body.slice(0, -o.linkUrl.length).trimEnd()
  }
  const lines = body.split('\n')
  const last = lines[lines.length - 1]?.trim() ?? ''
  const closing = last && last.replace(HASHTAG_RE, '').trim() === '' ? (last.match(HASHTAG_RE) ?? []).map((t) => t.trim()) : []
  if (closing.length) body = lines.slice(0, -1).join('\n').trimEnd()
  const inline = (body.match(HASHTAG_RE) ?? []).map((t) => t.trim())
  const want = Math.min(o.target, o.max) - inline.length
  if (closing.length >= want) return text
  const have = new Set([...inline, ...closing].map(key))
  const extra = pickHashtags({ platform: o.platform, pillar: o.pillar, topicKey: o.topicKey, text: body }, want + have.size).filter((t) => !have.has(key(t)))
  const tags = [...closing, ...extra].slice(0, Math.max(want, closing.length))
  for (let n = tags.length; n > closing.length; n--) {
    const out = [body, tags.slice(0, n).join(' '), tail].filter(Boolean).join('\n\n')
    if (xWeightedLength(out) <= o.maxChars) return out
  }
  return text
}

/** withHashtags with the platform's cadence (target = max hashtags for the platform). */
export function addHashtags(post: Pick<MarketingPost, 'platform' | 'pillar' | 'topicKey' | 'linkUrl' | 'text'>, cfg: MarketingConfig): string {
  const c = cadenceFor(cfg, post.platform)
  return withHashtags(post.text, { platform: post.platform, pillar: post.pillar, topicKey: post.topicKey, linkUrl: post.linkUrl, target: c.maxHashtags, max: c.maxHashtags, maxChars: c.maxChars })
}
