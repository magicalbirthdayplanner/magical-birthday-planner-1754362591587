import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { apiError } from '@/lib/server/http'
import { reportDbError } from '@/lib/observability/telemetry'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/markets?days=30 → US vs India funnel counts (Super Admin only; 404 for everyone else).
 * Aggregates from public.admin_market_report: party-scoped steps by the party's event country, pre-party steps by the
 * visitor's chosen market. Counts only — no personal data.
 */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const n = Number(new URL(req.url).searchParams.get('days') ?? 30)
  const days = Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30
  const { data, error: rpcErr } = await getSupabaseAdmin().rpc('admin_market_report', { p_days: days })
  if (rpcErr) {
    reportDbError('admin_market_report', rpcErr)
    return apiError(500, 'server_error', 'Could not build the market report.')
  }
  return NextResponse.json(data)
}
