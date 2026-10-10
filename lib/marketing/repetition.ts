/**
 * Repetition check: is this candidate essentially a post we already made (or queued) recently? Compares the idea
 * fingerprint of the whole post, the hook, the opening words, the CTA and the topic against recent history.
 */
import { firstSentence, ideaSimilarity, normalizePhrase, openingWords } from './text'
import type { MarketingPost } from './types'

export interface HistoryItem {
  id: string
  text: string
  hook: string | null
  cta: string | null
  topicKey: string | null
  status: string
  /** published_at ?? scheduled_at ?? created_at */
  at: string
}

export interface RepetitionCandidate { text: string; hook?: string | null; cta?: string | null; topicKey?: string | null; id?: string; /** e.g. the draft being regenerated */ excludeIds?: string[] }

export interface RepetitionResult {
  repetitive: boolean
  /** Highest idea similarity to any recent post (0–1). */
  score: number
  closestId: string | null
  reasons: { code: 'same_idea' | 'same_hook' | 'same_opening' | 'same_cta' | 'same_topic'; message: string; postId: string }[]
}

export const REPETITION = {
  /** Same idea when the whole-post similarity reaches this… */
  ideaThreshold: 0.6,
  /** …or the hooks alone are this similar. */
  hookThreshold: 0.7,
  /** Idea window: posts newer than this are compared. */
  ideaWindowDays: 45,
  /** No two posts on the same topic within this many days (8 posts/day needs a short window). */
  topicWindowDays: 7,
  /** The same CTA may not appear in the last N posts. */
  ctaLastN: 5,
  /** The same opening words may not appear in the last N posts. */
  openingLastN: 10,
} as const

export function checkRepetition(c: RepetitionCandidate, history: HistoryItem[], now = new Date()): RepetitionResult {
  const nowMs = now.getTime()
  const ageDays = (h: HistoryItem) => (nowMs - new Date(h.at).getTime()) / 86_400_000
  const recent = history
    .filter((h) => h.id !== c.id && !c.excludeIds?.includes(h.id) && h.status !== 'cancelled' && ageDays(h) <= REPETITION.ideaWindowDays)
    .sort((a, b) => b.at.localeCompare(a.at))
  const reasons: RepetitionResult['reasons'] = []
  let score = 0
  let closestId: string | null = null
  const hook = c.hook || firstSentence(c.text)
  const opening = openingWords(c.text)
  const cta = normalizePhrase(c.cta)

  recent.forEach((h, i) => {
    const s = ideaSimilarity(c.text, h.text)
    if (s > score) {
      score = s
      closestId = h.id
    }
    if (s >= REPETITION.ideaThreshold) reasons.push({ code: 'same_idea', message: `Same idea as a post from ${h.at.slice(0, 10)} (similarity ${s.toFixed(2)}).`, postId: h.id })
    const hs = ideaSimilarity(hook, h.hook || firstSentence(h.text))
    if (hs >= REPETITION.hookThreshold && s < REPETITION.ideaThreshold) reasons.push({ code: 'same_hook', message: `Hook is too close to a post from ${h.at.slice(0, 10)}.`, postId: h.id })
    if (i < REPETITION.openingLastN && opening.split(' ').length >= 3 && opening === openingWords(h.text)) reasons.push({ code: 'same_opening', message: `Opens with the same words as a recent post ("${opening}…").`, postId: h.id })
    if (i < REPETITION.ctaLastN && cta && cta === normalizePhrase(h.cta)) reasons.push({ code: 'same_cta', message: 'Same call to action as one of the last posts.', postId: h.id })
    if (c.topicKey && h.topicKey === c.topicKey && ageDays(h) <= REPETITION.topicWindowDays) reasons.push({ code: 'same_topic', message: `Topic "${c.topicKey}" was used on ${h.at.slice(0, 10)}.`, postId: h.id })
  })
  return { repetitive: reasons.length > 0, score, closestId, reasons }
}

export function toHistoryItem(p: MarketingPost): HistoryItem {
  return { id: p.id, text: p.text, hook: p.hook, cta: p.cta, topicKey: p.topicKey, status: p.status, at: p.publishedAt ?? p.scheduledAt ?? p.createdAt }
}
