import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { getPartyPlan, getUserPlan } from '@/lib/billing/server'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const uuid = z.string().uuid()

/**
 * GET /api/billing/status[?partyId=…][&checkout=…] → server-derived plan + the caller's purchases (RLS).
 * Plans are bought per party: with `partyId` (the caller's own party) the plan is THAT party's plan
 * (getPartyPlan); without it, the account-level plan (admin override / trial / FREE).
 * With `checkout`, also that checkout's state and the party it was for (checkout-success page).
 */
export async function GET(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  const url = new URL(req.url)
  const partyParam = url.searchParams.get('partyId')
  const checkoutParam = url.searchParams.get('checkout')
  let partyId: string | null = null
  if (partyParam && uuid.safeParse(partyParam).success) {
    const { data: party } = await auth.supabase.from('parties').select('id').eq('id', partyParam).maybeSingle()
    partyId = party?.id ?? null
  }
  const none = { plan: 'FREE' as const, source: 'free' as const, trialActive: false, override: null }
  const [{ plan, source, trialActive, override }, { data: purchases }, { data: role }, checkout] = await Promise.all([
    !hasServiceRole() ? Promise.resolve(none) : partyId ? getPartyPlan(getSupabaseAdmin(), auth.user.id, partyId) : getUserPlan(getSupabaseAdmin(), auth.user.id),
    auth.supabase.from('billing_purchases').select('plan, status, kind, scope, party_id, created_at, current_period_end').order('created_at', { ascending: false }).limit(20),
    auth.supabase.from('user_roles').select('role').eq('user_id', auth.user.id).maybeSingle(),
    checkoutParam && uuid.safeParse(checkoutParam).success
      ? auth.supabase.from('billing_checkouts').select('plan, status, party_id, parties(child_name)').eq('id', checkoutParam).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ])
  return NextResponse.json({
    plan, source, trialActive, override, partyId,
    superAdmin: role?.role === 'super_admin',
    purchases: purchases ?? [],
    checkout: checkout ? { plan: checkout.plan, status: checkout.status, partyId: checkout.party_id, childName: (checkout.parties as { child_name?: string } | null)?.child_name ?? null } : null,
  })
}
