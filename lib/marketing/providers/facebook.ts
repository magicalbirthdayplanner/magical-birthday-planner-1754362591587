/**
 * Facebook Page provider — Graph API (v26.0) with a Page access token (FB_PAGE_ACCESS_TOKEN, derived from the owner's
 * long-lived user token; Page tokens obtained that way don't expire).
 *   POST /{page-id}/feed       text / link post, or several photos via attached_media
 *   POST /{page-id}/photos     one photo (url = short-lived signed URL; published=false to attach to a feed post)
 *   POST graph-video…/{page-id}/videos   video (file_url)
 *   GET  /{post-id}?fields=…   reactions, comments, shares; /insights for impressions/clicks (read_insights)
 *   GET  /{page-id}/posts      own posts (history import)
 * Links in Facebook posts are clickable (and free), so link posts carry the UTM link. Polls aren't available through
 * the API: poll slots are published as questions. Meta doesn't bill these calls. The token is sent only as a request
 * parameter and never logged, stored or returned. SERVER ONLY.
 */
import 'server-only'
import type { XMeter } from '../budget'
import type { PlatformMetrics, PollSpec } from '../types'
import { MarketingProviderError, type AccountInfo, type MarketingProvider, type MediaInput, type OwnPost, type PublishInput, type PublishResult } from './types'

export interface FacebookProviderOptions {
  token: string | null
  pageId: string | null
  baseUrl?: string
  videoBaseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

type Problem = { error?: { message?: string; code?: number; type?: string } }

export function facebookFromEnv(env: Record<string, string | undefined> = process.env) {
  return { token: env.FB_PAGE_ACCESS_TOKEN?.trim() || null, pageId: /^\d{5,25}$/.test(env.FB_PAGE_ID?.trim() ?? '') ? env.FB_PAGE_ID!.trim() : null }
}

export class FacebookProvider implements MarketingProvider {
  readonly platform = 'facebook' as const
  readonly mediaByUrl = true
  readonly maxChars = 5000
  private base: string
  private videoBase: string
  private f: typeof fetch

  constructor(private opts: FacebookProviderOptions) {
    this.base = (opts.baseUrl ?? 'https://graph.facebook.com/v26.0').replace(/\/+$/, '')
    this.videoBase = (opts.videoBaseUrl ?? 'https://graph-video.facebook.com/v26.0').replace(/\/+$/, '')
    this.f = opts.fetchImpl ?? fetch
  }

  configured() {
    return !!(this.opts.token && this.opts.pageId)
  }

  setMeter(_meter: XMeter | null) {
    /* Meta does not bill these calls */
  }

  private async call<T>(method: 'GET' | 'POST', path: string, params: Record<string, string> = {}, opts: { sideEffect?: boolean; timeoutMs?: number; base?: string } = {}): Promise<T> {
    if (!this.configured()) throw new MarketingProviderError('not_configured', 'Facebook is not configured (FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN)')
    const qs = new URLSearchParams({ ...params, access_token: this.opts.token! })
    const base = opts.base ?? this.base
    const url = method === 'GET' ? `${base}${path}${path.includes('?') ? '&' : '?'}${qs}` : `${base}${path}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.min(opts.timeoutMs ?? 30_000, this.opts.timeoutMs ?? Infinity))
    let res: Response
    try {
      res = await this.f(url, { method, signal: ctrl.signal, headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined, body: method === 'POST' ? qs.toString() : undefined, cache: 'no-store' })
    } catch {
      const timedOut = ctrl.signal.aborted
      throw new MarketingProviderError(timedOut ? 'timeout' : 'unavailable', timedOut ? 'Facebook request timed out' : 'Facebook network error', undefined, !!opts.sideEffect)
    } finally {
      clearTimeout(timer)
    }
    const body = (await res.json().catch(() => null)) as (T & Problem) | null
    if (!res.ok || body?.error) {
      const e = body?.error ?? {}
      const msg = (e.message ?? `HTTP ${res.status}`).replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 200)
      const s = res.status
      if (e.code === 190 || s === 401) throw new MarketingProviderError('auth', `Facebook rejected the token: ${msg}`, s)
      if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 368 || e.code === 613 || s === 429) throw new MarketingProviderError('rate_limited', `Facebook rate limit: ${msg}`, s)
      if (e.code === 506) throw new MarketingProviderError('duplicate', `Facebook refused a duplicate post: ${msg}`, s)
      if (e.code === 10 || e.code === 200 || s === 403) throw new MarketingProviderError('forbidden', `Facebook refused: ${msg}`, s)
      if (s >= 500) throw new MarketingProviderError('unavailable', `Facebook is unavailable (${s})`, s, !!opts.sideEffect)
      throw new MarketingProviderError('invalid', `Facebook rejected the request: ${msg}`, s)
    }
    return body as T
  }

  async verify(): Promise<AccountInfo> {
    const r = await this.call<{ id?: string; name?: string; username?: string }>('GET', `/${this.opts.pageId}`, { fields: 'id,name,username' })
    if (!r?.id) throw new MarketingProviderError('unknown', 'Facebook returned no Page')
    return { id: r.id, username: r.username ?? r.name ?? r.id, name: r.name ?? null, accessLevel: 'page' }
  }

  async uploadImage(): Promise<string> {
    throw new MarketingProviderError('invalid', 'Facebook pulls media from URLs (use publish with media URLs)')
  }

  async uploadVideo(): Promise<string> {
    throw new MarketingProviderError('invalid', 'Facebook pulls media from URLs (use publish with media URLs)')
  }

  async createPost(input: { text: string; mediaIds?: string[]; poll?: PollSpec | null; replyTo?: string | null }): Promise<{ externalId: string; url: string }> {
    const r = await this.call<{ id?: string }>('POST', `/${this.opts.pageId}/feed`, { message: input.text }, { sideEffect: true })
    if (!r?.id) throw new MarketingProviderError('unknown', 'Facebook returned no post id', undefined, true)
    return { externalId: r.id, url: `https://www.facebook.com/${r.id}` }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const media = (!input.media ? [] : Array.isArray(input.media) ? input.media : [input.media]).filter((m): m is MediaInput & { url: string } => !!m.url)
    // Polls aren't available through the Graph API: the question is posted as text (the options as a short list).
    const text = input.poll ? `${input.text}\n\n${input.poll.options.map((o) => `• ${o}`).join('\n')}` : input.text
    const video = media.find((m) => m.mimeType.startsWith('video/'))
    let id: string | undefined
    if (video) {
      const r = await this.call<{ id?: string }>('POST', `/${this.opts.pageId}/videos`, { file_url: video.url, description: text }, { sideEffect: true, timeoutMs: 120_000, base: this.videoBase })
      id = r?.id
    } else if (media.length === 1) {
      const r = await this.call<{ id?: string; post_id?: string }>('POST', `/${this.opts.pageId}/photos`, { url: media[0].url, caption: text, ...(media[0].altText ? { alt_text_custom: media[0].altText.slice(0, 1000) } : {}) }, { sideEffect: true, timeoutMs: 60_000 })
      id = r?.post_id ?? r?.id
    } else if (media.length > 1) {
      const photos: string[] = []
      for (const m of media.slice(0, 10)) {
        const r = await this.call<{ id?: string }>('POST', `/${this.opts.pageId}/photos`, { url: m.url, published: 'false', ...(m.altText ? { alt_text_custom: m.altText.slice(0, 1000) } : {}) }, { timeoutMs: 60_000 })
        if (r?.id) photos.push(r.id)
      }
      const params: Record<string, string> = { message: text }
      photos.forEach((p, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: p })))
      const r = await this.call<{ id?: string }>('POST', `/${this.opts.pageId}/feed`, params, { sideEffect: true })
      id = r?.id
    } else {
      const r = await this.call<{ id?: string }>('POST', `/${this.opts.pageId}/feed`, { message: text }, { sideEffect: true })
      id = r?.id
    }
    if (!id) throw new MarketingProviderError('unknown', 'Facebook returned no post id', undefined, true)
    return { externalId: id, url: `https://www.facebook.com/${id}`, mediaId: null, mediaIds: [], threadIds: [], mediaError: null }
  }

  async getMetrics(externalIds: string[]): Promise<Map<string, PlatformMetrics>> {
    const out = new Map<string, PlatformMetrics>()
    for (const id of externalIds.filter((x) => /^[\d_]{5,60}$/.test(x)).slice(0, 50)) {
      const base = await this.call<{ reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } }>('GET', `/${id}`, { fields: 'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares' }).catch(() => null)
      if (!base) continue
      const ins = await this.call<{ data?: { name: string; values?: { value: number }[] }[] }>('GET', `/${id}/insights`, { metric: 'post_impressions,post_clicks' }).catch(() => null)
      const v = (n: string) => {
        const val = ins?.data?.find((x) => x.name === n)?.values?.[0]?.value
        return typeof val === 'number' ? val : null
      }
      out.set(id, { impressions: v('post_impressions'), likes: base.reactions?.summary?.total_count ?? null, reposts: base.shares?.count ?? 0, replies: base.comments?.summary?.total_count ?? null, quotes: null, bookmarks: null, profileVisits: null, linkClicks: v('post_clicks') })
    }
    return out
  }

  async getOwnPosts(_userId: string, opts: { maxResults?: number } = {}): Promise<OwnPost[]> {
    const r = await this.call<{ data?: { id: string; message?: string; created_time?: string }[] }>('GET', `/${this.opts.pageId}/posts`, { fields: 'id,message,created_time', limit: String(Math.min(100, opts.maxResults ?? 100)) })
    return (r?.data ?? []).map((p) => ({ id: p.id, text: p.message ?? '', createdAt: p.created_time ?? null, metrics: { impressions: null, likes: null, reposts: null, replies: null, quotes: null, bookmarks: null, profileVisits: null, linkClicks: null } }))
  }
}
