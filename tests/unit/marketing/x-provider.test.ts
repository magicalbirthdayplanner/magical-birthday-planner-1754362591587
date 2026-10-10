/** X provider: OAuth 1.0a signing and the v2 calls, against a mocked fetch. Nothing ever reaches the real X API. */
import { describe, expect, it, vi } from 'vitest'
import { oauth1Header, signatureBaseString } from '@/lib/marketing/providers/oauth1'
import { MarketingProviderError } from '@/lib/marketing/providers/types'
import { XMarketingProvider, xCredentialsFromEnv } from '@/lib/marketing/providers/x'

const CREDS = { consumerKey: 'ck-test-key', consumerSecret: 'cs-test-SECRET-value', token: 'tok-test-123', tokenSecret: 'ts-test-SECRET-value' }

describe('OAuth 1.0a', () => {
  it('reproduces the reference signature from the X/Twitter documentation', () => {
    const creds = { consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE' }
    const header = oauth1Header(creds, 'POST', 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true', {
      formParams: { status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
      nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
      timestamp: 1318622958,
    })
    expect(header).toContain('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"')
    expect(header.startsWith('OAuth ')).toBe(true)
  })
  it('signs query parameters, not JSON bodies; never includes secrets in the header', () => {
    const base = signatureBaseString('GET', 'https://api.x.com/2/tweets?ids=1,2&tweet.fields=public_metrics', { oauth_nonce: 'n' })
    expect(base).toContain('ids%3D1%252C2')
    const header = oauth1Header(CREDS, 'POST', 'https://api.x.com/2/tweets')
    expect(header).not.toContain(CREDS.consumerSecret)
    expect(header).not.toContain(CREDS.tokenSecret)
    expect(header).toContain('oauth_consumer_key="ck-test-key"')
  })
  it('reads credentials only when all four are present', () => {
    expect(xCredentialsFromEnv({ X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c' })).toBeNull()
    expect(xCredentialsFromEnv({ X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c', X_ACCESS_TOKEN_SECRET: 'd' })).toEqual({ consumerKey: 'a', consumerSecret: 'b', token: 'c', tokenSecret: 'd' })
  })
})

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}
function provider(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof XMarketingProvider>[0]> = {}) {
  return new XMarketingProvider({ credentials: CREDS, maxChars: 280, username: 'mbp_founder', baseUrl: 'https://x.test', fetchImpl, ...extra })
}

describe('XMarketingProvider', () => {
  it('uploads the image (JSON, base64, tweet_image), sets alt text, then posts with the media id', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! })
      if (String(url).endsWith('/2/media/upload')) return json(200, { data: { id: '1880000000000000001', media_key: '3_1' } })
      if (String(url).endsWith('/2/media/metadata')) return json(200, { data: {} })
      return json(201, { data: { id: '1880000000000000099', text: 'x' } })
    }) as unknown as typeof fetch
    const r = await provider(f).publish({ text: 'Hello parents', media: { bytes: new Uint8Array([137, 80, 78, 71]), mimeType: 'image/png', altText: 'A party hat' }, altText: true })
    expect(r).toEqual({ externalId: '1880000000000000099', url: 'https://x.com/mbp_founder/status/1880000000000000099', mediaId: '1880000000000000001', mediaIds: ['1880000000000000001'], threadIds: [], mediaError: null })
    const upload = JSON.parse(String(calls[0].init.body))
    expect(upload).toEqual({ media: Buffer.from([137, 80, 78, 71]).toString('base64'), media_category: 'tweet_image' })
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ text: 'Hello parents', media: { media_ids: ['1880000000000000001'] } })
    for (const c of calls) {
      const auth = String((c.init.headers as Record<string, string>).Authorization)
      expect(auth).toMatch(/^OAuth /)
      expect(auth).not.toContain(CREDS.consumerSecret)
    }
  })

  it('still posts the text when the image upload fails', async () => {
    const f = vi.fn(async (url: string | URL | Request) => (String(url).endsWith('/2/media/upload') ? json(400, { title: 'Invalid Request', detail: 'bad media' }) : json(201, { data: { id: '42' } }))) as unknown as typeof fetch
    const r = await provider(f).publish({ text: 'Hi', media: { bytes: new Uint8Array([1]), mimeType: 'image/png' } })
    expect(r.externalId).toBe('42')
    expect(r.mediaId).toBeNull()
    expect(r.mediaError).toMatch(/bad media/)
  })

  it('maps errors: auth, duplicate, rate limit, payment, timeout after sending (unconfirmed)', async () => {
    const once = (res: Response) => vi.fn(async () => res) as unknown as typeof fetch
    await expect(provider(once(json(401, { title: 'Unauthorized' }))).createPost({ text: 'a' })).rejects.toMatchObject({ kind: 'auth', unconfirmed: false })
    await expect(provider(once(json(403, { detail: 'You are not allowed to create a Tweet with duplicate content.' }))).createPost({ text: 'a' })).rejects.toMatchObject({ kind: 'duplicate' })
    await expect(provider(once(json(429, {}, { 'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 60) }))).createPost({ text: 'a' })).rejects.toMatchObject({ kind: 'rate_limited' })
    await expect(provider(once(json(402, { title: 'Payment Required' }))).createPost({ text: 'a' })).rejects.toMatchObject({ kind: 'payment_required' })
    await expect(provider(once(json(503, {}))).createPost({ text: 'a' })).rejects.toMatchObject({ kind: 'unavailable', unconfirmed: true })
    const hang = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch
    const err = await provider(hang, { timeoutMs: 20 }).createPost({ text: 'a' }).catch((e) => e)
    expect(err).toBeInstanceOf(MarketingProviderError)
    expect(err).toMatchObject({ kind: 'timeout', unconfirmed: true })
    expect(String(err.message)).not.toContain('SECRET')
  })

  it('refuses to call without credentials', async () => {
    const f = vi.fn() as unknown as typeof fetch
    const p = new XMarketingProvider({ credentials: null, maxChars: 280, fetchImpl: f })
    expect(p.configured()).toBe(false)
    await expect(p.createPost({ text: 'a' })).rejects.toMatchObject({ kind: 'not_configured' })
    expect(f).not.toHaveBeenCalled()
  })

  it('reads metrics (non-public when allowed, public fallback) and never invents missing ones', async () => {
    const urls: string[] = []
    const f = vi.fn(async (url: string | URL | Request) => {
      urls.push(String(url))
      if (String(url).includes('non_public_metrics')) return json(403, { title: 'Forbidden' })
      return json(200, { data: [{ id: '42', public_metrics: { like_count: 3, retweet_count: 1, reply_count: 2, quote_count: 0, bookmark_count: 1, impression_count: 250 } }] })
    }) as unknown as typeof fetch
    const m = await provider(f).getMetrics(['42', 'not-an-id'])
    expect(urls[0]).toContain('ids=42&')
    expect(m.get('42')).toEqual({ impressions: 250, likes: 3, reposts: 1, replies: 2, quotes: 0, bookmarks: 1, profileVisits: null, linkClicks: null })
  })

  it('verify() returns the handle and uses it for post URLs', async () => {
    const f = vi.fn(async () => json(200, { data: { id: '1', username: 'realhandle', name: 'Founder' } }, { 'x-access-level': 'read' })) as unknown as typeof fetch
    const p = provider(f, { username: null })
    expect(p.postUrl('9')).toBe('https://x.com/i/web/status/9')
    expect(await p.verify()).toEqual({ id: '1', username: 'realhandle', name: 'Founder', accessLevel: 'read' })
    expect(p.postUrl('9')).toBe('https://x.com/realhandle/status/9')
  })
})
