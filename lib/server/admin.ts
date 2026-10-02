import 'server-only'
import { getAuthedRequest, type AuthedRequest } from './auth'
import { getSupabaseAdmin, hasServiceRole } from './supabase-admin'
import { apiError } from './http'

/**
 * Server-side Super Admin check for every admin route: a valid session AND a
 * `super_admin` row in user_roles (server-managed; clients cannot write it).
 * Anyone else gets the same 404 as a missing route — no admin information leaks.
 */
export async function requireSuperAdmin(req: Request): Promise<{ auth: AuthedRequest; error?: undefined } | { auth?: undefined; error: Response }> {
  const notFound = { error: apiError(404, 'not_found', 'Not found.') }
  if (!hasServiceRole()) return notFound
  const auth = await getAuthedRequest(req)
  if (!auth) return notFound
  const { data } = await getSupabaseAdmin().from('user_roles').select('role').eq('user_id', auth.user.id).eq('role', 'super_admin').maybeSingle()
  return data ? { auth } : notFound
}

export const ADMIN_PLANS = ['FREE', 'STARTER', 'PLUS', 'PRO'] as const
export type AdminPlan = (typeof ADMIN_PLANS)[number]
export const OVERRIDE_DURATIONS = { '24h': 24 * 3_600_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000, none: null } as const
export type OverrideDuration = keyof typeof OVERRIDE_DURATIONS
