/**
 * In-memory stand-in for @sentry/nextjs. Use in a test file:
 *   vi.mock('@sentry/nextjs', async () => (await import('../helpers/sentry-mock')).sentryMock)
 * Every call is recorded in `sentry` so tests can assert what would have been sent (and what wasn't).
 */
export interface Captured {
  kind: 'exception' | 'message'
  value: unknown
  level?: string
  tags: Record<string, string>
  fingerprint?: string[]
}
export const sentry = {
  metrics: [] as { type: 'count' | 'distribution'; name: string; value: number; attributes: Record<string, unknown> }[],
  logs: [] as { level: string; message: string; attributes: Record<string, unknown> }[],
  captured: [] as Captured[],
  spans: [] as { name: string; op?: string; attributes: Record<string, unknown>; status?: string }[],
  /** Make every Sentry call throw (simulates a broken SDK / outage). */
  explode: false,
  reset() {
    this.metrics.length = 0
    this.logs.length = 0
    this.captured.length = 0
    this.spans.length = 0
    this.explode = false
  },
  /** Everything that would leave the process, serialised (for "never contains X" assertions). */
  dump() {
    return JSON.stringify({ metrics: this.metrics, logs: this.logs, captured: this.captured.map((c) => ({ ...c, value: c.value instanceof Error ? `${c.value.name}: ${c.value.message}` : c.value })), spans: this.spans })
  },
  names() {
    return this.metrics.filter((m) => m.type === 'count').map((m) => m.name)
  },
}

const boom = () => {
  if (sentry.explode) throw new Error('sentry exploded')
}

let scope: { level?: string; tags: Record<string, string>; fingerprint?: string[] } = { tags: {} }
const log = (level: string) => (message: string, attributes: Record<string, unknown> = {}) => {
  boom()
  sentry.logs.push({ level, message, attributes })
}

export const sentryMock = {
  metrics: {
    count: (name: string, value = 1, o: { attributes?: Record<string, unknown> } = {}) => {
      boom()
      sentry.metrics.push({ type: 'count', name, value, attributes: o.attributes ?? {} })
    },
    distribution: (name: string, value: number, o: { attributes?: Record<string, unknown> } = {}) => {
      boom()
      sentry.metrics.push({ type: 'distribution', name, value, attributes: o.attributes ?? {} })
    },
    gauge: () => undefined,
  },
  logger: { info: log('info'), warn: log('warn'), error: log('error'), debug: log('debug'), trace: log('trace'), fatal: log('fatal') },
  withScope: (cb: (s: unknown) => void) => {
    boom()
    scope = { tags: {} }
    cb({
      setLevel: (l: string) => (scope.level = l),
      setTag: (k: string, v: string) => (scope.tags[k] = v),
      setFingerprint: (f: string[]) => (scope.fingerprint = f),
    })
  },
  captureException: (value: unknown) => {
    boom()
    sentry.captured.push({ kind: 'exception', value, level: scope.level, tags: { ...scope.tags }, fingerprint: scope.fingerprint })
  },
  captureMessage: (value: unknown) => {
    boom()
    sentry.captured.push({ kind: 'message', value, level: scope.level, tags: { ...scope.tags }, fingerprint: scope.fingerprint })
  },
  startSpan: async (o: { name: string; op?: string; attributes?: Record<string, unknown> }, fn: (span: unknown) => unknown) => {
    boom()
    const rec: { name: string; op?: string; attributes: Record<string, unknown>; status?: string } = { name: o.name, op: o.op, attributes: { ...(o.attributes ?? {}) } }
    sentry.spans.push(rec)
    return fn({ setAttributes: (a: Record<string, unknown>) => Object.assign(rec.attributes, a), setStatus: (s: { message?: string }) => (rec.status = s.message ?? 'error') })
  },
  captureRequestError: () => undefined,
  captureRouterTransitionStart: () => undefined,
  init: () => undefined,
}
