/**
 * Launch waitlist: request validation and campaign attribution. Isomorphic (the form and /api/waitlist share it).
 */
import { z } from 'zod'

/** Lower-cased and trimmed: one person = one row, whatever capitalisation they type. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Attribution values are short slugs (`instagram`, `prelaunch_oct13`, `d07_story`); anything else is dropped. */
export function cleanTag(v: unknown, max = 80): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().toLowerCase().slice(0, max)
  return /^[a-z0-9][a-z0-9._-]*$/.test(s) ? s : undefined
}

export const ATTRIBUTION_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const
export type Attribution = Partial<Record<(typeof ATTRIBUTION_PARAMS)[number] | 'source', string>>

/** Attribution from a landing URL's query string (+ the referrer host when no explicit source is given). */
export function attributionFrom(search: string, referrer?: string): Attribution {
  const q = new URLSearchParams(search)
  const out: Attribution = {}
  for (const k of ATTRIBUTION_PARAMS) {
    const v = cleanTag(q.get(k), k === 'utm_content' ? 120 : 80)
    if (v) out[k] = v
  }
  let source = cleanTag(q.get('source') ?? q.get('ref'))
  if (!source && referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '')
      if (host && !/magicalbirthdayplanner\.app$|localhost$|127\.0\.0\.1$/.test(host)) source = cleanTag(host)
    } catch {
      /* not a URL */
    }
  }
  if (source) out.source = source
  return out
}

const tag = (max: number) => z.unknown().transform((v) => cleanTag(v, max))

export const WaitlistRequest = z.object({
  email: z.string().trim().min(3).max(254).email().transform(normalizeEmail),
  firstName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v.replace(/[\u0000-\u001f<>]/g, '').trim() || undefined : undefined)),
  /** Honeypot: hidden from people, filled in by naive bots. */
  website: z.string().max(200).optional(),
  /** Which form on the page (hero | footer); analytics only. */
  form: tag(20).optional(),
  source: tag(80).optional(),
  utm_source: tag(80).optional(),
  utm_medium: tag(80).optional(),
  utm_campaign: tag(80).optional(),
  utm_content: tag(120).optional(),
})
export type WaitlistRequest = z.infer<typeof WaitlistRequest>
