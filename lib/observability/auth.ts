/**
 * Authentication observability (browser + callback route). Sends the flow, Supabase's error code and HTTP status
 * only — never the email, password, tokens, magic/reset links or the raw error message.
 *
 * Expected failures (wrong password, unconfirmed email, rate limits, weak password, offline) are low-noise
 * metrics. Only server-side failures (5xx / unknown) become Sentry issues.
 */
import { reportError, track } from './telemetry'

export type AuthFlow = 'login' | 'signup' | 'password_reset' | 'password_update' | 'google' | 'callback' | 'session'

const EVENT: Record<AuthFlow, string> = {
  login: 'AUTH_LOGIN_FAILED',
  signup: 'AUTH_SIGNUP_FAILED',
  password_reset: 'AUTH_PASSWORD_RESET_FAILED',
  password_update: 'AUTH_PASSWORD_RESET_FAILED',
  google: 'AUTH_GOOGLE_SIGNIN_FAILED',
  callback: 'AUTH_CALLBACK_FAILED',
  session: 'AUTH_SESSION_ERROR',
}

const SAFE_CODE = /^[a-z0-9_]{1,48}$/

export function classifyAuthError(error: unknown): { code: string; status: number | null; category: 'expected' | 'network' | 'system' } {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; name?: unknown }
  const code = typeof e.code === 'string' && SAFE_CODE.test(e.code) ? e.code : 'unknown'
  const status = typeof e.status === 'number' ? e.status : null
  const name = typeof e.name === 'string' ? e.name : ''
  if (name === 'AuthRetryableFetchError' || name === 'TypeError' || status === 0) return { code, status, category: 'network' }
  if (status !== null && status >= 400 && status < 500) return { code, status, category: 'expected' }
  return { code, status, category: 'system' }
}

export function authFailed(flow: AuthFlow, error: unknown) {
  try {
    const { code, status, category } = classifyAuthError(error)
    const step = flow === 'password_update' ? 'update' : flow === 'password_reset' ? 'request' : undefined
    track(EVENT[flow], { flow, code, status: status ?? 'none', category, step }, undefined, category === 'system' ? 'warn' : 'info')
    if (category === 'system') {
      reportError(`Auth ${flow} failed (${code})`, { area: 'auth', op: `auth_${flow}`, tags: { flow, code, status: status ?? 'none' }, fingerprint: ['auth', flow, code] })
    }
  } catch {
    /* ignore */
  }
}

/** /auth/callback returned `error`/`error_code` from Supabase (e.g. an expired link). */
export function authCallbackFailed(errorCode: string | null) {
  const code = errorCode && SAFE_CODE.test(errorCode) ? errorCode : 'unknown'
  const system = /server_error|unexpected_failure|temporarily_unavailable|unknown/.test(code)
  track('AUTH_CALLBACK_FAILED', { flow: 'callback', code, category: system ? 'system' : 'expected' }, undefined, system ? 'warn' : 'info')
  if (system) reportError(`Auth callback failed (${code})`, { area: 'auth', op: 'auth_callback', tags: { code }, fingerprint: ['auth', 'callback', code] })
}
