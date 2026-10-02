import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { getUserPlan } from '@/lib/billing/server'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users?q=… → users matching email or name (Super Admin only).
 * Returns profile fields + effective plan/source only — never tokens or secrets.
 */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  // Strip PostgREST filter syntax so the term can't add filters to .or().
  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/[,()%*\\:"'`]/g, ' ').trim().slice(0, 80)
  const admin = getSupabaseAdmin()
  let query = admin.from('users').select('id, email, display_name, full_name, name, created_at').order('created_at', { ascending: false }).limit(20)
  if (q) query = query.or(['email', 'display_name', 'full_name', 'name'].map((c) => `${c}.ilike.%${q}%`).join(','))
  const { data: rows } = await query
  const { data: roles } = await admin.from('user_roles').select('user_id, role').in('user_id', (rows ?? []).map((r) => r.id))
  const users = await Promise.all(
    (rows ?? []).map(async (r) => {
      const p = await getUserPlan(admin, r.id)
      return {
        id: r.id,
        email: r.email,
        name: r.display_name || r.full_name || r.name || null,
        createdAt: r.created_at,
        role: roles?.find((x) => x.user_id === r.id)?.role ?? null,
        plan: p.plan,
        source: p.source,
        trialActive: p.trialActive,
        override: p.override,
      }
    }),
  )
  return NextResponse.json({ users })
}
