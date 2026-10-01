import { NextResponse } from 'next/server'
import { isAnalyticsEvent, sanitizeProps } from '@/lib/analytics/events'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST /api/analytics { anonymousId, sessionId, events: [...] } — batched client events. */
export async function POST(req: Request) {
  if (!rateLimit(`analytics:${clientIp(req)}`, 60, 60_000).ok) return apiError(429, 'rate_limited', 'Too many events.')
  let body: { anonymousId?: unknown; sessionId?: unknown; events?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError(400, 'invalid_request', 'Invalid body.')
  }
  const events = Array.isArray(body.events) ? body.events.slice(0, 25) : []
  const auth = await getAuthedRequest(req)
  const anon = typeof body.anonymousId === 'string' && UUID.test(body.anonymousId) ? body.anonymousId : null
  const session = typeof body.sessionId === 'string' && UUID.test(body.sessionId) ? body.sessionId : null

  const rows = events
    .filter((e): e is { event: string; properties?: unknown; partyId?: unknown; path?: unknown } => isAnalyticsEvent((e as { event?: unknown })?.event))
    .map((e) => ({
      event: e.event,
      properties: sanitizeProps(e.properties),
      user_id: auth?.user.id ?? null,
      anonymous_id: anon,
      session_id: session,
      // Only attribute to a party the caller is signed in for; ownership is not re-checked (analytics only).
      party_id: auth && typeof e.partyId === 'string' && UUID.test(e.partyId) ? e.partyId : null,
      path: typeof e.path === 'string' ? e.path.slice(0, 200) : null,
      source: 'client' as const,
    }))

  if (rows.length && hasServiceRole()) {
    const { error } = await getSupabaseAdmin().from('analytics_events').insert(rows)
    if (error) console.warn('analytics insert failed', error.message)
  }
  return NextResponse.json({ accepted: rows.length })
}
