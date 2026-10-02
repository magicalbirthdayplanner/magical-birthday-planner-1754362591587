import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

/** GET /api/admin/stats → user counts (Super Admin only). "Paid" = an active verified purchase. */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const admin = getSupabaseAdmin()
  const [{ count: users }, { data: paid }, { count: overrides }] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin.from('billing_purchases').select('user_id').eq('status', 'active'),
    admin.from('plan_overrides').select('user_id', { count: 'exact', head: true }),
  ])
  const paidUsers = new Set((paid ?? []).map((p) => p.user_id)).size
  return NextResponse.json({ users: users ?? 0, paidUsers, freeUsers: Math.max(0, (users ?? 0) - paidUsers), overrides: overrides ?? 0 })
}
