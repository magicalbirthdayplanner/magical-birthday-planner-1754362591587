/**
 * POST /api/santa/preview → {sessionId, previewToken, avatarToken|null, maxSeconds}
 * Free 30-second preview, no sign-up. Limited per client (daily-salted IP hash) and per day; shares the global
 * concurrency cap with paid calls (settings in santa_settings). The token authorises this one session only.
 */
import { NextResponse } from 'next/server'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { START_ERROR_COPY, startPreview } from '@/lib/santa/server'
import { SantaUpstreamError } from '@/lib/santa/realtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (process.env.SANTA_ENABLED === 'false' || !hasServiceRole()) return apiError(503, 'not_configured', START_ERROR_COPY.calls_disabled.message)
  const ip = clientIp(req)
  // Fast in-memory guard before touching the database (the DB limit is the real one).
  if (!rateLimit(`santa-preview:${ip}`, 6, 3_600_000).ok) return apiError(429, 'rate_limited', START_ERROR_COPY.preview_limit.message)
  try {
    const r = await startPreview(getSupabaseAdmin(), ip)
    if (!r.ok) {
      const c = r.error ? START_ERROR_COPY[r.error] : { status: 500, message: 'We couldn’t reach Santa just now. Please try again.' }
      return apiError(c.status, r.error === 'preview_limit' ? 'rate_limited' : 'server_error', c.message)
    }
    return NextResponse.json({ sessionId: r.session.id, previewToken: r.previewToken, avatarToken: r.avatarToken, maxSeconds: r.session.max_seconds })
  } catch (err) {
    if (err instanceof SantaUpstreamError) {
      console.warn('[santa] preview upstream', err.service, err.code)
      return apiError(503, 'server_error', 'We couldn’t reach Santa just now. Please try again in a moment.')
    }
    throw err
  }
}
