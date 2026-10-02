import { NextResponse } from 'next/server'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const readProfile = (auth: NonNullable<Awaited<ReturnType<typeof getAuthedRequest>>>) =>
  auth.supabase.from('users').select('current_plan, is_trial_active, trial_expires_at').eq('id', auth.user.id).maybeSingle()

/**
 * GET /api/billing/status → server-derived plan + the caller's purchases (RLS).
 * A lapsed 24 h trial is expired here, server-side: recompute_entitlement (service
 * role only) turns the trial off and recomputes the plan from paid purchases.
 */
export async function GET(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  let [{ data: profile }, { data: purchases }] = await Promise.all([
    readProfile(auth),
    auth.supabase.from('billing_purchases').select('plan, status, kind, created_at, current_period_end').order('created_at', { ascending: false }).limit(20),
  ])
  const trialLapsed = !!profile?.is_trial_active && (!profile.trial_expires_at || new Date(profile.trial_expires_at) <= new Date())
  if (trialLapsed && hasServiceRole()) {
    const { error } = await getSupabaseAdmin().rpc('recompute_entitlement', { p_user: auth.user.id })
    if (!error) ({ data: profile } = await readProfile(auth))
  }
  return NextResponse.json({
    plan: profile?.current_plan ?? 'FREE',
    trialActive: !!profile?.is_trial_active && !!profile.trial_expires_at && new Date(profile.trial_expires_at) > new Date(),
    purchases: purchases ?? [],
  })
}
