/**
 * Standard Webhooks verification (the scheme Dodo Payments uses):
 *   signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   key            = base64-decode(secret without "whsec_")
 *   signature      = base64(HMAC-SHA256(key, signed content))
 *   header         = space-separated "v1,<sig>" entries; any match passes
 * Constant-time comparison; timestamps outside ±tolerance are rejected (replay).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type VerifyFailure = 'missing_headers' | 'bad_timestamp' | 'stale_timestamp' | 'bad_signature' | 'no_secret'

export interface WebhookHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

function keyFrom(secret: string): Buffer {
  const s = secret.trim()
  return s.startsWith('whsec_') ? Buffer.from(s.slice('whsec_'.length), 'base64') : Buffer.from(s, 'utf8')
}

export function signWebhook(secret: string, id: string, timestamp: number | string, body: string): string {
  return `v1,${createHmac('sha256', keyFrom(secret)).update(`${id}.${timestamp}.${body}`).digest('base64')}`
}

export function verifyWebhook(
  secret: string | undefined,
  h: WebhookHeaders,
  rawBody: string,
  opts: { toleranceSeconds?: number; nowSeconds?: number } = {},
): { ok: true } | { ok: false; reason: VerifyFailure } {
  if (!secret) return { ok: false, reason: 'no_secret' }
  if (!h.id || !h.timestamp || !h.signature) return { ok: false, reason: 'missing_headers' }
  if (!/^\d{9,11}$/.test(h.timestamp)) return { ok: false, reason: 'bad_timestamp' }
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(h.timestamp)) > (opts.toleranceSeconds ?? 300)) return { ok: false, reason: 'stale_timestamp' }

  const expected = Buffer.from(signWebhook(secret, h.id, h.timestamp, rawBody).slice(3), 'base64')
  for (const part of h.signature.split(' ')) {
    const [version, sig] = part.split(',', 2)
    if (version !== 'v1' || !sig) continue
    let received: Buffer
    try {
      received = Buffer.from(sig, 'base64')
    } catch {
      continue
    }
    if (received.length === expected.length && timingSafeEqual(received, expected)) return { ok: true }
  }
  return { ok: false, reason: 'bad_signature' }
}
