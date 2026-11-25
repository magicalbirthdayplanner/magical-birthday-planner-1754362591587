/** Server-only helpers for the Super Admin usage pages (service-role reads). */
import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { excludedEmails, isTestEmail } from './insights'

type Admin = ReturnType<typeof getSupabaseAdmin>
const PAGE = 1000

/** Every auth account (paged). Auth is the source of truth for "confirmed" and "last signed in". */
export async function allAuthUsers(admin: Admin): Promise<User[]> {
  const out: User[] = []
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) throw error
    out.push(...data.users)
    if (data.users.length < PAGE) break
  }
  return out
}

/** Accounts left out of usage numbers: super admins, reserved test addresses and ADMIN_EXCLUDE_EMAILS (the owner's other accounts). */
export async function staffIds(admin: Admin, users: User[]): Promise<Set<string>> {
  const { data: roles } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin')
  const excluded = excludedEmails(process.env.ADMIN_EXCLUDE_EMAILS)
  const ids = new Set((roles ?? []).map((r) => r.user_id))
  for (const u of users) if (isTestEmail(u.email) || excluded.has((u.email ?? '').toLowerCase())) ids.add(u.id)
  return ids
}

export const displayName = (u: User): string | null => {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>
  const n = m.display_name || m.full_name || m.first_name || m.name
  return typeof n === 'string' && n.trim() ? n.trim() : null
}
