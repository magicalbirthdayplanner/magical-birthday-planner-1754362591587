/**
 * Lenient-in, strict-out zod pieces for possibly-weak models: number strings are coerced ("$25" → 25) and
 * clamped, long strings/arrays are trimmed instead of rejected, unknown keys are dropped by z.object().
 */
import { z } from 'zod'

export const num = (min: number, max: number, fallback?: number) =>
  z.preprocess((v) => {
    if (typeof v === 'string') {
      const m = v.replace(/[$,\s]/g, '').match(/^-?\d+(\.\d+)?/)
      v = m ? Number(m[0]) : v
    }
    if (v == null && fallback != null) return fallback
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : v
  }, z.number())

export const str = (max: number, min = 1) => z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().trim().min(min).transform((s) => s.slice(0, max)))
export const optStr = (max: number) => z.preprocess((v) => (v == null ? '' : typeof v === 'number' ? String(v) : v), z.string().trim().transform((s) => s.slice(0, max)))
export const list = <T extends z.ZodTypeAny>(item: T, max: number, min = 0) =>
  z.preprocess((v) => (v == null ? [] : v), z.array(z.unknown()).transform((a) => a.slice(0, max * 2))).pipe(
    z.array(z.unknown()).transform((a, ctx) => {
      const out: z.infer<T>[] = []
      for (const x of a) {
        const r = item.safeParse(x)
        if (r.success) out.push(r.data)
        if (out.length >= max) break
      }
      if (out.length < min) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `needs at least ${min} valid items` })
      return out
    }),
  )
export const strList = (maxItems: number, maxLen: number) => list(str(maxLen), maxItems)
export const pick = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess((v) => (typeof v === 'string' && (values as readonly string[]).includes(v.toLowerCase()) ? v.toLowerCase() : fallback), z.enum(values))

export const SHOPPING_CATEGORIES = ['food', 'decorations', 'activities', 'favors', 'other'] as const
export const shoppingCategory = z.preprocess((v) => {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (/food|snack|drink|cake|dessert|grocer|bever/.test(s)) return 'food'
  if (/decor|balloon|banner|table|tableware|plate|napkin/.test(s)) return 'decorations'
  if (/activit|craft|game|art|supplies|material/.test(s)) return 'activities'
  if (/favor|favour|goodie|gift|prize/.test(s)) return 'favors'
  return 'other'
}, z.enum(SHOPPING_CATEGORIES))
