/**
 * Claim & safety validation: runs on every draft, on every edit and again right before publishing. A post with any
 * error can't be approved, scheduled or published. Accuracy beats engagement: when in doubt, reject and regenerate.
 */
import 'server-only'
import { scrubProtected } from '@/lib/ai/safety'
import { PRODUCT_URL } from './facts'
import { PILLAR_SPECS } from './pillars'
import { containsLink, countEmoji, extractUrls, xWeightedLength } from './text'
import { daysBetween, weekday } from './time'
import type { Pillar, ValidationIssue, ValidationReport } from './types'

interface Rule { code: string; re: RegExp; message: string }

const B = (words: string) => new RegExp(`\\b(?:${words})\\b`, 'i')

/** Unsupported claims: numbers, social proof, money, press, partnerships, scarcity, superlatives. */
export const CLAIM_RULES: Rule[] = [
  { code: 'user_count', re: /\b\d[\d,.]*\s*(?:k|\+)?\+?\s*(?:users|customers|sign[- ]?ups|members|downloads|installs|subscribers|accounts)\b/i, message: 'States a user/sign-up count.' },
  { code: 'user_count', re: /\b(?:over|more than|nearly|almost|thousands of|hundreds of|dozens of|millions of|join(?:ing)?|already)\s+[\d,.]*\s*(?:k\s+)?(?:parents|families|moms|dads|users|people|hosts)\b/i, message: 'Claims how many parents use it.' },
  { code: 'user_count', re: /\b\d[\d,.]*\s*(?:k\s+|\+\s*)?(?:parents|families|moms|dads|people)\s+(?:use|using|love|loved|trust|joined|signed|tried|are (?:using|planning)|planned|have)\b/i, message: 'Claims how many parents use it.' },
  { code: 'social_proof', re: B('trusted by|loved by|used by|parents love (?:it|this|mbp)|everyone(?:\'s| is) (?:using|talking)|rave reviews|five[- ]star reviews|5[- ]star reviews'), message: 'Social proof that is not verified.' },
  { code: 'revenue', re: B('revenue|mrr|arr|sales|profitable|profit|paying customers|first sale|\\$\\s?\\d[\\d,.]*\\s*(?:k|m)?\\s*(?:in )?(?:revenue|sales)'), message: 'Revenue or sales claim.' },
  { code: 'rating', re: /★|\brated\s+\d|\b\d(?:\.\d)?\s*(?:\/\s*5|out of 5)\b|\b(?:rated|ratings?)\b[^.!?\n]{0,40}\b(?:app|mbp|magical birthday planner|by parents|by users)\b|\b(?:app store|play store)\b/i, message: 'Rating or app-store claim.' },
  { code: 'testimonial', re: /["“][^"”\n]{8,}["”]\s*[—–-]\s*[A-Z]|\b(?:testimonial|a (?:happy )?customer|(?:a|one) (?:mom|dad|parent|user|customer|family|beta tester) (?:told|said|wrote|messaged|emailed|dm'?d|texted) (?:me|us))\b/i, message: 'Testimonial or anecdote that is not in the fact register.' },
  { code: 'press_award', re: B('award[- ]?winning|won (?:an|the|a) award|featured (?:in|on|by)|as seen (?:in|on)|press coverage|techcrunch|forbes|new york times|wall street journal|product of the day|#1 product|top product'), message: 'Press or award claim.' },
  { code: 'partnership', re: B('partner(?:ed|ing)? with|in partnership with|official partner|backed by|funded by|investors?|venture[- ]backed|accelerator|y combinator|yc'), message: 'Partnership or funding claim.' },
  { code: 'scarcity', re: B('sold out|selling out|spots? (?:are )?(?:limited|filling|left)|only \\d+ (?:spots|seats|places|invites) left|limited time|hurry|act now|last chance|don\'?t miss (?:out|this)|ends (?:tonight|today|soon)|before it\'?s gone|while (?:spots|seats|supplies) last|exclusive access'), message: 'Fake urgency or scarcity.' },
  { code: 'pricing', re: /\$\s?(?:9\.99|19\.99|29\.99)\b|\b(?:starter|plus|pro) plan\b|\bfree (?:trial|forever|plan|account|version|tier)\b|\bfor free\b|\bdiscount|\bcoupon|\bpromo code|\b\d+% off\b/i, message: 'Pricing/offer claim (the founder posts pricing manually).' },
  { code: 'superlative', re: B('the (?:best|only|ultimate|#1|number one|first) (?:birthday|party|kids?\'?) (?:planner|planning app|app|tool)|went viral|going viral|fastest[- ]growing|most popular|best[- ]selling|skyrocket(?:ing|ed)?'), message: 'Unprovable superlative or traction claim.' },
  { code: 'ai_vendor', re: B('openai|gpt-?\\d*|chatgpt|deepseek|claude|anthropic|gemini|llama|opencode|mistral'), message: 'Names an AI vendor/model (house rule).' },
  { code: 'competitor', re: B('evite|punchbowl|paperless post|partiful|greenvelope|canva|peerspace|eventbrite|signupgenius'), message: 'Names a competitor.' },
  // Child privacy: never a child's name, a school, an address, a phone number or an email.
  { code: 'privacy', re: /\b[Mm]y (?:daughter|son|kid|child|little one|twins?|oldest|youngest|toddler|boy|girl)\s*,?\s+(?!is\b|was\b|and\b|turns?\b|loves?\b|wants?\b|asked\b|said\b|has\b|had\b|will\b|just\b|keeps?\b|can\b|could\b)[A-Z][a-z]{2,}\b/, message: 'Names a child.' },
  { code: 'privacy', re: /\b(?:[Mm]y name is|I['’]m|I am)\s+[A-Z][a-z]{2,}(?=[.,!]|\s+(?:and|here|from|the founder|founder)\b)/, message: 'Introduces someone by name (the founder is anonymous).' },
  { code: 'privacy', re: /\b[A-Z][a-z]+\s+(?:Elementary|Middle School|High School|Primary School|Montessori|Preschool|Academy|Day School)\b/, message: 'Names a school.' },
  { code: 'privacy', re: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd|Way|Place|Pl)\b/, message: 'Contains a street address.' },
  { code: 'privacy', re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, message: 'Contains a phone number.' },
  { code: 'privacy', re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/, message: 'Contains an email address.' },
]

export const PRODUCT_NAME = 'Magical Birthday Planner'
/** "Magical Birthday Plannner", "magical birthday planer", "Magical  Birthday Planners" … → the exact product name. */
export function fixProductName(text: string): { text: string; fixed: boolean } {
  const out = text.replace(/\bmagic(?:al|cal|el)?\s+birth\s*day\s+plan+[ae]*n*[ae]*r+s?\b/gi, (m) => (m === PRODUCT_NAME ? m : PRODUCT_NAME))
  return { text: out, fixed: out !== text }
}

/** Poll options: 2–4, 1–25 characters each, distinct, claim-free; duration 5 min – 7 days. */
export function pollIssues(poll: { options: string[]; durationMinutes: number } | null | undefined): ValidationIssue[] {
  if (!poll) return []
  const issues: ValidationIssue[] = []
  const opts = poll.options.map((o) => o.trim())
  if (opts.length < 2 || opts.length > 4) issues.push({ code: 'poll', message: 'A poll needs 2–4 options.' })
  if (opts.some((o) => !o || [...o].length > 25)) issues.push({ code: 'poll', message: 'Poll options must be 1–25 characters.' })
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) issues.push({ code: 'poll', message: 'Poll options must be different.' })
  if (!(poll.durationMinutes >= 5 && poll.durationMinutes <= 10080)) issues.push({ code: 'poll', message: 'Poll duration must be 5 minutes to 7 days.' })
  for (const o of opts) issues.push(...claimIssues(o))
  return issues.filter((x, i) => issues.findIndex((y) => y.code === x.code && y.message === x.message) === i)
}

const VOICE_RULES: Rule[] = [
  { code: 'marketing_speak', re: B('revolutioni[sz]e[sd]?|revolutionary|game[- ]?chang(?:er|ing)|transform(?:s|ing)? the industry|unlock(?:s|ing)? unprecedented|unprecedented|next[- ]gen(?:eration)?|seamless(?:ly)?|redefin(?:e|es|ing)|cutting[- ]edge|disrupt(?:s|ing|ive)?|synerg(?:y|ies)|supercharge[sd]?|unleash(?:es|ing)?|elevate your|empower(?:s|ing)?|world[- ]class|best[- ]in[- ]class|innovative solution'), message: 'Marketing-speak the founder voice avoids.' },
  { code: 'engagement_bait', re: B('like (?:and|&) (?:retweet|repost|share)|rt if|retweet if|repost if|like if|follow (?:me|us) for|tag (?:a|3|three|two|your) (?:friend|mom|dad|parent)s?|smash that|drop a .{1,12} (?:if|below)|comment (?:below|yes) (?:and|if)'), message: 'Engagement bait.' },
  { code: 'off_topic', re: B('trump|biden|harris|democrats?|republicans?|election|abortion|gun control|immigration|israel|gaza|palestin\\w*|ukraine|russia|maga|liberals?|conservatives?|covid|vaccines?|religion|religious|church|mosque|crypto|bitcoin|nft'), message: 'Political, controversial or unrelated topic.' },
  { code: 'offensive', re: B('fuck\\w*|shit\\w*|bitch\\w*|bastard|asshole|damn|crap|stupid|idiot\\w*|dumb|lazy (?:parents?|moms?|dads?)|bad (?:parents?|moms?|dads?)|porn\\w*|sexy|nude|naked|kill(?:s|ed|ing)?|murder|suicide'), message: 'Offensive or unsuitable language.' },
  { code: 'fear', re: B('nightmare|disaster|ruin(?:s|ed)? (?:the|your|their) (?:party|day|birthday)|don\'t be (?:that|the) parent|you\'re doing it wrong|mistake every parent|parents always forget|regret'), message: 'Fear- or guilt-based framing.' },
]

export interface ValidateOptions {
  pillar: Pillar
  maxChars: number
  /** The exact link this post may carry (with UTM); null = no link allowed. */
  allowedLink: string | null
  /** Extra forbidden terms (MARKETING_FORBIDDEN_TERMS: the founder's and family's names, anything else off-limits). */
  forbiddenTerms?: string[]
  minChars?: number
}

export function forbiddenTermsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  return (env.MARKETING_FORBIDDEN_TERMS ?? '').split(',').map((s) => s.trim()).filter((s) => s.length >= 2)
}

/** Claim/voice check for any short public string (image headlines, alt text). */
export function claimIssues(text: string, forbiddenTerms: string[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const r of [...CLAIM_RULES, ...VOICE_RULES]) if (r.re.test(text)) issues.push({ code: r.code, message: r.message })
  if (scrubProtected(text).changed) issues.push({ code: 'protected_name', message: 'Mentions a copyrighted character, franchise or celebrity.' })
  for (const t of forbiddenTerms) {
    if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) issues.push({ code: 'forbidden_term', message: 'Contains a forbidden term (MARKETING_FORBIDDEN_TERMS).' })
  }
  // One issue per code is enough to explain a rejection.
  return issues.filter((x, i) => issues.findIndex((y) => y.code === x.code) === i)
}

export function validatePost(text: string, opts: ValidateOptions): ValidationReport {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const trimmed = text.trim()
  const weightedLength = xWeightedLength(trimmed)
  const minChars = opts.minChars ?? 40

  if (!trimmed) errors.push({ code: 'empty', message: 'The post is empty.' })
  if (weightedLength > opts.maxChars) errors.push({ code: 'too_long', message: `Too long for X: ${weightedLength}/${opts.maxChars} weighted characters.` })
  else if (trimmed && weightedLength < minChars) errors.push({ code: 'too_short', message: `Too short (${weightedLength} characters).` })
  else if (weightedLength > 250) warnings.push({ code: 'long', message: `Longer than the 100–250 target (${weightedLength}).` })

  const urls = extractUrls(trimmed)
  const spec = PILLAR_SPECS[opts.pillar]
  if (urls.length > 1) errors.push({ code: 'multiple_links', message: 'More than one link.' })
  for (const u of urls) {
    const clean = u.replace(/[).,!?]+$/, '')
    if (!clean.startsWith(PRODUCT_URL)) errors.push({ code: 'foreign_link', message: 'Links anywhere but the product URL.' })
    else if (!opts.allowedLink || clean !== opts.allowedLink) errors.push({ code: 'link_not_allowed', message: 'This post may not carry this link (wrong UTM or the strategy chose no link).' })
  }
  if (urls.length && spec.link === 'never') errors.push({ code: 'link_not_allowed', message: 'This pillar never carries a link.' })
  // X bills a bare domain ("magicalbirthdayplanner.app") as a $0.20 link post too.
  if (!urls.length && containsLink(trimmed)) errors.push({ code: 'link_not_allowed', message: 'Mentions a web address — X turns it into a (costly) link. Use the product name instead.' })
  if (/\bmagic(?:al|cal|el)?\s+birth\s*day\s+plan+[ae]*n*[ae]*r+s?\b/i.test(trimmed) && fixProductName(trimmed).fixed) errors.push({ code: 'product_name', message: `Write the product name exactly: ${PRODUCT_NAME}.` })
  if (/(^|[^\w])@[A-Za-z0-9_]{1,15}\b/.test(trimmed.replace(/https?:\/\/\S+/g, ''))) errors.push({ code: 'mention', message: 'Mentions an account (@). The agent never mentions people.' })

  const hashtags = (trimmed.match(/(^|\s)#[\p{L}\d_]+/gu) ?? []).length
  if (hashtags > 2) errors.push({ code: 'hashtags', message: `Too many hashtags (${hashtags}).` })
  else if (hashtags === 2) warnings.push({ code: 'hashtags', message: 'Two hashtags — prefer none or one.' })
  const emoji = countEmoji(trimmed)
  if (emoji > 2) errors.push({ code: 'emoji', message: `Too many emojis (${emoji}).` })
  else if (emoji === 2) warnings.push({ code: 'emoji', message: 'Two emojis — prefer none or one.' })

  errors.push(...claimIssues(trimmed, opts.forbiddenTerms))

  const words = trimmed.replace(/https?:\/\/\S+/g, '').split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w))
  if (words.length >= 6 && words.filter((w) => w === w.toUpperCase()).length / words.length > 0.3) errors.push({ code: 'shouting', message: 'Too much ALL CAPS.' })
  if ((trimmed.match(/!/g) ?? []).length > 2) warnings.push({ code: 'exclamations', message: 'Many exclamation marks.' })

  return { ok: errors.length === 0, errors, warnings, weightedLength, maxLength: opts.maxChars }
}

/**
 * Dates the model can get wrong: a weekday or "tomorrow/today/next week" next to the launch must match the real
 * launch date, and a launched product must not be described as upcoming.
 */
export function dateIssues(text: string, ctx: { today: string; launchDate: string }): string[] {
  const issues: string[] = []
  const days = daysBetween(ctx.today, ctx.launchDate)
  for (const sentence of text.split(/(?<=[.!?\n])\s+/)) {
    if (!/\blaunch(?:es|ing|ed)?\b|\bgoes live\b|\bgoing live\b/i.test(sentence)) continue
    const named = sentence.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1]
    if (named && named.toLowerCase() !== weekday(ctx.launchDate).toLowerCase()) issues.push(`Wrong launch day: launch is ${weekday(ctx.launchDate)}, ${ctx.launchDate}.`)
    if (/\btomorrow\b/i.test(sentence) && days !== 1) issues.push('Says the launch is tomorrow, which is not true.')
    if (/\btoday\b/i.test(sentence) && days !== 0 && /\blaunch(?:es|ing)?\b/i.test(sentence)) issues.push('Says the launch is today, which is not true.')
    if (days < 0 && /\b(launching|launches|will launch|about to launch|before launch|pre-?launch)\b/i.test(sentence)) issues.push('Describes the launch as upcoming, but it already happened.')
  }
  return [...new Set(issues)]
}

/**
 * Generated copy only (a founder's own edit may state their real numbers): the model must not invent specific counts
 * for the founder's story ("11 tabs, 3 threads").
 */
export function inventedSpecifics(text: string): string[] {
  return /\b\d+\s+(?:open\s+)?(?:browser\s+)?(?:tabs|text threads|threads|group chats|chats|spreadsheets|sticky notes|notes apps?|apps|websites|sites|texts|emails)\b/i.test(text)
    ? ['Invented specifics: do not give exact counts (tabs, threads, apps…) for the founder’s story — say "a lot of tabs" instead.']
    : []
}
