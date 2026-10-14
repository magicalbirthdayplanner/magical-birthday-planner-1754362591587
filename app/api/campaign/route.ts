import { NextResponse } from 'next/server'
import { getActiveCampaign } from '@/lib/billing/server'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/campaign → the site-wide free campaign running now: { active, plan, endsAt, endsOn } or { active: false }.
 * Public (it is the banner on every page); the same function grants access in the database (has_paid_access) and on
 * the server (getUserPlan), so the banner can never promise more than is granted.
 */
export async function GET() {
  const c = hasServiceRole() ? await getActiveCampaign(getSupabaseAdmin()).catch(() => null) : null
  return NextResponse.json(c ? { active: true, id: c.id, plan: c.plan, endsAt: c.endsAt, endsOn: c.endsOn } : { active: false })
}
