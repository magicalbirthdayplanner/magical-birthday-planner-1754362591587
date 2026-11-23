/**
 * POST /api/santa/preview/:id {token, action:'sdp', sdp, firstName?} → {answerSdp}
 *                              {token, action:'end', reason}       → {ok}
 * The first name (optional) is used for this preview only and never stored.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp } from '@/lib/server/http'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { endPreview, negotiatePreview } from '@/lib/santa/server'
import { isSdpOffer, SantaUpstreamError } from '@/lib/santa/realtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Token = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/)
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sdp'), token: Token, sdp: z.string().max(64 * 1024), firstName: z.string().trim().max(40).regex(/^[\p{L}\p{M}' .-]*$/u).optional() }),
  z.object({ action: z.literal('end'), token: Token, reason: z.string().regex(/^[a-z_]{2,40}$/) }),
])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!z.string().uuid().safeParse(id).success) return apiError(404, 'not_found', 'Not found.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Santa isn’t available right now.')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Please use letters only for the name.')
  const admin = getSupabaseAdmin()
  const b = parsed.data
  if (b.action === 'end') return NextResponse.json({ ok: await endPreview(admin, id, b.token, b.reason) })
  if (!isSdpOffer(b.sdp)) return apiError(400, 'invalid_request', 'Bad request.')
  try {
    const r = await negotiatePreview(admin, id, b.token, b.sdp, b.firstName || null, clientIp(req))
    if (!r.ok) return apiError(409, 'invalid_request', 'This preview has ended. Please start again.')
    return NextResponse.json({ answerSdp: r.answerSdp })
  } catch (err) {
    if (err instanceof SantaUpstreamError) {
      console.warn('[santa] preview negotiate upstream', err.service, err.code)
      return apiError(503, 'server_error', 'We couldn’t reach Santa just now. Please try again in a moment.')
    }
    throw err
  }
}
