/**
 * X (Twitter) provider — X API v2 with OAuth 1.0a user context (the brand account).
 *   POST /2/media/upload                         image (JSON, base64, tweet_image)
 *   POST /2/media/upload/initialize|{id}/append|{id}/finalize, GET ?command=STATUS   video (chunked)
 *   POST /2/media/metadata                       alt text (optional — billed)
 *   POST /2/tweets                               text / images / video / poll / thread reply
 *   GET  /2/users/{id}/tweets                    own posts + metrics ("owned read", the cheapest read)
 *   GET  /2/tweets?ids=…                         posts by id (fallback)
 *   GET  /2/users/me                             connection check
 * Every request is reported to the meter (budget ledger) with its billable operation and units.
 * Only legitimate founder posting: no follows, likes, mass replies, DMs, mentions or scraping exist in this module.
 * Credentials come from X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET and are never logged,
 * stored or returned. SERVER ONLY.
 */
import 'server-only'
import type { XMeter, XOp } from '../budget'
import { containsLink } from '../text'
import type { PlatformMetrics, PollSpec } from '../types'
import { oauth1Header, type OAuth1Credentials } from './oauth1'
import { MarketingProviderError, type AccountInfo, type MarketingProvider, type MediaInput, type OwnPost, type PublishInput, type PublishResult } from './types'

export interface XProviderOptions {
  credentials: OAuth1Credentials | null
  maxChars: number
  username?: string | null
  baseUrl?: string
  fetchImpl?: typeof fetch
  /** Upper bound for every call (per-call defaults: 20 s, posting 30 s, uploads 45 s). */
  timeoutMs?: number
  meter?: XMeter | null
  /** Video processing: how long to wait for X to finish (ms) and the sleep function (tests). */
  videoWaitMs?: number
  sleep?: (ms: number) => Promise<void>
}

type XProblem = { title?: string; detail?: string; errors?: { message?: string; detail?: string }[] }
type Tweet = {
  id: string
  text?: string
  created_at?: string
  public_metrics?: { retweet_count?: number; reply_count?: number; like_count?: number; quote_count?: number; bookmark_count?: number; impression_count?: number }
  non_public_metrics?: { impression_count?: number; url_link_clicks?: number; user_profile_clicks?: number }
}

const VIDEO_CHUNK = 4 * 1024 * 1024

export function xCredentialsFromEnv(env: Record<string, string | undefined> = process.env): OAuth1Credentials | null {
  const consumerKey = env.X_API_KEY?.trim()
  const consumerSecret = env.X_API_SECRET?.trim()
  const token = env.X_ACCESS_TOKEN?.trim()
  const tokenSecret = env.X_ACCESS_TOKEN_SECRET?.trim()
  return consumerKey && consumerSecret && token && tokenSecret ? { consumerKey, consumerSecret, token, tokenSecret } : null
}

export function toMetrics(t: Tweet): PlatformMetrics {
  const pub = t.public_metrics ?? {}
  const np = t.non_public_metrics ?? {}
  const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    impressions: n(np.impression_count) ?? n(pub.impression_count),
    likes: n(pub.like_count),
    reposts: n(pub.retweet_count),
    replies: n(pub.reply_count),
    quotes: n(pub.quote_count),
    bookmarks: n(pub.bookmark_count),
    profileVisits: n(np.user_profile_clicks),
    linkClicks: n(np.url_link_clicks),
  }
}

interface CallOpts { timeoutMs?: number; sideEffect?: boolean; op?: XOp; units?: (body: unknown) => number; form?: FormData; detail?: Record<string, unknown> }

export class XMarketingProvider implements MarketingProvider {
  readonly platform = 'x' as const
  readonly maxChars: number
  private base: string
  private f: typeof fetch
  private username: string | null
  private accessLevel: string | null = null
  private meter: XMeter | null

  constructor(private opts: XProviderOptions) {
    this.maxChars = opts.maxChars
    this.base = (opts.baseUrl ?? 'https://api.x.com').replace(/\/+$/, '')
    this.f = opts.fetchImpl ?? fetch
    this.username = opts.username ?? null
    this.meter = opts.meter ?? null
  }

  configured() {
    return !!this.opts.credentials
  }

  setMeter(meter: XMeter | null) {
    this.meter = meter
  }

  private async report(op: XOp | undefined, units: number, ok: boolean, detail?: Record<string, unknown>) {
    if (!op || !this.meter) return
    try {
      await this.meter(op, units, ok, detail)
    } catch {
      /* the ledger must never break publishing */
    }
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, opts: CallOpts = {}): Promise<T> {
    const creds = this.opts.credentials
    if (!creds) throw new MarketingProviderError('not_configured', 'X credentials are not configured')
    const url = `${this.base}${path}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.min(opts.timeoutMs ?? 20_000, this.opts.timeoutMs ?? Infinity))
    let res: Response
    try {
      res = await this.f(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: oauth1Header(creds, method, url),
          'User-Agent': 'magical-birthday-planner-growth-engine/1.0',
          ...(body !== undefined && !opts.form ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.form ?? (body !== undefined ? JSON.stringify(body) : undefined),
        cache: 'no-store',
      })
    } catch {
      const timedOut = ctrl.signal.aborted
      // A write that timed out may still have happened on X's side (and been billed): record it as a charge.
      if (opts.sideEffect) await this.report(opts.op, 1, true, { ...opts.detail, unconfirmed: true })
      throw new MarketingProviderError(timedOut ? 'timeout' : 'unavailable', timedOut ? 'X request timed out' : 'X network error', undefined, !!opts.sideEffect)
    } finally {
      clearTimeout(timer)
    }
    this.accessLevel = res.headers.get('x-access-level') ?? this.accessLevel
    const text = await res.text().catch(() => '')
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      // 5xx after a write may still have been processed (and billed): count it; other failures are recorded at $0.
      await this.report(opts.op, 1, opts.sideEffect === true && res.status >= 500, { ...opts.detail, status: res.status })
      throw this.toError(res, parsed as XProblem | null, !!opts.sideEffect)
    }
    await this.report(opts.op, opts.units ? opts.units(parsed) : 1, true, opts.detail)
    return parsed as T
  }

  private toError(res: Response, p: XProblem | null, sideEffect: boolean): MarketingProviderError {
    // Only X's own short problem text is kept (it never contains our credentials), capped.
    const detail = (p?.detail || p?.title || p?.errors?.[0]?.detail || p?.errors?.[0]?.message || `HTTP ${res.status}`).slice(0, 200)
    const s = res.status
    if (s === 401) return new MarketingProviderError('auth', `X rejected the credentials: ${detail}`, s)
    if (s === 402) return new MarketingProviderError('payment_required', `X API credits required: ${detail}`, s)
    if (s === 403 && /duplicate/i.test(detail)) return new MarketingProviderError('duplicate', `X refused a duplicate post: ${detail}`, s)
    if (s === 403) return new MarketingProviderError('forbidden', `X refused the request: ${detail}`, s)
    if (s === 429) {
      const reset = Number(res.headers.get('x-rate-limit-reset'))
      return new MarketingProviderError('rate_limited', 'X rate limit reached', s, false, Number.isFinite(reset) && reset > 0 ? Math.max(0, reset - Math.floor(Date.now() / 1000)) : undefined)
    }
    if (s >= 500) return new MarketingProviderError('unavailable', `X is unavailable (${s})`, s, sideEffect)
    return new MarketingProviderError('invalid', `X rejected the request: ${detail}`, s)
  }

  async verify(): Promise<AccountInfo> {
    const r = await this.call<{ data?: { id: string; username: string; name?: string } }>('GET', '/2/users/me', undefined, { op: 'user_read' })
    if (!r?.data?.id) throw new MarketingProviderError('unknown', 'X returned no account')
    this.username = r.data.username
    return { id: r.data.id, username: r.data.username, name: r.data.name ?? null, accessLevel: this.accessLevel }
  }

  async uploadImage(media: MediaInput, altText = false): Promise<string> {
    if (!/^image\/(png|jpe?g|webp)$/.test(media.mimeType)) throw new MarketingProviderError('invalid', `Unsupported image type ${media.mimeType}`)
    if (media.bytes.byteLength > 5 * 1024 * 1024) throw new MarketingProviderError('invalid', 'Image is larger than 5 MB')
    const r = await this.call<{ data?: { id?: string } }>('POST', '/2/media/upload', { media: Buffer.from(media.bytes).toString('base64'), media_category: 'tweet_image' }, { timeoutMs: 45_000, op: 'media_upload' })
    const id = r?.data?.id
    if (!id) throw new MarketingProviderError('unknown', 'X returned no media id')
    if (altText && media.altText) {
      // Alt text is best effort and billed separately: a failure here never blocks the post.
      await this.call('POST', '/2/media/metadata', { id, metadata: { alt_text: { text: media.altText.slice(0, 1000) } } }, { op: 'media_metadata' }).catch(() => undefined)
    }
    return id
  }

  async uploadVideo(media: MediaInput): Promise<string> {
    if (media.mimeType !== 'video/mp4') throw new MarketingProviderError('invalid', `Unsupported video type ${media.mimeType}`)
    if (media.bytes.byteLength > 100 * 1024 * 1024) throw new MarketingProviderError('invalid', 'Video is larger than 100 MB')
    const init = await this.call<{ data?: { id?: string } }>('POST', '/2/media/upload/initialize', { media_type: 'video/mp4', total_bytes: media.bytes.byteLength, media_category: 'tweet_video' }, { op: 'media_upload', detail: { step: 'initialize' } })
    const id = init?.data?.id
    if (!id) throw new MarketingProviderError('unknown', 'X returned no media id')
    for (let i = 0, seg = 0; i < media.bytes.byteLength; i += VIDEO_CHUNK, seg++) {
      const form = new FormData()
      form.append('segment_index', String(seg))
      form.append('media', new Blob([media.bytes.slice(i, i + VIDEO_CHUNK)], { type: 'application/octet-stream' }), `chunk${seg}`)
      await this.call('POST', `/2/media/upload/${id}/append`, undefined, { form, timeoutMs: 45_000, op: 'media_upload', detail: { step: 'append', segment: seg } })
    }
    type Proc = { data?: { processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } } } }
    let fin = await this.call<Proc>('POST', `/2/media/upload/${id}/finalize`, undefined, { timeoutMs: 45_000, op: 'media_upload', detail: { step: 'finalize' } })
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
    const deadline = Date.now() + (this.opts.videoWaitMs ?? 25_000)
    while (fin?.data?.processing_info && ['pending', 'in_progress'].includes(fin.data.processing_info.state ?? '')) {
      if (Date.now() > deadline) throw new MarketingProviderError('timeout', 'X is still processing the video')
      await sleep(Math.min(10, Math.max(1, fin.data.processing_info.check_after_secs ?? 2)) * 1000)
      fin = await this.call<Proc>('GET', `/2/media/upload?command=STATUS&media_id=${id}`, undefined, { op: 'media_upload', detail: { step: 'status' } })
    }
    if (fin?.data?.processing_info?.state === 'failed') throw new MarketingProviderError('invalid', `X could not process the video: ${fin.data.processing_info.error?.message ?? 'failed'}`.slice(0, 200))
    return id
  }

  async createPost(input: { text: string; mediaIds?: string[]; poll?: PollSpec | null; replyTo?: string | null; detail?: Record<string, unknown> }) {
    const body = {
      text: input.text,
      ...(input.mediaIds?.length ? { media: { media_ids: input.mediaIds } } : {}),
      ...(input.poll ? { poll: { options: input.poll.options, duration_minutes: input.poll.durationMinutes } } : {}),
      ...(input.replyTo ? { reply: { in_reply_to_tweet_id: input.replyTo } } : {}),
    }
    const op: XOp = containsLink(input.text) ? 'post_create_url' : 'post_create'
    const r = await this.call<{ data?: { id?: string } }>('POST', '/2/tweets', body, { sideEffect: true, timeoutMs: 30_000, op, detail: input.detail })
    const id = r?.data?.id
    // The request succeeded but no id came back: it may be live — treat as unconfirmed.
    if (!id) throw new MarketingProviderError('unknown', 'X returned no post id', undefined, true)
    return { externalId: id, url: this.postUrl(id) }
  }

  postUrl(id: string): string {
    return this.username ? `https://x.com/${this.username}/status/${id}` : `https://x.com/i/web/status/${id}`
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const list = !input.media ? [] : Array.isArray(input.media) ? input.media : [input.media]
    const mediaIds: string[] = []
    let mediaError: string | null = null
    if (!input.poll) {
      for (const m of list.slice(0, 4)) {
        try {
          if (m.mimeType.startsWith('video/')) {
            mediaIds.push(await this.uploadVideo(m))
            break // one video per post
          }
          mediaIds.push(await this.uploadImage(m, !!input.altText))
        } catch (e) {
          if (e instanceof MarketingProviderError && (e.kind === 'auth' || e.kind === 'not_configured' || e.kind === 'payment_required')) throw e
          mediaError = e instanceof Error ? e.message : 'upload failed'
        }
      }
    }
    const post = await this.createPost({ text: input.text, mediaIds, poll: input.poll ?? null })
    const threadIds: string[] = []
    let parent = post.externalId
    for (const part of input.thread ?? []) {
      // A failed reply never un-publishes the root: keep what went out, stop the thread.
      try {
        const r = await this.createPost({ text: part, replyTo: parent, detail: { threadPart: true } })
        threadIds.push(r.externalId)
        parent = r.externalId
      } catch (e) {
        mediaError = `${mediaError ? `${mediaError}; ` : ''}thread stopped: ${e instanceof Error ? e.message : 'error'}`
        break
      }
    }
    return { externalId: post.externalId, url: post.url, mediaId: mediaIds[0] ?? null, mediaIds, threadIds, mediaError }
  }

  async getMetrics(externalIds: string[]): Promise<Map<string, PlatformMetrics>> {
    const out = new Map<string, PlatformMetrics>()
    const ids = externalIds.filter((x) => /^\d{1,25}$/.test(x)).slice(0, 100)
    if (!ids.length) return out
    const count = (b: unknown) => ((b as { data?: unknown[] })?.data ?? []).length
    let r: { data?: Tweet[] } | null = null
    try {
      r = await this.call('GET', `/2/tweets?ids=${ids.join(',')}&tweet.fields=public_metrics,non_public_metrics`, undefined, { op: 'post_read', units: count })
    } catch (e) {
      if (!(e instanceof MarketingProviderError) || !['invalid', 'forbidden'].includes(e.kind)) throw e
      r = await this.call('GET', `/2/tweets?ids=${ids.join(',')}&tweet.fields=public_metrics`, undefined, { op: 'post_read', units: count })
    }
    for (const t of r?.data ?? []) out.set(t.id, toMetrics(t))
    return out
  }

  async getOwnPosts(userId: string, opts: { startTime?: string; endTime?: string; maxResults?: number } = {}): Promise<OwnPost[]> {
    if (!/^\d{1,25}$/.test(userId)) throw new MarketingProviderError('invalid', 'Bad X user id')
    const q = (fields: string) => {
      const p = new URLSearchParams({ max_results: String(Math.min(100, Math.max(5, opts.maxResults ?? 100))), 'tweet.fields': fields })
      if (opts.startTime) p.set('start_time', opts.startTime)
      if (opts.endTime) p.set('end_time', opts.endTime)
      return `/2/users/${userId}/tweets?${p.toString()}`
    }
    const count = (b: unknown) => ((b as { data?: unknown[] })?.data ?? []).length
    let r: { data?: Tweet[] } | null
    try {
      r = await this.call('GET', q('created_at,public_metrics,non_public_metrics'), undefined, { op: 'owned_read', units: count })
    } catch (e) {
      // non_public_metrics only exist for posts < 30 days old and some access levels: fall back to public metrics.
      if (!(e instanceof MarketingProviderError) || !['invalid', 'forbidden'].includes(e.kind)) throw e
      r = await this.call('GET', q('created_at,public_metrics'), undefined, { op: 'owned_read', units: count })
    }
    return (r?.data ?? []).map((t) => ({ id: t.id, text: t.text ?? '', createdAt: t.created_at ?? null, metrics: toMetrics(t) }))
  }
}
