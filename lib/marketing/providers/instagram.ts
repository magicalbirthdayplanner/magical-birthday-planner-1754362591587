/**
 * Instagram provider — Instagram API with Instagram Login (graph.instagram.com), professional account only.
 *   POST /{ig-user-id}/media           create a container: image (image_url), carousel item, carousel (children), reel
 *   GET  /{container-id}?fields=status_code   wait until FINISHED
 *   POST /{ig-user-id}/media_publish   publish (the only step that makes a post public)
 *   GET  /{media-id}?fields=…  /insights        metrics
 *   GET  /{ig-user-id}/media           own posts
 * Instagram fetches media from URLs: the engine passes short-lived signed URLs of the private storage bucket.
 * Feed posts need media (no text-only posts) and captions can't carry clickable links. Meta doesn't bill these calls.
 * The token (IG_ACCESS_TOKEN) is sent only as a request parameter and never logged, stored or returned. SERVER ONLY.
 */
import 'server-only'
import type { XMeter } from '../budget'
import type { PlatformMetrics, PollSpec } from '../types'
import { MarketingProviderError, type AccountInfo, type MarketingProvider, type MediaInput, type OwnPost, type PublishInput, type PublishResult } from './types'

export interface InstagramProviderOptions {
  token: string | null
  userId: string | null
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** How long to wait for a container (mostly reels) to finish processing. */
  processWaitMs?: number
  sleep?: (ms: number) => Promise<void>
}

type Problem = { error?: { message?: string; code?: number; error_subcode?: number; type?: string } }

export function instagramFromEnv(env: Record<string, string | undefined> = process.env) {
  return { token: env.IG_ACCESS_TOKEN?.trim() || null, userId: /^\d{5,25}$/.test(env.IG_USER_ID?.trim() ?? '') ? env.IG_USER_ID!.trim() : null }
}

export class InstagramProvider implements MarketingProvider {
  readonly platform = 'instagram' as const
  readonly mediaByUrl = true
  readonly maxChars = 2200
  private base: string
  private f: typeof fetch

  constructor(private opts: InstagramProviderOptions) {
    this.base = (opts.baseUrl ?? 'https://graph.instagram.com/v24.0').replace(/\/+$/, '')
    this.f = opts.fetchImpl ?? fetch
  }

  configured() {
    return !!(this.opts.token && this.opts.userId)
  }

  setMeter(_meter: XMeter | null) {
    /* Meta does not bill these calls: nothing to meter */
  }

  private async call<T>(method: 'GET' | 'POST', path: string, params: Record<string, string> = {}, opts: { sideEffect?: boolean; timeoutMs?: number } = {}): Promise<T> {
    if (!this.configured()) throw new MarketingProviderError('not_configured', 'Instagram is not configured (IG_ACCESS_TOKEN, IG_USER_ID)')
    const qs = new URLSearchParams({ ...params, access_token: this.opts.token! })
    const url = method === 'GET' ? `${this.base}${path}${path.includes('?') ? '&' : '?'}${qs}` : `${this.base}${path}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.min(opts.timeoutMs ?? 30_000, this.opts.timeoutMs ?? Infinity))
    let res: Response
    try {
      res = await this.f(url, {
        method,
        signal: ctrl.signal,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
        body: method === 'POST' ? qs.toString() : undefined,
        cache: 'no-store',
      })
    } catch {
      const timedOut = ctrl.signal.aborted
      throw new MarketingProviderError(timedOut ? 'timeout' : 'unavailable', timedOut ? 'Instagram request timed out' : 'Instagram network error', undefined, !!opts.sideEffect)
    } finally {
      clearTimeout(timer)
    }
    const body = (await res.json().catch(() => null)) as (T & Problem) | null
    if (!res.ok || body?.error) {
      const e = body?.error ?? {}
      const msg = (e.message ?? `HTTP ${res.status}`).replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 200)
      const s = res.status
      if (s === 401 || e.code === 190) throw new MarketingProviderError('auth', `Instagram rejected the token: ${msg}`, s)
      if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613 || s === 429) throw new MarketingProviderError('rate_limited', `Instagram rate limit: ${msg}`, s)
      if (e.code === 10 || e.code === 200 || s === 403) throw new MarketingProviderError('forbidden', `Instagram refused: ${msg}`, s)
      if (s >= 500) throw new MarketingProviderError('unavailable', `Instagram is unavailable (${s})`, s, !!opts.sideEffect)
      throw new MarketingProviderError('invalid', `Instagram rejected the request: ${msg}`, s)
    }
    return body as T
  }

  async verify(): Promise<AccountInfo> {
    const r = await this.call<{ user_id?: string; username?: string; name?: string }>('GET', '/me', { fields: 'user_id,username,name,account_type' })
    if (!r?.username) throw new MarketingProviderError('unknown', 'Instagram returned no account')
    return { id: r.user_id ?? this.opts.userId ?? '', username: r.username, name: r.name ?? null, accessLevel: 'publish' }
  }

  async uploadImage(): Promise<string> {
    throw new MarketingProviderError('invalid', 'Instagram pulls media from URLs (use publish with media URLs)')
  }

  async uploadVideo(): Promise<string> {
    throw new MarketingProviderError('invalid', 'Instagram pulls media from URLs (use publish with media URLs)')
  }

  async createPost(_input: { text: string; mediaIds?: string[]; poll?: PollSpec | null; replyTo?: string | null }): Promise<{ externalId: string; url: string }> {
    throw new MarketingProviderError('invalid', 'Instagram feed posts need an image, a carousel or a video')
  }

  private async container(params: Record<string, string>): Promise<string> {
    const r = await this.call<{ id?: string }>('POST', `/${this.opts.userId}/media`, params, { timeoutMs: 60_000 })
    if (!r?.id) throw new MarketingProviderError('unknown', 'Instagram returned no container id')
    return r.id
  }

  private async waitReady(id: string) {
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
    const deadline = Date.now() + (this.opts.processWaitMs ?? 40_000)
    for (;;) {
      const r = await this.call<{ status_code?: string; status?: string }>('GET', `/${id}`, { fields: 'status_code,status' })
      const code = r?.status_code ?? 'FINISHED'
      if (code === 'FINISHED' || code === 'PUBLISHED') return
      if (code === 'ERROR' || code === 'EXPIRED') throw new MarketingProviderError('invalid', `Instagram could not process the media (${code}${r?.status ? `: ${r.status}` : ''})`.slice(0, 200))
      if (Date.now() > deadline) throw new MarketingProviderError('timeout', 'Instagram is still processing the media')
      await sleep(3_000)
    }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const media = (!input.media ? [] : Array.isArray(input.media) ? input.media : [input.media]).filter((m): m is MediaInput & { url: string } => !!m.url)
    if (!media.length) throw new MarketingProviderError('invalid', 'Instagram posts need media')
    const caption = input.text
    const video = media.find((m) => m.mimeType.startsWith('video/'))
    let creation: string
    if (video) {
      creation = await this.container({ media_type: 'REELS', video_url: video.url, caption, share_to_feed: 'true' })
    } else if (media.length === 1) {
      creation = await this.container({ image_url: media[0].url, caption, ...(media[0].altText ? { alt_text: media[0].altText.slice(0, 1000) } : {}) })
    } else {
      const children: string[] = []
      for (const m of media.slice(0, 10)) children.push(await this.container({ image_url: m.url, is_carousel_item: 'true', ...(m.altText ? { alt_text: m.altText.slice(0, 1000) } : {}) }))
      for (const c of children) await this.waitReady(c)
      creation = await this.container({ media_type: 'CAROUSEL', children: children.join(','), caption })
    }
    await this.waitReady(creation)
    // The only public step. A timeout here may still publish → unconfirmed (never auto-retried).
    const pub = await this.call<{ id?: string }>('POST', `/${this.opts.userId}/media_publish`, { creation_id: creation }, { sideEffect: true, timeoutMs: 60_000 })
    if (!pub?.id) throw new MarketingProviderError('unknown', 'Instagram returned no media id', undefined, true)
    const link = await this.call<{ permalink?: string }>('GET', `/${pub.id}`, { fields: 'permalink' }).catch(() => null)
    return { externalId: pub.id, url: link?.permalink ?? `https://www.instagram.com/`, mediaId: creation, mediaIds: [creation], threadIds: [], mediaError: null }
  }

  private async metricsFor(id: string): Promise<PlatformMetrics | null> {
    const base = await this.call<{ like_count?: number; comments_count?: number }>('GET', `/${id}`, { fields: 'like_count,comments_count' }).catch(() => null)
    if (!base) return null
    const ins = await this.call<{ data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>('GET', `/${id}/insights`, { metric: 'reach,views,saved,shares' }).catch(() => null)
    const v = (n: string) => {
      const m = ins?.data?.find((x) => x.name === n)
      const val = m?.values?.[0]?.value ?? m?.total_value?.value
      return typeof val === 'number' ? val : null
    }
    return { impressions: v('views') ?? v('reach'), likes: base.like_count ?? null, reposts: v('shares'), replies: base.comments_count ?? null, quotes: null, bookmarks: v('saved'), profileVisits: null, linkClicks: null }
  }

  async getMetrics(externalIds: string[]): Promise<Map<string, PlatformMetrics>> {
    const out = new Map<string, PlatformMetrics>()
    for (const id of externalIds.filter((x) => /^\d{5,25}$/.test(x)).slice(0, 50)) {
      const m = await this.metricsFor(id)
      if (m) out.set(id, m)
    }
    return out
  }

  async getOwnPosts(_userId: string, opts: { maxResults?: number } = {}): Promise<OwnPost[]> {
    const r = await this.call<{ data?: { id: string; caption?: string; timestamp?: string; like_count?: number; comments_count?: number }[] }>('GET', `/${this.opts.userId}/media`, { fields: 'id,caption,timestamp,like_count,comments_count', limit: String(Math.min(100, opts.maxResults ?? 50)) })
    return (r?.data ?? []).map((m) => ({ id: m.id, text: m.caption ?? '', createdAt: m.timestamp ?? null, metrics: { impressions: null, likes: m.like_count ?? null, reposts: null, replies: m.comments_count ?? null, quotes: null, bookmarks: null, profileVisits: null, linkClicks: null } }))
  }
}
