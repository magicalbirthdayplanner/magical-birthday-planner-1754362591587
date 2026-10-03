/**
 * Shared Sentry.init options for the browser and Node runtimes (the app has no edge code).
 * No DSN → Sentry is fully disabled (local dev, tests, E2E builds) and every telemetry call is a no-op.
 */
import type { BrowserOptions } from '@sentry/nextjs'
import { scrubAttributes, scrubBreadcrumb, scrubEvent, scrubString, scrubUrl } from './privacy'

type Runtime = 'client' | 'server'

/** Errors that are expected or not actionable (navigation control flow, flaky client networks, browser noise). */
const IGNORE_ERRORS = [
  'NEXT_REDIRECT',
  'NEXT_NOT_FOUND',
  'NEXT_HTTP_ERROR_FALLBACK',
  'ResizeObserver loop',
  'AbortError',
  'The operation was aborted',
  'Failed to fetch',
  'Load failed',
  'NetworkError when attempting to fetch resource',
  'Network request failed',
  'ChunkLoadError',
]

/** Trace every AI, billing and discovery request (low volume, high value); sample the rest; skip pure noise. */
function sampleRate(name: string, runtime: Runtime): number {
  if (/\/api\/health|\/api\/discovery\/(photo|zip)|\/_next\/|\/sw\.js|\/manifest|\/favicon|\/icons\//.test(name)) return 0
  if (/\/api\/(ai|billing|webhooks|discovery|invite|invitations)\b/.test(name)) return 1
  return runtime === 'client' ? 0.25 : 0.5
}

// Typed loosely on purpose: browser and Node option types differ slightly; every key below exists in both.
export function sentryOptions(runtime: Runtime, dsn: string | undefined): BrowserOptions {
  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    // Privacy: collect no user info, cookies, headers, bodies, query strings, AI inputs/outputs or local variables.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
    },
    tracesSampler: ({ name, inheritOrSampleWith }) => inheritOrSampleWith(sampleRate(name ?? '', runtime)),
    ignoreErrors: IGNORE_ERRORS,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
    beforeSendSpan: (span) => {
      try {
        span.name = scrubString(scrubUrl(span.name))
        scrubAttributes(span.attributes as Record<string, unknown>)
      } catch {
        /* keep the span; attributes are best-effort */
      }
      return span
    },
    beforeSendLog: (log) => {
      try {
        if (typeof log.message === 'string') log.message = scrubString(log.message)
        scrubAttributes(log.attributes)
        return log
      } catch {
        return null
      }
    },
    beforeSendMetric: (metric) => {
      try {
        scrubAttributes(metric.attributes)
        return metric
      } catch {
        return null
      }
    },
  }
}
