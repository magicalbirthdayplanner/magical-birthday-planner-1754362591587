import { NextResponse } from 'next/server'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { reportDbError } from '@/lib/observability/telemetry'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'

/**
 * GET /api/founding → { seats, left }: the founding-families offer (first 25 accounts get Pro free; migration
 * 20251009001700). Public, counts only. Seats are given by the database when an account's email is confirmed.
 */
export async function GET() {
  if (!hasServiceRole()) return NextResponse.json({ seats: 0, left: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  const admin = getSupabaseAdmin()
  const [left, total] = await Promise.all([admin.rpc('founding_seats_left'), admin.rpc('founding_seats_total')])
  if (left.error || total.error) {
    reportDbError('founding_seats', (left.error ?? total.error)!)
    return NextResponse.json({ seats: 0, left: 0 }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ seats: total.data ?? 0, left: left.data ?? 0 }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
