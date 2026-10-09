import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

/** GET /api/admin/stats → user counts (Super Admin only). "Paid" = an active verified purchase; unresolvedPayments = paid
 *  purchases that could not be matched to a party and need reconciliation; foundingMembers = founding-family seats taken. */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const admin = getSupabaseAdmin()
  const [{ count: users }, { data: paid }, { count: overrides }, { count: unresolved }, { count: founding }, { data: seats }] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin.from('billing_purchases').select('user_id').eq('status', 'active'),
    admin.from('plan_overrides').select('user_id', { count: 'exact', head: true }),
    // Paid but not matched to a party: unlocks nothing until reconciled (public.reconcile_purchase).
    admin.from('billing_purchases').select('id', { count: 'exact', head: true }).eq('status', 'active').not('unresolved_reason', 'is', null),
    admin.from('founding_members').select('user_id', { count: 'exact', head: true }),
    admin.rpc('founding_seats_total'),
  ])
  const paidUsers = new Set((paid ?? []).map((p) => p.user_id)).size
  return NextResponse.json({ users: users ?? 0, paidUsers, freeUsers: Math.max(0, (users ?? 0) - paidUsers), overrides: overrides ?? 0, unresolvedPayments: unresolved ?? 0, foundingMembers: founding ?? 0, foundingSeats: seats ?? 0 })
}
