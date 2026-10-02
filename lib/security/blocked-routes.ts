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
 * Unused legacy routes with security problems (no live caller in the UI):
 * paid API calls without auth, client-supplied user ids, billing writes,
 * error/stack leakage, account enumeration. Superseded or dead.
 * Entries may contain a sub-path (e.g. 'party/create'); matching is per segment.
 */
export const DEPRECATED_API_ROUTES = [
  'venues', // unauthenticated Google calls; API key in photo URLs
  'venues-local', // unauthenticated Google calls; random distances
  'subscriptions', // create/cancel trust client-supplied userId (billing manipulation)
  'activity-expansion', // Azure OpenAI with optional auth
  'budget-allocation', // Azure OpenAI without auth
  'n8n', // unauthenticated webhook sink
  'emails', // password-reset enumerates accounts; invitations sends email (dead UI)
  'party/create', // leaks stack traces and DB errors
  'party/get', // leaks stack traces and DB errors
  'party/update', // leaks stack traces and DB errors
  'party/guests', // leaks DB errors; creates invitations without tokens
  'party-data', // unused autosave, leaks DB errors
  'custom-themes', // unused (always 401)
  'theme-favorites', // unused; writes as anon
  'birthday-activities', // unused
  'host-mode-expand', // unused
] as const

/** Debug pages that dump configuration. */
export const DEBUG_PAGES = ['/env-check', '/test-oauth'] as const

const blockedApi: readonly string[] = [...DEBUG_API_ROUTES, ...DEPRECATED_API_ROUTES]

export function debugRoutesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ENABLE_DEBUG_ROUTES === 'true' && env.NODE_ENV !== 'production'
}

/** True when the pathname must be hidden (404) in the current environment. */
export function isBlockedPath(pathname: string, env: Record<string, string | undefined> = process.env): boolean {
  if (debugRoutesEnabled(env)) return false
  if (DEBUG_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  if (!pathname.startsWith('/api/')) return false
  // Normalise //, trailing slashes and case so variants cannot slip past.
  const rest = pathname.slice('/api/'.length).toLowerCase().split('/').filter(Boolean).join('/')
  return blockedApi.some((entry) => rest === entry || rest.startsWith(`${entry}/`))
}
