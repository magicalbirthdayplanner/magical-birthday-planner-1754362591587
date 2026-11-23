/** POST /api/santa/sessions {childId} → {sessionId, avatarToken|null, maxSeconds}. Paid visit; the ledger decides. */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { START_ERROR_COPY, startCall } from '@/lib/santa/server'
import { SantaUpstreamError } from '@/lib/santa/realtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({ childId: z.string().uuid() }).strict()

export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (process.env.SANTA_ENABLED === 'false' || !hasServiceRole()) return apiError(503, 'not_configured', START_ERROR_COPY.calls_disabled.message)
  if (!rateLimit(`santa-start:${auth.user.id}`, 20, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many tries. Please wait a few minutes.')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Missing child.')
  try {
    const r = await startCall(getSupabaseAdmin(), auth.user.id, parsed.data.childId)
    if (!r.ok) {
      const c = r.error ? START_ERROR_COPY[r.error] : { status: 500, message: 'We couldn’t reach Santa just now. Please try again.' }
      return apiError(c.status, r.error === 'no_credit' ? 'forbidden' : 'server_error', c.message)
    }
    return NextResponse.json({ sessionId: r.session.id, avatarToken: r.avatarToken, maxSeconds: r.session.max_seconds })
  } catch (err) {
    if (err instanceof SantaUpstreamError) {
      console.warn('[santa] start upstream', err.service, err.code)
      return apiError(503, 'server_error', err.code === 'capacity' ? START_ERROR_COPY.capacity.message : 'We couldn’t reach Santa just now. Please try again in a moment.')
    }
    throw err
  }
}
