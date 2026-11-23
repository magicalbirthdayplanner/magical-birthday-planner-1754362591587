/** POST /api/santa/approve {childId, affirmations[]} — parent notice/consent (current version) + approve the details. */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { ALL_AFFIRMATIONS, SANTA_NOTICE_VERSION } from '@/lib/santa/consent'

export const dynamic = 'force-dynamic'

const Body = z.object({ childId: z.string().uuid(), affirmations: z.array(z.string()).max(10) }).strict()

export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Santa isn’t available right now.')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Please check the details.')
  const { childId, affirmations } = parsed.data
  if (!ALL_AFFIRMATIONS.every((a) => affirmations.includes(a))) return apiError(400, 'invalid_request', 'Please tick each box to continue.')
  const admin = getSupabaseAdmin()
  const { data: child } = await admin.from('santa_children').select('id').eq('id', childId).eq('user_id', auth.user.id).maybeSingle()
  if (!child) return apiError(404, 'not_found', 'Child not found.')
  const { data: existing } = await admin.from('santa_consents').select('id').eq('user_id', auth.user.id).eq('notice_version', SANTA_NOTICE_VERSION).is('withdrawn_at', null).limit(1)
  if (!existing?.length) {
    const { error } = await admin.from('santa_consents').insert({ user_id: auth.user.id, notice_version: SANTA_NOTICE_VERSION, affirmations: [...ALL_AFFIRMATIONS], method: 'signed_in_parent_checkbox' })
    if (error) return apiError(500, 'server_error', 'Could not save. Please try again.')
  }
  await admin.from('santa_children').update({ approved_at: new Date().toISOString() }).eq('id', childId).eq('user_id', auth.user.id)
  return NextResponse.json({ ok: true })
}
