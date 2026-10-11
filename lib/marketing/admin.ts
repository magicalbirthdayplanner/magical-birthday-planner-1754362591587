/**
 * Admin operations for /admin/marketing (called only from Super Admin routes). Every state change validates first,
 * uses a conditional status update, and is written to marketing_audit_log. SERVER ONLY.
 */
import 'server-only'
import { cadenceFor, readMarketingConfig, type MarketingConfig } from './config'
import { generateMarketingPost } from './generate'
import { regenerateSlot } from './batch'
import { getMarketingProvider, type MarketingProvider } from './providers'
import { publishPost, type PublishOutcome } from './publish'
import { getMarketingStore, type MarketingStore } from './store'
import { firstSentence } from './text'
import { nextFreeSlot } from './time'
import { PILLAR_LABEL, type MarketingPost } from './types'
import { forbiddenTermsFromEnv, platformRules, validatePost } from './validation'

export interface AdminContext { store: MarketingStore; cfg: MarketingConfig; provider: MarketingProvider; actor: string; now: Date }

export function adminContext(actor: string, overrides: Partial<AdminContext> = {}): AdminContext {
  const cfg = overrides.cfg ?? readMarketingConfig()
  return { cfg, store: overrides.store ?? getMarketingStore(), provider: overrides.provider ?? getMarketingProvider('x', cfg), actor, now: overrides.now ?? new Date() }
}

export type AdminPost = MarketingPost & { imageUrl: string | null; pillarLabel: string }

async function withImage(store: MarketingStore, p: MarketingPost): Promise<AdminPost> {
  return { ...p, pillarLabel: PILLAR_LABEL[p.pillar], imageUrl: p.imagePath ? await store.signedImageUrl(p.imagePath, 3600).catch(() => null) : null }
}

export type ActionResult = { ok: true; post?: AdminPost | null; detail?: unknown } | { ok: false; status: number; message: string; detail?: unknown }

const fail = (status: number, message: string, detail?: unknown): ActionResult => ({ ok: false, status, message, detail })
/** The browser only sees the error message, so the reasons travel inside it. */
const why = (message: string, reasons: string[]) => (reasons.length ? `${message} ${reasons.slice(0, 4).join(' ')}` : message).slice(0, 600)

function check(ctx: AdminContext, p: MarketingPost, text = p.text) {
  const rules = platformRules(p.platform, ctx.cfg)
  return validatePost(text, { ...rules, pillar: p.pillar, allowedLink: p.linkUrl, forbiddenTerms: forbiddenTermsFromEnv(), minChars: p.format === 'poll' ? 10 : rules.minChars })
}

export async function postAction(ctx: AdminContext, id: string, body: { action: string; at?: string; text?: string; url?: string; confirmNotPosted?: boolean }): Promise<ActionResult> {
  const { store, actor, now, cfg } = ctx
  const post = await store.getPost(id)
  if (!post) return fail(404, 'Post not found.')
  const done = async (p: MarketingPost | null, action: string, detail: Record<string, unknown> = {}): Promise<ActionResult> => {
    if (!p) return fail(409, 'The post changed in the meantime — refresh and try again.')
    await store.audit(p.id, actor, action, detail)
    return { ok: true, post: await withImage(store, p) }
  }
  const unconfirmed = post.status === 'failed' && post.publishErrorCode === 'publish_unconfirmed'

  switch (body.action) {
    case 'approve': {
      if (!['draft', 'failed'].includes(post.status)) return fail(409, `A ${post.status} post can't be approved.`)
      if (unconfirmed && !body.confirmNotPosted) return fail(409, 'This post may already be live. Check the account first, then confirm it was NOT posted.')
      const report = check(ctx, post)
      if (!report.ok) return fail(422, why('Fix the validation errors first:', report.errors.map((e) => e.message)), report)
      // A planned post keeps its slot: approving queues it (it publishes at its time, with or without autonomous mode).
      const queued = !!post.scheduledAt && new Date(post.scheduledAt).getTime() > now.getTime()
      return done(await store.updatePost(id, { status: queued ? 'scheduled' : 'approved', autonomous: false, approved_at: now.toISOString(), approved_by: actor, validation: report as never, publish_error_code: null, publish_error: null }, ['draft', 'failed']), 'approved')
    }
    case 'schedule': {
      if (!['draft', 'approved', 'scheduled', 'failed'].includes(post.status)) return fail(409, `A ${post.status} post can't be scheduled.`)
      if (unconfirmed && !body.confirmNotPosted) return fail(409, 'This post may already be live. Check the account first, then confirm it was NOT posted.')
      const report = check(ctx, post)
      if (!report.ok) return fail(422, why('Fix the validation errors first:', report.errors.map((e) => e.message)), report)
      let at: Date | null
      if (body.at) {
        at = new Date(body.at)
        if (Number.isNaN(at.getTime()) || at.getTime() < now.getTime() + 2 * 60_000 || at.getTime() > now.getTime() + 30 * 86_400_000) return fail(400, 'Pick a time between 2 minutes and 30 days from now.')
      } else {
        const others = await store.listPosts({ platform: post.platform, statuses: ['approved', 'scheduled', 'publishing', 'published', 'dry_run'] })
        const cad = cadenceFor(cfg, post.platform)
        at = nextFreeSlot(now, { times: cad.postTimes, perDay: cad.postsPerDay, tz: cfg.timezone, taken: others.filter((p) => p.id !== id).map((p) => p.scheduledAt ?? p.publishedAt ?? p.dryRunAt).filter((x): x is string => !!x).map((x) => new Date(x)) })
        if (!at) return fail(409, 'No free slot in the next 14 days.')
      }
      return done(
        await store.updatePost(id, { status: 'scheduled', autonomous: false, scheduled_at: at.toISOString(), approved_at: post.approvedAt ?? now.toISOString(), approved_by: actor, validation: report as never, publish_error_code: null, publish_error: null }, ['draft', 'approved', 'scheduled', 'failed']),
        'scheduled',
        { at: at.toISOString() },
      )
    }
    case 'publish_now': {
      if (!['draft', 'approved', 'scheduled', 'failed'].includes(post.status)) return fail(409, `A ${post.status} post can't be published.`)
      if (unconfirmed && !body.confirmNotPosted) return fail(409, 'This post may already be live. Check the account first, then confirm it was NOT posted.')
      const report = check(ctx, post)
      if (!report.ok) return fail(422, why('Fix the validation errors first:', report.errors.map((e) => e.message)), report)
      const provider = post.platform === 'x' ? ctx.provider : getMarketingProvider(post.platform, cfg)
      if (!cfg.dryRun && !provider.configured()) return fail(503, `${post.platform} is not connected (missing credentials).`)
      if (post.status === 'draft' || post.status === 'failed') {
        const ok = await store.updatePost(id, { status: 'approved', approved_at: now.toISOString(), approved_by: actor, publish_error_code: null, publish_error: null }, ['draft', 'failed'])
        if (!ok) return fail(409, 'The post changed in the meantime — refresh and try again.')
      }
      const r: PublishOutcome = await publishPost(id, 'manual', { store, provider, cfg }, { now, actor })
      if (!r.ok) {
        const messages: Record<string, string> = {
          daily_limit: 'Daily safety ceiling reached for manual posts.',
          min_gap: 'Another post went out a few minutes ago — wait a little.',
          validation: 'Validation failed right before publishing.',
          repetitive: 'Too similar to something already posted.',
          publish_unconfirmed: 'X did not confirm the post. It may be live — check X before retrying.',
          provider_not_configured: 'X credentials are not configured.',
        }
        return fail(r.status === 'skipped' ? 409 : 502, messages[r.reason] ?? `Publishing failed (${r.reason}).`, { reason: r.reason, post: r.post ? await withImage(store, r.post) : null })
      }
      return { ok: true, post: await withImage(store, r.post), detail: { status: r.status } }
    }
    case 'cancel':
      if (!['draft', 'approved', 'scheduled', 'failed'].includes(post.status)) return fail(409, `A ${post.status} post can't be cancelled.`)
      return done(await store.updatePost(id, { status: 'cancelled' }, ['draft', 'approved', 'scheduled', 'failed']), 'cancelled')
    case 'edit': {
      if (!['draft', 'approved', 'scheduled', 'failed'].includes(post.status)) return fail(409, `A ${post.status} post can't be edited.`)
      const text = (body.text ?? '').replace(/\r\n/g, '\n').trim()
      const report = check(ctx, post, text)
      if (!report.ok) return fail(422, why('The edited text does not pass validation:', report.errors.map((e) => e.message)), report)
      // Edited content needs a fresh approval.
      return done(
        await store.updatePost(id, { text, hook: firstSentence(text).slice(0, 200), validation: report as never, status: 'draft', scheduled_at: null, approved_at: null, approved_by: null, origin: post.origin }, ['draft', 'approved', 'scheduled', 'failed']),
        'edited',
      )
    }
    case 'regenerate': {
      if (!['draft', 'approved', 'scheduled', 'failed'].includes(post.status)) return fail(409, `A ${post.status} post can't be regenerated.`)
      if (post.planId) {
        const rs = await regenerateSlot(store, cfg, { postId: id, actor, now })
        if (!rs.ok) return fail(422, rs.message)
        const fresh = await store.getPost(rs.postId)
        return { ok: true, post: fresh ? await withImage(store, fresh) : null }
      }
      const r = await generateMarketingPost({ platform: post.platform, now, actor, regenerateOf: id }, { store, cfg })
      if (!r.ok) return fail(r.code === 'ai_not_configured' ? 503 : 422, why(r.message, r.reasons), { reasons: r.reasons })
      return { ok: true, post: await withImage(store, r.post) }
    }
    case 'link_external': {
      // The founder confirms an unconfirmed publish actually went out, by pasting its X URL.
      if (post.status !== 'failed') return fail(409, 'Only a failed post can be linked to a live X post.')
      const m = (body.url ?? '').trim().match(/^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15}|i\/web)\/status\/(\d{5,25})(?:[/?#].*)?$/)
      if (!m) return fail(400, 'Paste the post URL, like https://x.com/<handle>/status/<id>.')
      return done(
        await store.updatePost(id, { status: 'published', published_at: post.publishingStartedAt ?? now.toISOString(), external_post_id: m[2], external_post_url: `https://x.com/${m[1]}/status/${m[2]}`, publish_error_code: null, publish_error: null }, ['failed']),
        'linked_external',
        { externalId: m[2] },
      )
    }
    default:
      return fail(400, 'Unknown action.')
  }
}

export async function deletePost(ctx: AdminContext, id: string): Promise<ActionResult> {
  const post = await ctx.store.getPost(id)
  if (!post) return fail(404, 'Post not found.')
  if (!['draft', 'cancelled'].includes(post.status)) return fail(409, 'Only drafts and cancelled posts can be deleted.')
  const ok = await ctx.store.deletePost(id, ['draft', 'cancelled'])
  if (!ok) return fail(409, 'The post changed in the meantime — refresh and try again.')
  if (post.imagePath) await ctx.store.deleteImage(post.imagePath).catch(() => undefined)
  await ctx.store.audit(null, ctx.actor, 'deleted', { postId: id, status: post.status })
  return { ok: true }
}
