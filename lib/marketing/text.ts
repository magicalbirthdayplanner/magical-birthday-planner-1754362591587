/**
 * Text utilities for posts: X's weighted length, and a lightweight "same idea?" fingerprint used by the repetition
 * check. No dependencies, deterministic, cheap enough to compare against months of history.
 */

const URL_RE = /\bhttps?:\/\/[^\s]+/gi
const EMOJI_RE = /\p{Extended_Pictographic}/u
/** twitter-text v3: code points in these ranges weigh 1, everything else 2; a URL always counts as 23; an emoji as 2. */
const LIGHT_RANGES: [number, number][] = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]]
export const X_URL_LENGTH = 23

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null

/** Length as X counts it (weighted characters). */
export function xWeightedLength(text: string): number {
  let total = 0
  const withoutUrls = text.normalize('NFC').replace(URL_RE, () => {
    total += X_URL_LENGTH
    return ''
  })
  const graphemes = segmenter ? Array.from(segmenter.segment(withoutUrls), (s) => s.segment) : Array.from(withoutUrls)
  for (const g of graphemes) {
    if (EMOJI_RE.test(g)) {
      total += 2
      continue
    }
    for (const ch of g) {
      const cp = ch.codePointAt(0)!
      total += LIGHT_RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2
    }
  }
  return total
}

export function countEmoji(text: string): number {
  const graphemes = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)
  return graphemes.filter((g) => EMOJI_RE.test(g)).length
}

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) ?? []
}

/** First sentence / line: the hook. */
export function firstSentence(text: string): string {
  const line = text.replace(URL_RE, '').trim().split(/\n+/)[0] ?? ''
  const m = line.match(/^.*?[.!?](?=\s|$)/)
  return (m ? m[0] : line).trim()
}

// ---- "same idea" fingerprint -------------------------------------------------------------------------------------

/** Words that carry no idea in this domain (every post is about kids' birthday parties). */
const STOP = new Set(
  (
    'a an the and or but if so of to in on at for from by with about as into than then that this these those it its is are was were be been being ' +
    'i im i\'m me my we our you your yours they them their he she his her do does did done have has had having not no yes just really very ' +
    'can could should would will wont won\'t what which who whom why how when where there here all any some more most much many one ones also ' +
    'get got make made let lets let\'s still even only ever every thing things way ways lot lots bit actually up out over again ' +
    'because while too like am us someone something anyone everyone everything want wants know think thought feel felt say said ' +
    'party parties birthday birthdays bday kid kids child children son daughter parent parents mom moms dad dads family families ' +
    'plan planning planned planner magical mbp app'
  ).split(/\s+/),
)

/** Synonyms → one concept, so different wording of the same idea collides. */
const CONCEPTS: [RegExp, string][] = [
  [/^(tab|tabs|browser|browsers|window|windows|website|websites|site|sites)$/, 'tab'],
  [/^(stress|stressful|stressed|overwhelm|overwhelmed|overwhelming|chaos|chaotic|frazzled|exhausting|exhausted|hard|difficult|struggle|pain)$/, 'stress'],
  [/^(venue|venues|place|places|location|locations|spot|spots)$/, 'venue'],
  [/^(invite|invites|invitation|invitations|invited)$/, 'invite'],
  [/^(rsvp|rsvps|reply|replies|respond|responds|response|responses|answer|answers)$/, 'rsvp'],
  [/^(guest|guests|attendee|attendees|headcount|show|showing)$/, 'guest'],
  [/^(budget|budgets|cost|costs|spend|spending|money|price|prices|expensive|afford)$/, 'budget'],
  [/^(spreadsheet|spreadsheets|sheet|sheets|excel)$/, 'spreadsheet'],
  [/^(text|texts|thread|threads|message|messages|chat|chats|whatsapp)$/, 'message'],
  [/^(checklist|checklists|todo|todos|list|lists|task|tasks)$/, 'list'],
  [/^(theme|themes|themed)$/, 'theme'],
  [/^(ai|chatbot|chatbots|assistant|assistants|bot|bots)$/, 'ai'],
  [/^(build|building|built|builder|ship|shipping|shipped|launch|launching|launched)$/, 'build'],
  [/^(need|needs|needed|require|requires|required)$/, 'need'],
  [/^(idea|ideas|suggestion|suggestions|recommend|recommendation|recommendations)$/, 'idea'],
]

function stem(w: string): string {
  if (w.length <= 4) return w
  return w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s|ly)$/, '')
}

/** The idea fingerprint: canonical content words (numbers kept — "20 tabs" is part of the idea). */
export function conceptSet(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(URL_RE, ' ')
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
  const out = new Set<string>()
  for (const w of words) {
    if (STOP.has(w)) continue
    const mapped = CONCEPTS.find(([re]) => re.test(w))?.[1]
    const c = mapped ?? stem(w)
    if (c.length < 2 && !/^\d+$/.test(c)) continue
    if (STOP.has(c)) continue
    out.add(c)
  }
  return out
}

export interface Overlap { jaccard: number; containment: number; shared: number }

export function overlap(a: Set<string>, b: Set<string>): Overlap {
  if (!a.size || !b.size) return { jaccard: 0, containment: 0, shared: 0 }
  let shared = 0
  for (const x of a) if (b.has(x)) shared++
  return { jaccard: shared / (a.size + b.size - shared), containment: shared / Math.min(a.size, b.size), shared }
}

/** One similarity score in [0, 1] for "is this the same idea": containment weighs most (a short rewording of a longer post). */
export function ideaSimilarity(a: string, b: string): number {
  const o = overlap(conceptSet(a), conceptSet(b))
  if (o.shared < 2) return Math.min(o.jaccard, 0.3)
  return Math.round((0.6 * o.containment + 0.4 * o.jaccard) * 10_000) / 10_000
}

/** Lower-case, punctuation-free, single-spaced (for exact-ish comparisons of hooks and CTAs). */
export function normalizePhrase(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(URL_RE, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The first N words of the hook — catches a reused opening ("I kept finding myself…"). */
export function openingWords(text: string, n = 4): string {
  return normalizePhrase(firstSentence(text)).split(' ').slice(0, n).join(' ')
}

const BARE_DOMAIN_RE = /\b(?:[a-z0-9-]+\.)+(?:app|com|net|org|io|co|ai|us|ly|dev|me|gg|tv|info)\b(?:\/\S*)?/i
/** X turns bare domains into links too (and bills a "post with URL"): any http(s) URL or bare domain counts. */
export function containsLink(text: string): boolean {
  return /\bhttps?:\/\/\S+/i.test(text) || BARE_DOMAIN_RE.test(text.replace(URL_RE, ''))
}
