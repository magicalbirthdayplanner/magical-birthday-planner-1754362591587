import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

/** GET /api/admin/audit → latest 50 administrative actions (Super Admin only). */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const admin = getSupabaseAdmin()
  const { data: rows } = await admin
    .from('admin_audit_log')
    .select('id, admin_user_id, target_user_id, target_email, action, old_plan, new_plan, override_expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const ids = [...new Set((rows ?? []).map((r) => r.admin_user_id).filter((x): x is string => !!x))]
  const { data: admins } = ids.length ? await admin.from('users').select('id, email, display_name').in('id', ids) : { data: [] }
  const name = (id: string | null) => {
    const a = admins?.find((x) => x.id === id)
    return id ? (a?.display_name || a?.email || 'Admin') : 'System'
  }
  return NextResponse.json({
    entries: (rows ?? []).map((r) => ({
      id: r.id,
      at: r.created_at,
      by: name(r.admin_user_id),
      target: r.target_email,
      action: r.action,
      oldPlan: r.old_plan,
      newPlan: r.new_plan,
      expiresAt: r.override_expires_at,
    })),
  })
}
