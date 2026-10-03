/**
 * The app's only telemetry API (Sentry underneath). Isomorphic: browser and Node.
 *
 * Fail-safe by construction: every function swallows its own errors and never awaits the network, so a Sentry
 * outage, a missing DSN or a bad attribute can never change what the user sees.
 *
 * - `track(name, dims, ctx)`   → a counter metric (low-cardinality `dims` only) + a structured log (`dims` + `ctx`).
 * - `timing(name, ms, dims)`   → a distribution metric in milliseconds.
 * - `reportError(err, opts)`   → a Sentry issue. Only for unexpected failures; expected outcomes (401/403/404,
 *                               validation, rate limits, wrong password) are `track()`ed, never reported.
 */
import * as Sentry from '@sentry/nextjs'
import { scrubString } from './privacy'

export type Area = 'ai' | 'billing' | 'auth' | 'google' | 'db' | 'api' | 'client'
/** Metric dimensions: keep them low-cardinality (feature, plan, provider, status…). Never ids or user data. */
export type Dims = Record<string, string | number | boolean | null | undefined>

function clean(d: Dims | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!d) return out
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === null) continue
    out[k] = typeof v === 'string' ? scrubString(v, 120) : v
  }
  return out
}

export function track(name: string, dims?: Dims, ctx?: Dims, level: 'info' | 'warn' = 'info') {
  try {
    const attributes = clean(dims)
    Sentry.metrics.count(name, 1, { attributes })
    Sentry.logger[level](name, { ...attributes, ...clean(ctx), event: name })
  } catch {
    /* telemetry must never break the app */
  }
}

export function timing(name: string, ms: number, dims?: Dims) {
  try {
    if (!Number.isFinite(ms) || ms < 0) return
    Sentry.metrics.distribution(name, Math.round(ms), { unit: 'millisecond', attributes: clean(dims) })
  } catch {
    /* ignore */
  }
}

export function distribution(name: string, value: number, dims?: Dims, unit?: 'none' | 'byte') {
  try {
    if (!Number.isFinite(value)) return
    Sentry.metrics.distribution(name, value, { unit, attributes: clean(dims) })
  } catch {
    /* ignore */
  }
}

export interface ReportOptions {
  area: Area
  /** What was being done, e.g. 'webhook_processing'. Becomes a tag. */
  op: string
  level?: 'fatal' | 'error' | 'warning'
  /** Low-cardinality tags (feature, plan, kind, status…). */
  tags?: Dims
  /** Groups repeated failures into one issue. Defaults to Sentry's stack-based grouping. */
  fingerprint?: string[]
}

/** Report an unexpected failure. `err` may be an Error or a short, static message (never user content). */
export function reportError(err: unknown, opts: ReportOptions) {
  try {
    Sentry.withScope((scope) => {
      scope.setLevel(opts.level ?? 'error')
      scope.setTag('area', opts.area)
      scope.setTag('op', opts.op)
      for (const [k, v] of Object.entries(clean(opts.tags))) scope.setTag(k, String(v))
      if (opts.fingerprint) scope.setFingerprint(opts.fingerprint)
      if (err instanceof Error) Sentry.captureException(err)
      else Sentry.captureMessage(scrubString(String(err), 200))
    })
  } catch {
    /* ignore */
  }
}

/** Run `fn` inside a Sentry span. If Sentry itself fails, `fn` still runs exactly once. */
export async function withSpan<T>(opts: { name: string; op: string; attributes?: Dims }, fn: () => Promise<T>, after?: (setAttrs: (a: Dims) => void, result: T, markFailed: (reason: string) => void) => void): Promise<T> {
  let started = false
  try {
    return await Sentry.startSpan({ name: opts.name, op: opts.op, attributes: clean(opts.attributes) }, async (span) => {
      started = true
      const result = await fn()
      try {
        after?.((a) => span.setAttributes(clean(a)), result, (reason) => span.setStatus({ code: 2, message: reason })) // 2 = error
      } catch {
        /* ignore */
      }
      return result
    })
  } catch (err) {
    if (started) throw err // fn itself threw: propagate unchanged
    return fn()
  }
}

/** Short, non-reversible id for correlating one party's events without sending the party id. */
export function safeId(id: string | null | undefined): string | undefined {
  if (!id) return undefined
  // Two FNV-1a 32-bit passes (sync, isomorphic). Correlation only; not a security boundary (party ids are random UUIDs).
  const fnv = (seed: number) => {
    let h = seed
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
    return (h >>> 0).toString(16).padStart(8, '0')
  }
  return fnv(0x811c9dc5) + fnv(0x050c5d1f)
}

/**
 * An unexpected database failure that materially affects the user (party/guest creation, RSVP, usage recording…).
 * Only the operation and the Postgres/PostgREST error code are sent: messages and `details` can echo row values.
 */
export function reportDbError(op: string, error: { code?: string } | null | undefined) {
  const code = typeof error?.code === 'string' ? error.code.slice(0, 16) : 'unknown'
  track('DB_ERROR', { op, code }, undefined, 'warn')
  reportError(`Database error: ${op}`, { area: 'db', op, tags: { code }, fingerprint: ['db', op, code] })
}
