import { NextResponse } from 'next/server'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

/** GET /api/billing/status → server-derived plan + the caller's purchases (RLS). */
export async function GET(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  const [{ data: profile }, { data: purchases }] = await Promise.all([
    auth.supabase.from('users').select('current_plan, is_trial_active, trial_expires_at').eq('id', auth.user.id).maybeSingle(),
    auth.supabase.from('billing_purchases').select('plan, status, kind, created_at, current_period_end').order('created_at', { ascending: false }).limit(20),
  ])
  return NextResponse.json({
    plan: profile?.current_plan ?? 'FREE',
    trialActive: !!profile?.is_trial_active && !!profile.trial_expires_at && new Date(profile.trial_expires_at) > new Date(),
    purchases: purchases ?? [],
  })
}
