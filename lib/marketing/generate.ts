/**
 * generateMarketingPost(): the content pipeline.
 *   objective → recent content → recent performance → pillar → topic → draft (model) → length → claims → repetition
 *   → image prompt → image → store as draft (or approved + scheduled in autonomous mode).
 * A draft that fails validation or repetition is regenerated with the reasons (up to 3 attempts, within a time budget);
 * nothing invalid is ever stored as publishable. SERVER ONLY.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { callStructured } from '@/lib/ai/client'
import { aiConfig } from '@/lib/ai/config'
import { readMarketingConfig, type MarketingConfig } from './config'
import { FOUNDER_FACTS, PRODUCT_FACTS } from './facts'
import { getImageProvider } from './images'
import { imagePromptIssues, sanitizeImagePrompt } from './images/safety'
import { MarketingDraftSchema, systemPrompt, userPrompt, type MarketingDraft } from './prompts'
import { checkRepetition, toHistoryItem } from './repetition'
import { getMarketingStore, type MarketingStore } from './store'
import { currentObjective, decideImage, decideLink, selectPillar, selectTopic, toStrategyPost, utmUrl } from './strategy'
import { localDate } from './time'
import type { MarketingPost, Pillar, Platform, ValidationReport } from './types'
import { claimIssues, dateIssues, forbiddenTermsFromEnv, inventedSpecifics, validatePost } from './validation'

export interface GenerateOptions {
  platform?: Platform
  now?: Date
  actor?: string | null
  pillar?: Pillar | null
  topicKey?: string | null
  /** Replace this draft: the new one is generated, the old one cancelled. */
  regenerateOf?: string | null
  /** Autonomous mode: store as approved + scheduled at `scheduleAt`. */
  autonomous?: boolean
  scheduleAt?: Date | null
  /** Wall-clock budget for model attempts (route limit is 60 s). */
  budgetMs?: number
  maxAttempts?: number
}

export type GenerateResult =
  | { ok: true; post: MarketingPost; attempts: number }
  | { ok: false; code: 'ai_not_configured' | 'ai_failed' | 'rejected' | 'not_found'; message: string; reasons: string[]; attempts: number }

const HISTORY_DAYS = 60

export function assembleText(draft: Pick<MarketingDraft, 'paragraphs'>, link: string | null): string {
  const body = draft.paragraphs.map((p) => p.trim()).filter(Boolean).join('\n\n')
  return link ? `${body}\n\n${link}` : body
}

const KNOWN_FACTS = new Set([...FOUNDER_FACTS, ...PRODUCT_FACTS].map((f) => f.id))

export async function generateMarketingPost(opts: GenerateOptions = {}, deps: { store?: MarketingStore; cfg?: MarketingConfig; env?: Record<string, string | undefined> } = {}): Promise<GenerateResult> {
  const started = Date.now()
  const env = deps.env ?? process.env
  const cfg = deps.cfg ?? readMarketingConfig(env)
  const store = deps.store ?? getMarketingStore()
  const now = opts.now ?? new Date()
  const platform = opts.platform ?? 'x'
  const budget = opts.budgetMs ?? 50_000
  const maxAttempts = opts.maxAttempts ?? 3

  const ai = aiConfig()
  if (!ai.configured) return { ok: false, code: 'ai_not_configured', message: 'The AI provider is not configured (AI_PROVIDER / AI_API_KEY).', reasons: [], attempts: 0 }
  const aiCfg = cfg.aiModel ? { ...ai, model: cfg.aiModel } : ai

  let replacing: MarketingPost | null = null
  if (opts.regenerateOf) {
    replacing = await store.getPost(opts.regenerateOf)
    if (!replacing) return { ok: false, code: 'not_found', message: 'Post not found.', reasons: [], attempts: 0 }
  }

  // 1–3. Objective, recent content, recent performance.
  const objective = currentObjective(now, cfg.launchDate, cfg.timezone)
  const history = (await store.listPosts({ platform, since: new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString() })).filter((p) => p.id !== replacing?.id)
  const insights = await store.latestInsights()

  // 4–5. Pillar and topic.
  const strategyHistory = history.map(toStrategyPost)
  const choice = selectPillar(strategyHistory, { now, tz: cfg.timezone, launchDate: cfg.launchDate, multipliers: insights?.pillarMultipliers, forced: opts.pillar ?? replacing?.pillar ?? null })
  const topic = selectTopic(choice.pillar, strategyHistory, now, opts.topicKey ?? replacing?.topicKey ?? null)
  const id = randomUUID()
  const includeLink = decideLink(choice.pillar, strategyHistory, cfg.urlShare)
  const includeImage = decideImage(choice.pillar, strategyHistory)
  const link = includeLink ? utmUrl(id, platform, cfg.utmCampaign) : null
  const linkCost = link ? 25 : 0 // 23 for the link + the blank line before it
  const maxChars = cfg.xMaxChars - linkCost
  const targetChars = Math.max(100, cfg.targetMaxChars - linkCost)
  const forbidden = forbiddenTermsFromEnv(env)
  const recent = history
    .filter((p) => p.status !== 'cancelled' && p.source !== 'imported')
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
    .map((p) => ({ pillar: p.pillar, hook: p.hook, cta: p.cta, topic: p.topic }))

  // 6–9. Draft → length → claims → repetition (with feedback).
  let feedback: string[] = []
  let attempts = 0
  let accepted: { draft: MarketingDraft; text: string; report: ValidationReport; similarity: number; closestId: string | null } | null = null
  let lastModel = aiCfg.model
  while (attempts < maxAttempts && !accepted) {
    if (attempts > 0 && Date.now() - started > budget - 20_000) break
    attempts++
    const res = await callStructured({
      feature: 'marketing_post',
      schema: MarketingDraftSchema as unknown as z.ZodType<MarketingDraft>,
      system: systemPrompt(),
      user: userPrompt({ objective, pillar: choice.pillar, topic, includeLink, includeImage, maxChars, targetChars, recent, learnings: insights?.recommendations ?? [], feedback, today: localDate(now, cfg.timezone), launchDate: cfg.launchDate }),
      sessionId: `mkt-${id}`,
      maxTokens: 900,
      cfg: aiCfg,
    })
    if (!res.ok) {
      feedback = [`The model call failed (${res.code}).`]
      if (res.code === 'timeout' || res.code === 'provider_error' || res.code === 'high_demand') {
        await store.audit(null, opts.actor ?? null, 'generation_failed', { code: res.code, attempt: attempts })
        return { ok: false, code: 'ai_failed', message: 'The AI provider failed. Try again in a minute.', reasons: [res.code], attempts }
      }
      continue
    }
    lastModel = res.model
    const draft = res.data
    const text = assembleText(draft, link)
    const report = validatePost(text, { pillar: choice.pillar, maxChars: cfg.xMaxChars, allowedLink: link, forbiddenTerms: forbidden })
    const reasons = [...report.errors.map((e) => e.message), ...dateIssues(text, { today: localDate(now, cfg.timezone), launchDate: cfg.launchDate }), ...inventedSpecifics(text)]
    if (includeImage) {
      for (const i of claimIssues(draft.imageHeadline, forbidden)) reasons.push(`Image headline: ${i.message}`)
      if (/\d/.test(draft.imageHeadline)) reasons.push('Image headline: no numbers on images.')
      if (!draft.imageHeadline.trim() || !draft.imagePrompt.trim()) reasons.push('Image headline and image prompt are required.')
    }
    const unknownFacts = draft.factsUsed.filter((f) => !KNOWN_FACTS.has(f))
    if (unknownFacts.length) reasons.push(`Cites facts that are not in the fact sheet: ${unknownFacts.join(', ')}.`)
    const rep = checkRepetition({ text, hook: draft.hook, cta: draft.cta, topicKey: topic.key, excludeIds: replacing ? [replacing.id] : [] }, history.map(toHistoryItem), now)
    reasons.push(...rep.reasons.map((r) => r.message))
    if (!reasons.length) accepted = { draft, text, report, similarity: rep.score, closestId: rep.closestId }
    else feedback = reasons
  }
  if (!accepted) {
    await store.audit(null, opts.actor ?? null, 'generation_rejected', { pillar: choice.pillar, topic: topic.key, attempts, reasons: feedback.slice(0, 10) })
    return { ok: false, code: 'rejected', message: 'Every draft failed validation or repeated recent posts.', reasons: feedback, attempts }
  }

  // 10–11. Image prompt → image (a failed image never blocks the post: it goes out as text).
  const { draft, text, report } = accepted
  let image: { path: string | null; status: MarketingPost['imageStatus']; provider: string | null; prompt: string | null } = { path: null, status: includeImage ? 'skipped' : 'none', provider: null, prompt: null }
  if (includeImage) {
    const scene = sanitizeImagePrompt(draft.imagePrompt)
    const provider = await getImageProvider(cfg, env)
    if (provider && !imagePromptIssues(scene).length && Date.now() - started < budget) {
      try {
        const img = await provider.generate({ postId: id, pillar: choice.pillar, prompt: scene, headline: draft.imageHeadline, altText: draft.altText })
        const ext = img.mimeType === 'image/jpeg' ? 'jpg' : img.mimeType === 'image/webp' ? 'webp' : 'png'
        const path = `${platform}/${id}/${Date.now()}.${ext}`
        await store.uploadImage(path, img.bytes, img.mimeType)
        image = { path, status: 'generated', provider: img.provider, prompt: img.prompt }
      } catch (e) {
        console.warn('marketing image failed', (e as Error).message?.slice(0, 200))
        image = { path: null, status: 'failed', provider: provider.name, prompt: scene }
      }
    }
  }

  // 12–13. Store (draft, or approved + scheduled when autonomous).
  const autonomous = !!opts.autonomous && !!opts.scheduleAt
  const post = await store.insertPost({
    id,
    platform,
    content_type: image.path ? 'text_image' : 'text',
    content_pillar: choice.pillar,
    topic_key: topic.key,
    topic: draft.topic.slice(0, 100),
    hook: draft.hook.slice(0, 200),
    cta: draft.cta,
    text,
    link_url: link,
    image_path: image.path,
    image_prompt: image.prompt ?? (includeImage ? draft.imagePrompt : null),
    image_alt: includeImage ? draft.altText || null : null,
    image_provider: image.provider,
    image_status: image.status,
    status: autonomous ? 'scheduled' : 'draft',
    origin: 'agent',
    autonomous,
    scheduled_at: autonomous ? opts.scheduleAt!.toISOString() : null,
    approved_at: autonomous ? now.toISOString() : null,
    created_by: opts.actor ?? null,
    similarity_score: Math.round(accepted.similarity * 10_000) / 10_000,
    similar_post_id: accepted.closestId,
    validation: report as never,
    generation: {
      provider: aiCfg.provider,
      model: lastModel,
      attempts,
      durationMs: Date.now() - started,
      objective: objective.phase,
      pillarReason: choice.reason,
      topicAngle: topic.angle,
      includeLink,
      includeImage,
      angle: draft.angle,
      factsUsed: draft.factsUsed,
      insightsId: insights?.id ?? null,
      imageHeadline: includeImage ? draft.imageHeadline : null,
    } as never,
  })
  if (replacing && ['draft', 'approved', 'scheduled', 'failed', 'dry_run'].includes(replacing.status)) {
    await store.updatePost(replacing.id, { status: 'cancelled' }, ['draft', 'approved', 'scheduled', 'failed', 'dry_run'])
    await store.audit(replacing.id, opts.actor ?? null, 'replaced', { by: post.id })
  }
  await store.audit(post.id, opts.actor ?? null, autonomous ? 'generated_scheduled' : 'generated', { pillar: post.pillar, topic: topic.key, attempts, link: includeLink, image: image.status })
  return { ok: true, post, attempts }
}
