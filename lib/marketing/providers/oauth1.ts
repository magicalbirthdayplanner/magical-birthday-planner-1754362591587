/**
 * OAuth 1.0a request signing (HMAC-SHA1, RFC 5849) for X user-context calls. JSON and multipart bodies are not part of
 * the signature; query parameters (and form bodies, if ever used) are. SERVER ONLY — never log the header.
 */
import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'

export interface OAuth1Credentials { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string }

/** RFC 3986 percent-encoding (stricter than encodeURIComponent). */
export function pctEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function signatureBaseString(method: string, url: string, params: Record<string, string>): string {
  const u = new URL(url)
  const all: [string, string][] = [...u.searchParams.entries(), ...Object.entries(params)]
  const normalized = all
    .map(([k, v]) => [pctEncode(k), pctEncode(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const base = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`
  return [method.toUpperCase(), pctEncode(base), pctEncode(normalized)].join('&')
}

export function oauth1Header(
  creds: OAuth1Credentials,
  method: string,
  url: string,
  opts: { formParams?: Record<string, string>; nonce?: string; timestamp?: number } = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: opts.nonce ?? randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(opts.timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.token,
    oauth_version: '1.0',
  }
  const base = signatureBaseString(method, url, { ...oauth, ...(opts.formParams ?? {}) })
  const key = `${pctEncode(creds.consumerSecret)}&${pctEncode(creds.tokenSecret)}`
  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64')
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pctEncode(k)}="${pctEncode(oauth[k])}"`).join(', ')
}
