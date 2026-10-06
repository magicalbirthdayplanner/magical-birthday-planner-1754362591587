/**
 * Launch waitlist observability. Dimensions are low-cardinality attribution tags only — never the email address
 * or the first name. Every outcome is a Sentry metric + log (track) and a first-party analytics event; only
 * unexpected failures become Sentry issues.
 */
import 'server-only'
import { trackServer } from '@/lib/analytics/server'
import { reportError, track, type Dims } from './telemetry'

export type WaitlistOutcome = 'waitlist_signup_success' | 'waitlist_signup_duplicate' | 'waitlist_signup_validation_error' | 'waitlist_signup_server_error'

export function waitlistEvent(outcome: WaitlistOutcome, dims: Dims = {}) {
  const level = outcome === 'waitlist_signup_server_error' ? 'warn' : 'info'
  track(outcome, dims, undefined, level)
  trackServer(outcome, Object.fromEntries(Object.entries(dims).filter(([, v]) => v !== undefined && v !== null)), { path: '/api/waitlist' })
}

/** An unexpected failure saving a sign-up. `code` is a static code (Postgres code or our own), never user input. */
export function waitlistFailed(code: string, dims: Dims = {}, err?: unknown) {
  waitlistEvent('waitlist_signup_server_error', { ...dims, code })
  reportError(err instanceof Error ? err : `Waitlist signup failed: ${code}`, { area: 'db', op: 'waitlist_signup', tags: { code }, fingerprint: ['waitlist-signup', code] })
}
