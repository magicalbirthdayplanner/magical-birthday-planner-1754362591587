/**
 * Privacy scrubbing for everything sent to Sentry (errors, spans, logs, metrics, breadcrumbs).
 * Isomorphic and dependency-free so the same rules run in the browser and on Node.
 *
 * Rules: no query strings or URL fragments (Supabase puts access tokens in the fragment), no invite tokens in
 * paths, no emails / JWTs / bearer tokens / API keys / phone numbers in free text, no cookies, headers or bodies,
 * and no user fields beyond an opaque id.
 */

const SECRET_KEY = /pass(word)?|secret|token|auth|cookie|session|api[-_]?key|signature|dsn|card|cvv|email|phone|address|prompt|completion|notes?$/i

const PATTERNS: [RegExp, string][] = [
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, '[jwt]'], // Supabase access tokens, any JWT
  [/\bBearer\s+[\w.~+/-]{8,}=*/gi, 'Bearer [redacted]'],
  [/\b(sk|pk|rk|whsec|sntry[us]|sbp|re|AIza)[_-]?[A-Za-z0-9_-]{16,}/g, '[key]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/(?<![\w-])\+?\d[\d\s().-]{8,}\d(?![\w-])/g, '[number]'], // phone / card-like digit runs
]

/** Paths that carry a secret in the URL itself. */
const PATH_TOKENS: [RegExp, string][] = [
  [/\/invite\/[^/?#\s"']+/g, '/invite/[token]'],
]

/** Strip query + fragment from anything URL-like and redact token-bearing path segments. */
export function scrubUrl(url: string): string {
  let out = url
  for (const [re, rep] of PATH_TOKENS) out = out.replace(re, rep)
  return out.replace(/([^\s"'?#]*)[?#][^\s"']*/g, '$1')
}

export function scrubString(s: string, max = 1000): string {
  let out = s.length > max ? `${s.slice(0, max)}…` : s
  for (const [re, rep] of PATH_TOKENS) out = out.replace(re, rep)
  out = out.replace(/(https?:\/\/[^\s"'?#]+|\/[\w\-./[\]]*)[?#][^\s"']*/g, '$1') // query strings / fragments
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep)
  return out
}

/** Deep-scrub a JSON-ish value: sensitive keys dropped, strings scrubbed, depth/size capped. */
export function scrubValue(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return scrubString(v)
  if (v === null || typeof v !== 'object') return v
  if (depth > 6) return '[depth]'
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => scrubValue(x, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 100)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : scrubValue(val, depth + 1)
  }
  return out
}

type Mutable = Record<string, any>

/** beforeSend for error/message events. Never throws; on any problem the event is dropped rather than leaked. */
export function scrubEvent<E>(input: E): E | null {
  const event = input as Mutable
  try {
    if (event.request) {
      const r = event.request
      if (typeof r.url === 'string') r.url = scrubUrl(r.url)
      delete r.cookies
      delete r.headers
      delete r.data
      delete r.query_string
      delete r.env
    }
    if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined
    if (typeof event.message === 'string') event.message = scrubString(event.message)
    if (event.logentry?.message) event.logentry.message = scrubString(event.logentry.message)
    for (const ex of event.exception?.values ?? []) {
      if (typeof ex.value === 'string') ex.value = scrubString(ex.value)
      for (const f of ex.stacktrace?.frames ?? []) delete f.vars
    }
    if (Array.isArray(event.breadcrumbs)) event.breadcrumbs = event.breadcrumbs.map((x: unknown) => scrubBreadcrumb(x)).filter(Boolean)
    if (event.extra) event.extra = scrubValue(event.extra)
    if (event.contexts) {
      for (const key of Object.keys(event.contexts)) {
        if (key === 'trace' || key === 'os' || key === 'browser' || key === 'device' || key === 'runtime' || key === 'app' || key === 'culture' || key === 'cloud_resource' || key === 'response') continue
        event.contexts[key] = scrubValue(event.contexts[key])
      }
    }
    if (event.tags) event.tags = scrubValue(event.tags)
    if (event.transaction) event.transaction = scrubUrl(event.transaction)
    return input
  } catch {
    return null
  }
}

export function scrubBreadcrumb<B>(input: B): B | null {
  const b = input as Mutable
  try {
    // Console breadcrumbs can carry anything a developer logged; keep only the level + category.
    if (b.category === 'console') return null
    if (typeof b.message === 'string') b.message = scrubString(b.message, 300)
    if (b.data) {
      const d = { ...b.data }
      for (const k of ['url', 'from', 'to']) if (typeof d[k] === 'string') d[k] = scrubUrl(d[k])
      delete d.body
      delete d.request_body
      delete d.response_body
      b.data = scrubValue(d)
    }
    return input
  } catch {
    return null
  }
}

/** Scrub span / log / metric attribute maps (values may be raw or `{ value, type }`). */
export function scrubAttributes<A extends Mutable | undefined>(attrs: A): A {
  if (!attrs) return attrs
  for (const [k, raw] of Object.entries(attrs)) {
    if (/^(http\.request\.header|http\.response\.header|http\.request\.body|http\.response\.body|gen_ai\.(input|output|prompt|request\.messages|response\.text)|db\.query\.parameter|user\.(email|name|ip_address)|client\.address)/.test(k) || /cookie|authorization/i.test(k)) {
      delete attrs[k]
      continue
    }
    const isObj = raw !== null && typeof raw === 'object' && 'value' in raw
    const v = isObj ? raw.value : raw
    if (typeof v !== 'string') continue
    const clean = /url|target|route|path|referer|referrer|href|query/i.test(k) ? scrubString(scrubUrl(v)) : scrubString(v)
    if (isObj) raw.value = clean
    else (attrs as Mutable)[k] = clean
  }
  return attrs
}
