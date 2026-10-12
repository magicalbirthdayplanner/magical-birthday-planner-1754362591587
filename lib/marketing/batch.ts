/**
 * Daily batch generation: ONE model call writes all of a day's planned posts (8 by default), at most one repair call
 * fixes the ones that failed validation, and anything still failing falls back to the zero-cost evergreen library.
 * Free branded cards are rendered for template slots; library media is attached as planned. Every post is validated
 * (claims, voice, product name, privacy, dates, links, polls, threads) and checked for repetition — against history
 * AND the rest of the batch — before it is stored. AI spend is budget-gated and written to the ledger. SERVER ONLY.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { callStructured } from '@/lib/ai/client'
import { aiConfig } from '@/lib/ai/config'
import { allowAI, budgetSnapshot, estimatePostCost, recordAI, type BudgetSnapshot } from './budget'
import { autonomousEffective, cadenceFor, type MarketingConfig } from './config'
import { factSheet, FOUNDER_FACTS, PRODUCT_FACTS } from './facts'
import type { CardSpec } from './images/templates'
import { LIBRARY, libraryKey, type LibraryItem } from './library'
import { renderTemplateMedia } from './media'
import { PILLAR_SPECS } from './pillars'
import { planSlots, planWeek, weekStartOf, type PlanSlot, type PlanWeights } from './planner'
import { voiceRules } from './prompts'
import { checkRepetition, toHistoryItem, type HistoryItem } from './repetition'
import type { MarketingStore } from './store'
import { currentObjective, utmUrl } from './strategy'
import { addDays, localDate, weekday } from './time'
import { SLOT_ROLE_LABEL, type Platform, type PollSpec } from './types'
import { withHashtags, X_HASHTAG_ROOM } from './hashtags'
import { claimIssues, dateIssues, fixProductName, forbiddenTermsFromEnv, inventedSpecifics, platformRules, pollIssues, validatePost } from './validation'

const CardSchema = z.object({
  headline: z.string().min(1).max(90),
  bullets: z.array(z.string().max(60)).max(4).optional(),
  left: z.string().max(30).optional(),
  right: z.string().max(30).optional(),
})
const ItemSchema = z.object({
  slot: z.number().int().min(0).max(200),
  paragraphs: z.array(z.string().min(1).max(400)).min(1).max(4),
  hook: z.string().min(1).max(200),
  topic: z.string().min(2).max(100),
  cta: z.string().max(140).nullable().optional(),
  card: CardSchema.nullable().optional(),
  poll: z.object({ options: z.array(z.string().min(1).max(40)).min(2).max(4) }).nullable().optional(),
  thread: z.array(z.string().min(1).max(400)).max(5).nullable().optional(),
  factsUsed: z.array(z.string().max(24)).max(8).optional(),
})
export const BatchSchema = z.object({ posts: z.array(ItemSchema).min(1).max(12) })
type Item = z.infer<typeof ItemSchema>

const KNOWN_FACTS = new Set([...FOUNDER_FACTS, ...PRODUCT_FACTS].map((f) => f.id))
const POLL_MINUTES = 1440

export function batchSystemPrompt(platform: Platform = 'x'): string {
  return [
    ...voiceRules(platform === 'instagram' || platform === 'facebook' ? platform : 'x'),
    'You are writing a whole day of posts at once. Make each post clearly different from the others: different idea, different opening words, different call to action (most posts have none).',
    'Return ONLY a JSON object: {"posts": [ {',
    ' "slot": number (copy the slot number),',
    ' "paragraphs": string[1-4] (the post text, one entry per paragraph; no URLs),',
    ' "hook": string (the first line, exactly as written),',
    ' "topic": string (short label),',
    ' "cta": string | null,',
    ' "card": {"headline": string ≤ 8 words, "bullets"?: string[] (3–4 items ≤ 40 chars), "left"?: string, "right"?: string} | null (only when the slot asks for a card),',
    ' "poll": {"options": string[2-4] (each ≤ 25 characters)} | null (only for poll slots),',
    ' "thread": string[] | null (only for thread slots: 3–4 follow-up posts, each ≤ 260 characters),',
    ' "factsUsed": string[] (fact ids you relied on)',
    '} ] }',
  ].join('\n')
}

function slotInstruction(s: PlanSlot, maxChars: number, platform: Platform = 'x'): string {
  const spec = PILLAR_SPECS[s.pillar]
  const parts = [`SLOT ${s.index} — ${s.time} — ${SLOT_ROLE_LABEL[s.role]} — ${spec.brief}`, `  Angle: ${s.topicAngle} (your own take).`]
  if (s.format === 'poll') parts.push(platform === 'facebook' ? '  Format: QUESTION with answer options (posted as text). paragraphs = the question (≤ 200 characters). poll.options = 2–4 short answers (≤ 25 characters each). No link, no card.' : '  Format: POLL. paragraphs = the question (≤ 200 characters). poll.options = 2–4 short answers (≤ 25 characters each). No link, no card.')
  else if (s.format === 'thread') parts.push('  Format: THREAD. paragraphs = the first post (a strong hook, ≤ 240 characters). thread = 3–4 follow-up posts (≤ 260 characters each), numbered "2/", "3/"…')
  else if (s.media.source === 'library') parts.push(`  Format: ${s.format.toUpperCase()} — the post carries an existing ${s.media.kind}: ${s.media.libraryNote ?? ''}. Write a caption that fits it (don’t describe things it doesn’t show). No card.`)
  else if (s.format === 'carousel') parts.push(`  Format: CAROUSEL of branded cards — card.headline = the cover (≤ 8 words); card.bullets = 3–4 short points, one per slide (≤ 40 characters each).`)
  else if (s.format === 'image' && s.media.template === 'this_or_that') parts.push('  Format: IMAGE "this or that" — card.headline = the question (≤ 8 words); card.left / card.right = the two options (≤ 14 characters each).')
  else if (s.format === 'image' && s.media.template && ['tip', 'checklist', 'venue_compare', 'ai_tip'].includes(s.media.template)) parts.push('  Format: IMAGE list card — card.headline (≤ 8 words) + card.bullets (3–4 items ≤ 40 characters).')
  else if (s.format === 'image') parts.push('  Format: IMAGE headline card — card.headline (≤ 8 words, no numbers, no claims).')
  else parts.push('  Format: TEXT only. No card.')
  parts.push(s.link ? '  Link: the system appends the product link after your text — end with one short, low-pressure line leading into it.' : '  Link: none — do not mention a web address.')
  parts.push(platform === 'instagram' ? '  Length: 2–4 short paragraphs (aim for 200–600 characters).' : platform === 'facebook' ? '  Length: 1–4 short paragraphs (aim for 150–500 characters).' : `  Length: ≤ ${maxChars - X_HASHTAG_ROOM - (s.link ? 25 : 0)} characters (aim for 100–220).`)
  return parts.join('\n')
}

function batchUserPrompt(p: { date: string; today: string; launchDate: string; objective: string; slots: PlanSlot[]; recent: HistoryItem[]; learnings: string[]; maxChars: number; feedback?: Record<number, string[]>; platform?: Platform }): string {
  return [
    `TODAY: ${weekday(p.today)}, ${p.today} (US Eastern). These posts go out on ${weekday(p.date)}, ${p.date}.`,
    `PUBLIC LAUNCH: ${weekday(p.launchDate)}, ${p.launchDate}. If you mention it, use exactly this date.`,
    `OBJECTIVE: ${p.objective}`,
    '',
    'RECENT POSTS — do not repeat their ideas, hooks, openings or calls to action:',
    ...(p.recent.length ? p.recent.slice(0, 24).map((r) => `- ${(r.hook ?? r.text).replace(/\s+/g, ' ').slice(0, 140)}`) : ['- (none yet)']),
    '',
    'WHAT THE DATA SAYS (real metrics only):',
    ...(p.learnings.length ? p.learnings.map((l) => `- ${l}`) : ['- Not enough data yet.']),
    '',
    factSheet(),
    '',
    'WRITE THESE POSTS:',
    ...p.slots.map((s) => slotInstruction(s, p.maxChars, p.platform) + (p.feedback?.[s.index]?.length ? `\n  YOUR PREVIOUS VERSION WAS REJECTED: ${p.feedback[s.index].join(' ')} Write a clearly different post.` : '')),
  ].join('\n')
}

export interface BuiltPost {
  slot: PlanSlot
  id: string
  text: string
  hook: string
  cta: string | null
  topic: string
  poll: PollSpec | null
  thread: string[] | null
  cards: Omit<CardSpec, 'seed'>[]
  source: 'ai' | 'library'
  libraryKey?: string
  factsUsed: string[]
}

/** Turn a model item / library item into a post candidate and list everything wrong with it. */
export function buildCandidate(slot: PlanSlot, item: Pick<Item, 'paragraphs' | 'hook' | 'topic' | 'cta' | 'card' | 'poll' | 'thread' | 'factsUsed'>, ctx: { cfg: MarketingConfig; today: string; history: HistoryItem[]; now: Date; env?: Record<string, string | undefined>; source: 'ai' | 'library'; libraryKey?: string; platform?: Platform }): { post: BuiltPost; reasons: string[] } {
  const id = randomUUID()
  const platform = ctx.platform ?? 'x'
  const rules = platformRules(platform, ctx.cfg)
  const link = slot.link ? utmUrl(id, platform, ctx.cfg.utmCampaign) : null
  const body = item.paragraphs.map((p) => p.trim()).filter(Boolean).join('\n\n')
  const cad = cadenceFor(ctx.cfg, platform)
  const text = withHashtags(fixProductName(link ? `${body}\n\n${link}` : body).text, { platform, pillar: slot.pillar, topicKey: slot.topicKey, linkUrl: link, target: cad.maxHashtags, max: cad.maxHashtags, maxChars: cad.maxChars })
  const forbidden = forbiddenTermsFromEnv(ctx.env)
  const reasons: string[] = []
  const report = validatePost(text, { ...rules, pillar: slot.pillar, allowedLink: link, forbiddenTerms: forbidden, minChars: slot.format === 'poll' ? 10 : rules.minChars })
  reasons.push(...report.errors.map((e) => e.message), ...dateIssues(text, { today: ctx.today, launchDate: ctx.cfg.launchDate }))
  if (ctx.source === 'ai') reasons.push(...inventedSpecifics(text))
  const unknown = (item.factsUsed ?? []).filter((f) => !KNOWN_FACTS.has(f))
  if (unknown.length) reasons.push(`Cites facts that are not in the fact sheet: ${unknown.join(', ')}.`)

  let poll: PollSpec | null = null
  if (slot.format === 'poll') {
    poll = item.poll?.options ? { options: item.poll.options.map((o) => o.trim()), durationMinutes: POLL_MINUTES } : null
    if (!poll) reasons.push('A poll slot needs poll.options.')
    else reasons.push(...pollIssues(poll).map((i) => `Poll: ${i.message}`))
  }
  let thread: string[] | null = null
  if (slot.format === 'thread') {
    thread = (item.thread ?? []).map((t) => fixProductName(t.trim()).text).filter(Boolean)
    if (thread.length < 2) reasons.push('A thread slot needs 2–4 follow-up posts.')
    thread.forEach((t, i) => reasons.push(...validatePost(t, { pillar: slot.pillar, maxChars: ctx.cfg.xMaxChars, allowedLink: null, forbiddenTerms: forbidden, minChars: 20 }).errors.map((e) => `Thread part ${i + 2}: ${e.message}`)))
  }
  const cards: Omit<CardSpec, 'seed'>[] = []
  if (slot.media.source === 'template' && slot.media.template) {
    const c = item.card
    if (!c?.headline) reasons.push('This slot needs card.headline.')
    else {
      const all = [c.headline, ...(c.bullets ?? []), c.left ?? '', c.right ?? ''].join(' · ')
      reasons.push(...claimIssues(all, forbidden).map((i) => `Card: ${i.message}`))
      if (/\$\s?\d|\b\d{2,}%/.test(all)) reasons.push('Card: no prices or percentages on images.')
      if (slot.format === 'carousel') {
        const points = (c.bullets ?? []).slice(0, 3)
        if (points.length < 2) reasons.push('A carousel needs 2–4 card bullets.')
        cards.push({ template: slot.media.template, headline: c.headline, bullets: [] }, ...points.map((b) => ({ template: slot.media.template!, headline: b, bullets: [] })))
      } else cards.push({ template: slot.media.template, headline: c.headline, bullets: c.bullets, left: c.left, right: c.right })
    }
  }
  // Compare around the slot's own date (the bank is written ahead), not around today.
  const rep = checkRepetition({ text, hook: item.hook, cta: item.cta ?? null, topicKey: slot.topicKey }, ctx.history, new Date(Math.max(ctx.now.getTime(), new Date(slot.at).getTime())))
  reasons.push(...rep.reasons.map((r) => r.message))
  return {
    post: { slot, id, text, hook: item.hook.slice(0, 200), cta: item.cta ?? null, topic: item.topic.slice(0, 100), poll, thread, cards, source: ctx.source, libraryKey: ctx.libraryKey, factsUsed: item.factsUsed ?? [] },
    reasons: [...new Set(reasons)],
  }
}

/** Library items that fit a slot, best first: same role, then same pillar, then anything of a compatible format. */
function libraryCandidates(slot: PlanSlot, used: Set<string>): LibraryItem[] {
  const fits = (i: LibraryItem) => !used.has(libraryKey(i.key)) && (slot.format === 'poll' ? i.format === 'poll' : i.format !== 'poll')
  const all = LIBRARY.filter(fits)
  return [...all.filter((i) => i.role === slot.role), ...all.filter((i) => i.role !== slot.role && i.pillar === slot.pillar), ...all.filter((i) => i.role !== slot.role && i.pillar !== slot.pillar)]
}

/** A slot still to write: planned, or skipped by validation fewer than 3 times (never "in the past"). */
export function retryable(s: PlanSlot, now: Date, cancelled?: Set<string>): boolean {
  if (s.status === 'planned') return true
  // The post written for it was cancelled (by the founder or a re-plan): the slot is open again.
  if ((s.status === 'generated' || s.status === 'library') && s.postId && cancelled?.has(s.postId)) return new Date(s.at).getTime() > now.getTime()
  return s.status === 'skipped' && (s.retries ?? 0) < 3 && !!s.note && !s.note.startsWith('In the past') && new Date(s.at).getTime() > now.getTime()
}

export interface DayResult { date: string; planId: string; generated: string[]; library: string[]; skipped: { index: number; reason: string }[]; aiCalls: number; aiTokens: number; aiSkipped?: string }

/** Write (or fill the gaps of) one local day of the plan. Idempotent: slots that already have a post are left alone. */
export async function generateDay(store: MarketingStore, cfg: MarketingConfig, opts: { date: string; now?: Date; budget?: BudgetSnapshot; weights?: PlanWeights; learnings?: string[]; budgetMs?: number; env?: Record<string, string | undefined>; actor?: string | null; platform?: Platform; onlySlots?: number[] }): Promise<DayResult> {
  const platform: Platform = opts.platform ?? 'x'
  const cad = cadenceFor(cfg, platform)
  const now = opts.now ?? new Date()
  const started = Date.now()
  const env = opts.env ?? process.env
  const budget = opts.budget ?? (await budgetSnapshot(store, cfg, now, env))
  const plan = await planWeek(store, cfg, { weekStart: weekStartOf(opts.date), now, budget, weights: opts.weights, platform })
  const slots = planSlots(plan)
  const cancelledIds = new Set((await store.listPosts({ platform, statuses: ['cancelled'], limit: 5000 })).map((p) => p.id))
  const todo = slots.filter((s) => s.date === opts.date && retryable(s, now, cancelledIds) && new Date(s.at).getTime() > now.getTime() - 30 * 60_000 && (!opts.onlySlots || opts.onlySlots.includes(s.index)))
  const result: DayResult = { date: opts.date, planId: plan.id, generated: [], library: [], skipped: [], aiCalls: 0, aiTokens: 0 }
  if (!todo.length) return result

  const today = localDate(now, cfg.timezone)
  const recentPosts = await store.listPosts({ platform, since: new Date(now.getTime() - 60 * 86_400_000).toISOString(), limit: 1000 })
  const history = recentPosts.map(toHistoryItem)
  // Posts imported from the account are used for repetition checks only — never quoted back to the model (they may
  // contain personal details such as the founder's name).
  const promptHistory = recentPosts.filter((p) => p.source !== 'imported').map(toHistoryItem)
  const usedLibrary = new Set(recentPosts.map((p) => p.topicKey).filter((k): k is string => !!k?.startsWith('lib:')))
  const settings = await store.getSettings()
  const autonomous = autonomousEffective(cfg, settings.autonomousEnabled)
  const objective = currentObjective(now, cfg.launchDate, cfg.timezone).goal

  // ---- the model (one call, plus at most one repair call) ---------------------------------------------------------
  const accepted = new Map<number, BuiltPost>()
  let pending = todo
  let feedback: Record<number, string[]> = {}
  const ai = aiConfig()
  const aiCfg = cfg.aiModel ? { ...ai, model: cfg.aiModel } : ai
  const estimate = (6_000 / 1_000_000) * cfg.aiUsdPer1MTokens
  for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
    if (!ai.configured) { result.aiSkipped = 'ai_not_configured'; break }
    const gate = allowAI(budget, estimate)
    if (!gate.ok) { result.aiSkipped = gate.reason; break }
    if (attempt > 0 && Date.now() - started > (opts.budgetMs ?? 50_000) - 25_000) { result.aiSkipped = 'time_budget'; break }
    const res = await callStructured({
      feature: 'marketing_batch',
      schema: BatchSchema as unknown as z.ZodType<z.infer<typeof BatchSchema>>,
      system: batchSystemPrompt(platform),
      user: batchUserPrompt({ date: opts.date, today, launchDate: cfg.launchDate, objective, slots: pending, recent: [...promptHistory, ...[...accepted.values()].map((b) => ({ id: b.id, text: b.text, hook: b.hook, cta: b.cta, topicKey: b.slot.topicKey, status: 'scheduled', at: b.slot.at }))].sort((a, b) => b.at.localeCompare(a.at)), learnings: opts.learnings ?? [], maxChars: cad.maxChars, feedback, platform }),
      sessionId: `mkt-batch-${platform}-${plan.id}-${opts.date}-${attempt}`,
      maxTokens: Math.min(8000, 700 + pending.length * 450),
      cfg: aiCfg,
    })
    result.aiCalls++
    const tokens = (res.inputTokens ?? 0) + (res.outputTokens ?? 0)
    result.aiTokens += tokens
    await recordAI(store, cfg, 'batch_generate', tokens, res.ok, { date: opts.date, slots: pending.length, attempt, platform })
    if (!res.ok) { result.aiSkipped = `ai_${res.code}`; break }
    const byIndex = new Map(res.data.posts.map((p) => [p.slot, p]))
    const next: PlanSlot[] = []
    feedback = {}
    for (const slot of pending) {
      const item = byIndex.get(slot.index)
      if (!item) { next.push(slot); feedback[slot.index] = ['It was missing from your answer.']; continue }
      const batchHistory = [...history, ...[...accepted.values()].map((b): HistoryItem => ({ id: b.id, text: b.text, hook: b.hook, cta: b.cta, topicKey: b.slot.topicKey, status: 'scheduled', at: b.slot.at }))]
      const { post, reasons } = buildCandidate(slot, item, { cfg, today, history: batchHistory, now, env, source: 'ai', platform })
      if (reasons.length) { next.push(slot); feedback[slot.index] = reasons.slice(0, 5) } else accepted.set(slot.index, post)
    }
    pending = next
  }

  // ---- zero-cost fallback: the evergreen library -------------------------------------------------------------------
  for (const slot of pending) {
    let lastReason = feedback[slot.index]?.[0] ?? 'nothing valid'
    let placed = false
    for (const lib of libraryCandidates(slot, usedLibrary).slice(0, 12)) {
      // Instagram needs media on every post: a text-only library item gets a branded card from its first line.
      const igCard = platform === 'instagram' && !lib.card ? { template: (lib.role === 'founder_story' ? 'founder_quote' : lib.role === 'conversation' ? 'poll_companion' : 'tip') as NonNullable<LibraryItem['card']>['template'], headline: (lib.hook ?? lib.text.split(/[.!?\n]/)[0]).split(/\s+/).slice(0, 8).join(' ') } : null
      const card: LibraryItem['card'] | null = lib.card ?? igCard
      const libFormat = lib.format === 'poll' && platform === 'instagram' ? 'image' : card && lib.format === 'text' ? 'image' : lib.format
      const libSlot: PlanSlot = { ...slot, format: libFormat, topicKey: libraryKey(lib.key), pillar: lib.pillar, link: false, thread: false, media: card ? { source: 'template', kind: libFormat === 'carousel' ? 'carousel' : 'image', template: card.template } : { source: 'none' } }
      const batchHistory = [...history, ...[...accepted.values()].map((b): HistoryItem => ({ id: b.id, text: b.text, hook: b.hook, cta: b.cta, topicKey: b.slot.topicKey, status: 'scheduled', at: b.slot.at }))]
      const { post, reasons } = buildCandidate(libSlot, { paragraphs: lib.text.split(/\n\n+/), hook: lib.hook ?? lib.text.split('\n')[0], topic: lib.key, cta: lib.cta ?? null, card: card ? { headline: card.headline, bullets: card.bullets, left: card.left, right: card.right } : null, poll: lib.poll && platform !== 'instagram' ? { options: lib.poll.options } : null, thread: null, factsUsed: [] }, { cfg, today, history: batchHistory, now, env, source: 'library', libraryKey: libraryKey(lib.key), platform })
      usedLibrary.add(libraryKey(lib.key))
      if (reasons.length) { lastReason = `library ${lib.key}: ${reasons[0]}`; continue }
      accepted.set(slot.index, post)
      placed = true
      break
    }
    if (!placed) result.skipped.push({ index: slot.index, reason: lastReason })
  }

  // ---- media + storage -------------------------------------------------------------------------------------------
  const updated = new Map(slots.map((s) => [s.index, s]))
  for (const post of accepted.values()) {
    const slot = post.slot
    let mediaIds: string[] = []
    if (slot.media.source === 'library' && slot.media.libraryIds?.length) mediaIds = slot.media.libraryIds
    else if (post.cards.length) {
      for (let attempt = 0; attempt < 2 && !mediaIds.length; attempt++) {
        try {
          mediaIds = await renderTemplateMedia(store, post.id, post.cards)
        } catch (e) {
          await store.audit(null, opts.actor ?? null, 'template_render_failed', { platform, postId: post.id, attempt, error: String((e as Error)?.message ?? e).slice(0, 300) })
        }
      }
    }
    // Instagram can't publish without media: never store a post that would be refused.
    if (platform === 'instagram' && !mediaIds.length) {
      result.skipped.push({ index: slot.index, reason: 'no media (template render failed)' })
      continue
    }
    const format = slot.format === 'poll' || slot.format === 'thread' ? slot.format : mediaIds.length === 0 ? 'text' : slot.format === 'video' && slot.media.source === 'library' ? 'video' : mediaIds.length > 1 ? 'carousel' : 'image'
    const linkUrl = slot.link ? utmUrl(post.id, platform, cfg.utmCampaign) : null
    const est = platform === 'x' ? estimatePostCost({ linkUrl, threadParts: post.thread, mediaIds, imagePath: null }, budget.prices) : 0
    const rules = platformRules(platform, cfg)
    const report = validatePost(post.text, { ...rules, pillar: slot.pillar, allowedLink: linkUrl, forbiddenTerms: forbiddenTermsFromEnv(env), minChars: slot.format === 'poll' ? 10 : rules.minChars })
    await store.insertPost({
      id: post.id,
      platform,
      content_type: mediaIds.length ? 'text_image' : 'text',
      content_pillar: slot.pillar,
      topic_key: post.libraryKey ?? slot.topicKey,
      topic: post.topic,
      hook: post.hook,
      cta: post.cta,
      text: post.text,
      link_url: linkUrl,
      status: autonomous ? 'scheduled' : 'draft',
      origin: 'agent',
      autonomous,
      scheduled_at: slot.at,
      approved_at: autonomous ? now.toISOString() : null,
      created_by: opts.actor ?? null,
      format,
      slot_role: slot.role,
      category: slot.category,
      plan_id: plan.id,
      slot_index: slot.index,
      media_ids: mediaIds,
      poll: post.poll as never,
      thread_parts: post.thread as never,
      est_cost_usd: est,
      source: post.source,
      image_status: mediaIds.length ? 'generated' : 'none',
      validation: report as never,
      generation: { batch: true, date: opts.date, role: slot.role, topicAngle: slot.topicAngle, factsUsed: post.factsUsed, libraryKey: post.libraryKey ?? null, mediaSource: slot.media.source } as never,
    })
    updated.set(slot.index, { ...updated.get(slot.index)!, postId: post.id, status: post.source === 'library' ? 'library' : 'generated' })
    ;(post.source === 'library' ? result.library : result.generated).push(post.id)
  }
  for (const s of result.skipped) updated.set(s.index, { ...updated.get(s.index)!, status: 'skipped', note: s.reason.slice(0, 200), retries: (updated.get(s.index)!.retries ?? 0) + 1 })
  const merged = [...updated.values()].sort((a, b) => a.index - b.index)
  await store.savePlan({ id: plan.id, platform, week_start: plan.week_start, status: merged.some((s) => s.status === 'planned') ? 'generating' : 'ready', slots: merged, notes: plan.notes })
  await store.audit(null, opts.actor ?? null, 'batch_generated', { platform, date: opts.date, generated: result.generated.length, library: result.library.length, skipped: result.skipped.length, aiCalls: result.aiCalls, aiSkipped: result.aiSkipped ?? null })
  return result
}

/**
 * Regenerate one planned post: the old version is cancelled and the slot is written again (one small model call,
 * library fallback). Works for every platform.
 */
export async function regenerateSlot(store: MarketingStore, cfg: MarketingConfig, opts: { postId: string; actor?: string | null; now?: Date; env?: Record<string, string | undefined> }): Promise<{ ok: true; postId: string } | { ok: false; message: string }> {
  const now = opts.now ?? new Date()
  const post = await store.getPost(opts.postId)
  if (!post?.planId || post.slotIndex === null) return { ok: false, message: 'Only posts from the content plan can be regenerated this way.' }
  const plan = (await store.listPlans(60)).find((p) => p.id === post.planId)
  if (!plan) return { ok: false, message: 'The plan for this post no longer exists.' }
  const slots = planSlots(plan)
  const slot = slots.find((s) => s.index === post.slotIndex)
  if (!slot) return { ok: false, message: 'The plan slot for this post no longer exists.' }
  if (new Date(slot.at).getTime() < now.getTime() + 5 * 60_000) return { ok: false, message: 'This slot is about to go out (or already passed) — edit the post instead.' }
  const cancelled = await store.updatePost(post.id, { status: 'cancelled' }, ['draft', 'approved', 'scheduled', 'failed'])
  if (!cancelled) return { ok: false, message: `A ${post.status} post can't be regenerated.` }
  await store.savePlan({ id: plan.id, platform: post.platform, week_start: plan.week_start, status: 'generating', slots: slots.map((s) => (s.index === slot.index ? { ...s, status: 'planned', postId: null, note: 'regenerating' } : s)), notes: plan.notes })
  const insights = await store.latestInsights()
  const r = await generateDay(store, cfg, { date: slot.date, now, platform: post.platform, onlySlots: [slot.index], actor: opts.actor, env: opts.env, weights: (insights?.data as { weights?: PlanWeights } | undefined)?.weights ?? {}, learnings: insights?.recommendations.slice(0, 8) ?? [] })
  const id = r.generated[0] ?? r.library[0]
  await store.audit(post.id, opts.actor ?? null, 'regenerated', { newPostId: id ?? null })
  return id ? { ok: true, postId: id } : { ok: false, message: `Could not write a valid replacement (${r.skipped[0]?.reason ?? r.aiSkipped ?? 'unknown'}).` }
}

/** Dates (local, ascending) in the next `horizonDays` whose plan still has unwritten future slots (or no plan yet). */
export async function daysToWrite(store: MarketingStore, cfg: MarketingConfig, opts: { platform: Platform; now?: Date; horizonDays?: number; limit?: number }): Promise<string[]> {
  const now = opts.now ?? new Date()
  const today = localDate(now, cfg.timezone)
  const out: string[] = []
  const cancelled = new Set((await store.listPosts({ platform: opts.platform, statuses: ['cancelled'], limit: 5000 })).map((p) => p.id))
  const plans = new Map<string, PlanSlot[] | null>()
  for (let i = 0; i < (opts.horizonDays ?? cfg.bankDays) && out.length < (opts.limit ?? 60); i++) {
    const date = addDays(today, i)
    const week = weekStartOf(date)
    if (!plans.has(week)) plans.set(week, (await store.getPlan(opts.platform, week)) ? planSlots(await store.getPlan(opts.platform, week)) : null)
    const slots = plans.get(week)
    if (!slots) out.push(date)
    else if (slots.some((s) => s.date === date && retryable(s, now, cancelled) && new Date(s.at).getTime() > now.getTime() + 5 * 60_000)) out.push(date)
  }
  return out
}
