/**
 * Publishing with duplicate-publish protection. Every publish goes through one path:
 *   fix product name → re-validate (text, poll, thread) → repetition → media checks (privacy-approved only) → budget
 *   (core post cost; link premium only if affordable, otherwise the link line is dropped) → claim (DB: advisory lock +
 *   conditional status change + daily limit + minimum gap) → dry-run record OR real post → store the external id(s);
 *   every X call is written to the budget ledger.
 * Running twice can't publish twice: only one caller wins the claim, and a post whose outcome is unknown (timeout after
 * sending) is marked publish_unconfirmed and never retried automatically. SERVER ONLY.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { MANUAL_DAILY_CEILING, MANUAL_MIN_GAP_MINUTES, type MarketingConfig } from './config'
import { MarketingProviderError, type MarketingProvider } from './providers'
import type { MediaInput } from './providers/types'
import { checkRepetition, toHistoryItem } from './repetition'
import type { MarketingStore } from './store'
import { startOfLocalDay } from './time'
import type { MarketingPost } from './types'
import { fixProductName, forbiddenTermsFromEnv, pollIssues, validatePost } from './validation'
import { xWeightedLength } from './text'
import { allowX, altTextAllowed, budgetSnapshot, estimatePostCost, xMeter } from './budget'
import { loadMedia, mediaIssues } from './media'

export type PublishMode = 'scheduled' | 'manual'
export type PublishOutcome =
  | { ok: true; status: 'published' | 'dry_run'; post: MarketingPost }
  | { ok: false; status: 'skipped' | 'failed' | 'requeued'; reason: string; post?: MarketingPost | null }

/** A claim older than this with no outcome is treated as "may have been posted". */
export const STALE_PUBLISHING_MINUTES = 15

export interface PublishDeps { store: MarketingStore; provider: MarketingProvider; cfg: MarketingConfig; env?: Record<string, string | undefined> }

export async function publishPost(postId: string, mode: PublishMode, deps: PublishDeps, opts: { now?: Date; actor?: string | null } = {}): Promise<PublishOutcome> {
  const { store, provider, cfg } = deps
  const now = opts.now ?? new Date()
  const actor = opts.actor ?? null
  let post = await store.getPost(postId)
  if (!post) return { ok: false, status: 'skipped', reason: 'not_found' }
  if (!['approved', 'scheduled'].includes(post.status)) return { ok: false, status: 'skipped', reason: `not_publishable:${post.status}`, post }
  const block = async (reason: string, message: string, extra: Record<string, unknown> = {}) => {
    const failed = await store.updatePost(post!.id, { status: 'failed', publish_error_code: reason, publish_error: message.slice(0, 500) }, ['approved', 'scheduled'])
    await store.audit(post!.id, actor, 'publish_blocked', { reason, ...extra })
    return { ok: false as const, status: 'failed' as const, reason, post: failed }
  }

  // Product name: fixed automatically, never published misspelled.
  const fixed = fixProductName(post.text)
  const fixedThread = post.threadParts?.map((t) => fixProductName(t).text) ?? null
  if (fixed.fixed || (fixedThread && JSON.stringify(fixedThread) !== JSON.stringify(post.threadParts))) {
    post = (await store.updatePost(post.id, { text: fixed.text, thread_parts: fixedThread as never }, ['approved', 'scheduled'])) ?? post
    await store.audit(post.id, actor, 'product_name_fixed', {})
  }

  // Re-validate right before publishing (rules may have changed since the draft was approved).
  const forbidden = forbiddenTermsFromEnv(deps.env)
  const report = validatePost(post.text, { pillar: post.pillar, maxChars: provider.maxChars, allowedLink: post.linkUrl, forbiddenTerms: forbidden, minChars: post.format === 'poll' ? 10 : undefined })
  const extra = [
    ...pollIssues(post.poll).map((i) => i.message),
    ...(post.threadParts ?? []).flatMap((t, i) => validatePost(t, { pillar: post!.pillar, maxChars: provider.maxChars, allowedLink: null, forbiddenTerms: forbidden, minChars: 20 }).errors.map((e) => `Thread part ${i + 2}: ${e.message}`)),
  ]
  if (!report.ok || extra.length) {
    await store.updatePost(post.id, { validation: report as never }, ['approved', 'scheduled'])
    return block('validation', [...report.errors.map((e) => e.message), ...extra].join(' '), { errors: report.errors.map((e) => e.code) })
  }
  const out = await store.listPosts({ platform: post.platform, statuses: ['published', 'publishing', 'dry_run'], since: new Date(now.getTime() - 45 * 86_400_000).toISOString() })
  const rep = checkRepetition({ id: post.id, text: post.text, hook: post.hook, cta: post.cta }, out.map(toHistoryItem), now)
  if (rep.reasons.some((r) => r.code === 'same_idea')) return block('repetitive', rep.reasons[0].message, { similarTo: rep.closestId })

  // Media: only privacy-approved library/template media, within X limits.
  const { inputs: mediaInputs, rows: mediaRows } = await loadMedia(store, post.mediaIds).catch(() => ({ inputs: [], rows: [] as never[] }))
  const mediaProblems = post.mediaIds.length ? mediaIssues(mediaRows, post.mediaIds.length) : []
  if (mediaProblems.length) return block('media', mediaProblems.join(' '))
  if (!cfg.dryRun && !provider.configured()) return { ok: false, status: 'skipped', reason: 'provider_not_configured', post }

  // Budget: the post itself is "core" spend; the link premium is discretionary — if it can't be afforded the link line
  // is dropped (the post stays valid without it) rather than overspending.
  const budget = await budgetSnapshot(store, cfg, now, deps.env)
  const prices = budget.prices
  if (post.linkUrl) {
    const premium = prices.post_create_url - prices.post_create
    if (!allowX(budget, premium, 'discretionary').ok) {
      const text = post.text.replace(`\n\n${post.linkUrl}`, '').replace(post.linkUrl, '').trim()
      const ok = validatePost(text, { pillar: post.pillar, maxChars: provider.maxChars, allowedLink: null, forbiddenTerms: forbidden }).ok
      if (!ok) return { ok: false, status: 'skipped', reason: 'budget_link', post }
      post = (await store.updatePost(post.id, { text, link_url: null }, ['approved', 'scheduled'])) ?? post
      await store.audit(post.id, actor, 'link_dropped_budget', { premium })
    }
  }
  const altText = altTextAllowed(budget, cfg) && mediaRows.some((r) => r.kind === 'image')
  const cost = estimatePostCost(post, prices, altText)
  const gate = allowX(budget, cost, 'core')
  if (!gate.ok) {
    await store.audit(post.id, actor, 'publish_skipped', { reason: gate.reason, cost, mode })
    return { ok: false, status: 'skipped', reason: gate.reason ?? 'budget', post }
  }

  const [maxPerDay, minGap] = mode === 'manual' ? [MANUAL_DAILY_CEILING, MANUAL_MIN_GAP_MINUTES] : [cfg.postsPerDay, cfg.minGapMinutes]
  const attempt = randomUUID()
  const claim = await store.claimPost(post.id, attempt, maxPerDay, minGap, startOfLocalDay(now, cfg.timezone))
  if (!claim.claimed) {
    await store.audit(post.id, actor, 'publish_skipped', { reason: claim.reason, mode })
    return { ok: false, status: 'skipped', reason: claim.reason, post }
  }
  const previous = post.status

  if (cfg.dryRun) {
    const payload = {
      platform: post.platform, mode, format: post.format, text: post.text, weightedLength: xWeightedLength(post.text), poll: post.poll, thread: post.threadParts,
      media: mediaRows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, source: r.source })), image: post.imagePath, imageAlt: post.imageAlt,
      estimatedCostUsd: cost, altText, wouldPublishAt: now.toISOString(), note: 'MARKETING_DRY_RUN=true — nothing was sent to the platform.',
    }
    const done = await store.updatePost(post.id, { status: 'dry_run', dry_run_at: now.toISOString(), dry_run_payload: payload as never }, ['publishing'])
    await store.audit(post.id, actor, 'dry_run_publish', { mode, cost })
    return { ok: true, status: 'dry_run', post: done ?? post }
  }

  provider.setMeter(xMeter(store, prices, post.id))
  try {
    const media: MediaInput[] = [...mediaInputs]
    if (!media.length && post.imagePath && post.imageStatus === 'generated') {
      try {
        const bytes = await store.downloadImage(post.imagePath)
        media.push({ bytes, mimeType: post.imagePath.endsWith('.jpg') ? 'image/jpeg' : post.imagePath.endsWith('.webp') ? 'image/webp' : 'image/png', altText: post.imageAlt })
      } catch {
        /* image unavailable: the text still goes out */
      }
    }
    const res = await provider.publish({ text: post.text, media, poll: post.poll, thread: post.threadParts, altText })
    const patch = {
      status: 'published' as const,
      published_at: now.toISOString(),
      external_post_id: res.externalId,
      external_post_url: res.url,
      external_media_id: res.mediaId,
      external_thread_ids: res.threadIds ?? [],
      ...((post.imagePath || post.mediaIds.length) && !res.mediaId && !post.poll ? { image_status: 'upload_failed' as const } : {}),
    }
    let done = await store.updatePost(post.id, patch, ['publishing'])
    if (!done) done = await store.updatePost(post.id, patch) // claim lost to the stale sweeper: the post IS live, record it
    if (post.mediaIds.length && res.mediaId) await store.markMediaUsed(post.mediaIds)
    await store.audit(post.id, actor, 'published', { mode, externalId: res.externalId, mediaError: res.mediaError ?? null, threadParts: res.threadIds?.length ?? 0 })
    return { ok: true, status: 'published', post: done ?? post }
  } catch (e) {
    const err = e instanceof MarketingProviderError ? e : new MarketingProviderError('unknown', (e as Error)?.message ?? 'publish failed', undefined, true)
    if (err.unconfirmed) {
      const failed = await store.updatePost(post.id, { status: 'failed', publish_error_code: 'publish_unconfirmed', publish_error: `${err.message}. It may have been posted — check the account before retrying.`.slice(0, 500) }, ['publishing'])
      await store.audit(post.id, actor, 'publish_unconfirmed', { kind: err.kind, status: err.status ?? null })
      return { ok: false, status: 'failed', reason: 'publish_unconfirmed', post: failed }
    }
    if (err.kind === 'rate_limited' || err.kind === 'unavailable') {
      // Definitely not posted: put it back so the next run (or the founder) can try again.
      const back = await store.updatePost(post.id, { status: previous, publish_error_code: err.kind, publish_error: err.message.slice(0, 500) }, ['publishing'])
      await store.audit(post.id, actor, 'publish_requeued', { kind: err.kind, retryAfterSec: err.retryAfterSec ?? null })
      return { ok: false, status: 'requeued', reason: err.kind, post: back }
    }
    const failed = await store.updatePost(post.id, { status: 'failed', publish_error_code: err.kind, publish_error: err.message.slice(0, 500) }, ['publishing'])
    await store.audit(post.id, actor, 'publish_failed', { kind: err.kind, status: err.status ?? null })
    return { ok: false, status: 'failed', reason: err.kind, post: failed }
  } finally {
    provider.setMeter(null)
  }
}

/** Claims that never finished (crash/timeout mid-publish) become publish_unconfirmed failures — never auto-retried. */
export async function recoverStalePublishing(store: MarketingStore, now = new Date()): Promise<number> {
  const cutoff = now.getTime() - STALE_PUBLISHING_MINUTES * 60_000
  const stuck = (await store.listPosts({ statuses: ['publishing'], limit: 50 })).filter((p) => p.publishingStartedAt && new Date(p.publishingStartedAt).getTime() < cutoff)
  let n = 0
  for (const p of stuck) {
    const done = await store.updatePost(p.id, { status: 'failed', publish_error_code: 'publish_unconfirmed', publish_error: 'Publishing did not finish. It may have been posted — check the account before retrying.' }, ['publishing'])
    if (done) {
      n++
      await store.audit(p.id, null, 'publish_unconfirmed', { reason: 'stale_claim' })
    }
  }
  return n
}
