/**
 * POST /api/santa/sessions/:id {action:'sdp', sdp} → {answerSdp}
 *                              {action:'connected'}  → {ok}
 *                              {action:'end', reason} → {ok}
 * Ownership is checked against the signed-in parent for every action.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { endOwnSession, markConnected, negotiate } from '@/lib/santa/server'
import { isSdpOffer, SantaUpstreamError } from '@/lib/santa/realtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sdp'), sdp: z.string().max(64 * 1024) }),
  z.object({ action: z.literal('connected') }),
  z.object({ action: z.literal('end'), reason: z.string().regex(/^[a-z_]{2,40}$/) }),
])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!z.string().uuid().safeParse(id).success) return apiError(404, 'not_found', 'Not found.')
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Santa isn’t available right now.')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Bad request.')
  const admin = getSupabaseAdmin()
  const b = parsed.data
  if (b.action === 'sdp') {
    if (!isSdpOffer(b.sdp)) return apiError(400, 'invalid_request', 'Bad request.')
    try {
      const r = await negotiate(admin, auth.user.id, id, b.sdp)
      if (!r.ok) return apiError(409, 'invalid_request', 'This call has already ended. Please start again.')
      return NextResponse.json({ answerSdp: r.answerSdp })
    } catch (err) {
      if (err instanceof SantaUpstreamError) {
        console.warn('[santa] negotiate upstream', err.service, err.code)
        return apiError(503, 'server_error', 'We couldn’t reach Santa just now. Please try again in a moment.')
      }
      throw err
    }
  }
  if (b.action === 'connected') return NextResponse.json({ ok: await markConnected(admin, auth.user.id, id) })
  return NextResponse.json({ ok: await endOwnSession(admin, auth.user.id, id, b.reason) })
}
