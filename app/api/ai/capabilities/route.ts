import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { aiConfig, featureEnabled } from '@/lib/ai/config'
import { capability } from '@/lib/ai/capabilities'
import { aiError } from '@/lib/ai/errors'
import { resolveEntitlement } from '@/lib/ai/handler'
import { usedForParty } from '@/lib/ai/usage'
import { AI_FEATURES } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** GET /api/ai/capabilities?partyId=… → what this user may do for this party (display only; the server enforces). */
export async function GET(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return aiError('unauthenticated')
  const partyId = new URL(req.url).searchParams.get('partyId')
  if (!z.string().uuid().safeParse(partyId).success) return aiError('invalid_input')
  const { data: party } = await auth.supabase.from('parties').select('id').eq('id', partyId!).maybeSingle()
  if (!party) return aiError('not_found')
  const cfg = aiConfig()
  const [ent, used] = await Promise.all([resolveEntitlement(auth, partyId!), usedForParty(auth.supabase, partyId!)])
  const features = AI_FEATURES.map((f) => capability(f, { enabled: featureEnabled(f, cfg), tier: ent.tier, superAdmin: ent.superAdmin, used }))
  return NextResponse.json({ enabled: cfg.enabled && cfg.configured, tier: ent.tier, superAdmin: ent.superAdmin, used, features }, { headers: { 'Cache-Control': 'no-store' } })
}
