import 'server-only'
import { NextResponse } from 'next/server'

/**
 * JSON responses for legacy route handlers that used to echo database errors,
 * stack traces and debug blocks. Strips internal fields and replaces internal
 * error text with user-safe copy. (New routes use lib/server/http.ts apiError.)
 */
const INTERNAL_KEYS = new Set(['debug', 'details', 'hint', 'stack', 'authError', 'sql', 'query', 'trace'])
const INTERNAL_TEXT = /(database error|pgrst|postgres|violates|relation "|column "|syntax error|jwt|duplicate key|permission denied|row-level security|supabase|stack|at \/|node_modules|\.ts:\d+)/i
const GENERIC_5XX = 'Something went wrong. Please try again.'
const GENERIC_4XX = 'The request could not be completed.'

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (INTERNAL_KEYS.has(k)) continue
    out[k] = scrub(v, depth + 1)
  }
  return out
}

export function sanitizeBody(body: unknown, status = 200): unknown {
  const out = scrub(body)
  if (!out || typeof out !== 'object' || Array.isArray(out)) return out
  const o = out as Record<string, unknown>
  for (const key of ['error', 'message'] as const) {
    if (typeof o[key] !== 'string') continue
    if (status >= 500 && key === 'error') o[key] = GENERIC_5XX
    else if (INTERNAL_TEXT.test(o[key] as string)) o[key] = status >= 500 ? GENERIC_5XX : GENERIC_4XX
  }
  return o
}

export function safeJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(sanitizeBody(body, init?.status ?? 200), init)
}
