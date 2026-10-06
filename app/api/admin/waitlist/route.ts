import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { reportDbError } from '@/lib/observability/telemetry'
import { apiError } from '@/lib/server/http'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'

/** GET /api/admin/waitlist → launch-waitlist counts (Super Admin only): total, today (Eastern), by source, by campaign.
 *  Aggregates only — no email addresses leave the database through this route. */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const { data, error: dbError } = await getSupabaseAdmin().rpc('launch_waitlist_stats')
  if (dbError) {
    reportDbError('waitlist_stats', dbError)
    return apiError(500, 'server_error', 'Could not load waitlist stats.')
  }
  return NextResponse.json(data)
}
