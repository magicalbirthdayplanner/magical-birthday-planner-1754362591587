import { NextResponse } from 'next/server'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { getUserPlan } from '@/lib/billing/server'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

/** GET /api/billing/status → server-derived plan (getUserPlan) + the caller's purchases (RLS). */
export async function GET(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  const [{ plan, trialActive }, { data: purchases }] = await Promise.all([
    hasServiceRole() ? getUserPlan(getSupabaseAdmin(), auth.user.id) : Promise.resolve({ plan: 'FREE' as const, trialActive: false }),
    auth.supabase.from('billing_purchases').select('plan, status, kind, created_at, current_period_end').order('created_at', { ascending: false }).limit(20),
  ])
  return NextResponse.json({ plan, trialActive, purchases: purchases ?? [] })
}
