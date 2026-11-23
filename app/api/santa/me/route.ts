/** GET /api/santa/me[?ref=checkout] — the signed-in parent's Santa state: children, time left, consent, pricing,
 *  and (with ref) whether that checkout has been paid — from our ledger, never from the return URL. */
import { NextResponse } from 'next/server'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { profileFromRow, SANTA_NOTICE_VERSION } from '@/lib/santa/server'
import { santaCheckoutAvailable, santaPriceCents } from '@/lib/santa/billing'
import { SANTA_PACK, SANTA_PACKS } from '@/lib/santa/packs'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Santa isn’t available right now.')
  const admin = getSupabaseAdmin()
  const uid = auth.user.id
  const ref = new URL(req.url).searchParams.get('ref')
  const refStatus = ref && /^[0-9a-f-]{36}$/i.test(ref) ? (await admin.from('santa_checkouts').select('status').eq('id', ref).eq('user_id', uid).maybeSingle()).data?.status ?? null : null
  const [{ data: children }, { data: balance }, { data: consent }, { data: orders }, { data: calls }] = await Promise.all([
    admin.from('santa_children').select('id, first_name, age, profile, approved_at').eq('user_id', uid).order('created_at'),
    admin.rpc('santa_balance', { p_user: uid }),
    admin.from('santa_consents').select('id').eq('user_id', uid).eq('notice_version', SANTA_NOTICE_VERSION).is('withdrawn_at', null).limit(1),
    admin.from('santa_orders').select('id, status, quantity, amount_minor, currency, seconds_granted, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
    admin.from('santa_sessions').select('id').eq('user_id', uid).eq('kind', 'call').gt('charged_seconds', 0).limit(1),
  ])
  const b = (balance as Array<{ seconds_granted: number; seconds_used: number; seconds_remaining: number }> | null)?.[0]
  return NextResponse.json({
    children: (children ?? []).map((c) => ({ id: c.id, approved: !!c.approved_at, profile: profileFromRow(c) })),
    secondsLeft: Number(b?.seconds_remaining ?? 0),
    secondsUsed: Number(b?.seconds_used ?? 0),
    hasTalked: (calls ?? []).length > 0,
    consented: (consent ?? []).length > 0,
    orders: orders ?? [],
    checkoutAvailable: santaCheckoutAvailable(),
    refStatus,
    price: { pack: SANTA_PACK, seconds: SANTA_PACKS[SANTA_PACK].seconds, cents: santaPriceCents(SANTA_PACK) },
  })
}
