/**
 * Diagnostic, one-off "fix", and test routes that shipped to production.
 * Several of them run with the Supabase service-role key and no caller
 * verification (account takeover via bypass-oauth-session, RLS rewrites,
 * env disclosure). They are blocked by middleware unless explicitly enabled
 * for local development with ENABLE_DEBUG_ROUTES=true (never in production).
 *
 * See docs/SECURITY.md before re-enabling or deleting any of these.
 */
export const DEBUG_API_ROUTES = [
  'apply-auth-fix',
  'auth-status',
  'auto-fix-oauth',
  'automated-supabase-fix',
  'bypass-oauth-session',
  'check-redirect',
  'check-supabase-config',
  'database-diagnosis',
  'db-ping',
  'db-structure',
  'db-test',
  'debug',
  'debug-auth',
  'diagnose-user',
  'env-test',
  'fix-database-admin',
  'fix-google-auth',
  'fix-google-profile',
  'fix-profile-permissions',
  'fix-rls-policies',
  'fix-schema-mismatch',
  'fix-site-url-config',
  'force-session-fix',
  'force-welcome',
  'manual-user-test',
  'oauth-advanced-debug',
  'oauth-callback-workaround',
  'oauth-fix',
  'oauth-redirect-diagnosis',
  'session-debug',
  'setup-profiles-table',
  'simple-oauth-fix',
  'supabase-fix',
  'test-activities',
  'test-auth-complete',
  'test-resend',
  'test-welcome',
] as const

/**
 * Unused, unauthenticated routes that call paid Google APIs and return the
 * API key inside photo URLs. Superseded by /api/discovery/*.
 */
export const DEPRECATED_API_ROUTES = ['venues', 'venues-local'] as const

/** Debug pages that dump configuration. */
export const DEBUG_PAGES = ['/env-check', '/test-oauth'] as const

const blockedApi = new Set<string>([...DEBUG_API_ROUTES, ...DEPRECATED_API_ROUTES])

export function debugRoutesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ENABLE_DEBUG_ROUTES === 'true' && env.NODE_ENV !== 'production'
}

/** True when the pathname must be hidden (404) in the current environment. */
export function isBlockedPath(pathname: string, env: Record<string, string | undefined> = process.env): boolean {
  if (debugRoutesEnabled(env)) return false
  if (DEBUG_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  if (!pathname.startsWith('/api/')) return false
  const segment = pathname.slice('/api/'.length).split('/')[0]
  return blockedApi.has(segment)
}
