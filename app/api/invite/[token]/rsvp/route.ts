import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { emailConfigured, hostContact, partyFactsByToken, sendHostRsvpNotification, sendRsvpConfirmation } from '@/lib/server/notifications'
import { randomUUID } from 'node:crypto'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

const TOKEN_RE = /^[0-9a-f]{48}$/

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().max(200).email().optional().or(z.literal('')),
  status: z.enum(['CONFIRMED', 'MAYBE', 'DECLINED']),
  adults: z.number().int().min(0).max(20),
  children: z.number().int().min(0).max(20),
  note: z.string().trim().max(500).optional(),
})

const MESSAGES: Record<string, [number, string]> = {
  invitation_not_found: [404, 'This invitation link is no longer active.'],
  rsvp_limit_reached: [409, 'This party has reached its RSVP limit. Please contact the host.'],
  invalid_email: [400, 'That email doesn’t look right.'],
  invalid_name: [400, 'Please add your name.'],
}

/**
 * POST /api/invite/:token/rsvp — public RSVP for a party invitation.
 * The token (192-bit random) is the only credential. Validated and rate-limited
 * here; the database function only accepts calls from the service role.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!TOKEN_RE.test(params.token)) return apiError(404, 'not_found', MESSAGES.invitation_not_found[1])
  const ip = clientIp(req)
  if (!rateLimit(`rsvp:${ip}:${params.token}`, 6, 10 * 60_000).ok || !rateLimit(`rsvp-ip:${ip}`, 30, 3_600_000).ok) {
    return apiError(429, 'rate_limited', 'Too many RSVPs from this device. Please try again later.')
  }
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Please check your RSVP details.')
  }
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'RSVPs are temporarily unavailable.')

  const { error } = await getSupabaseAdmin().rpc('submit_rsvp', {
    p_token: params.token,
    p_name: body.name,
    p_email: body.email || '',
    p_status: body.status,
    p_adults: body.status === 'DECLINED' ? 0 : body.adults,
    p_children: body.status === 'DECLINED' ? 0 : body.children,
    p_note: body.note || undefined,
  })
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k))
    if (key) return apiError(MESSAGES[key][0], 'invalid_request', MESSAGES[key][1])
    console.error('rsvp failed', error.code)
    return apiError(500, 'server_error', 'We couldn’t save your RSVP. Please try again.')
  }
  // Notifications are best-effort: an email problem never fails the RSVP.
  let emailed = { guest: false, host: false }
  if (emailConfigured()) {
    try {
      const party = await partyFactsByToken(params.token)
      if (party) {
        const nonce = randomUUID()
        const adults = body.status === 'DECLINED' ? 0 : body.adults
        const children = body.status === 'DECLINED' ? 0 : body.children
        const host = await hostContact(party.hostUserId)
        const [g, h] = await Promise.allSettled([
          body.email ? sendRsvpConfirmation(party, { name: body.name, email: body.email, status: body.status, nonce }) : Promise.resolve({ ok: false }),
          host?.wantsEmail
            ? sendHostRsvpNotification(party, { userId: party.hostUserId, email: host.email }, { name: body.name, status: body.status, adults, children, note: body.note, nonce })
            : Promise.resolve({ ok: false }),
        ])
        emailed = { guest: g.status === 'fulfilled' && g.value.ok, host: h.status === 'fulfilled' && h.value.ok }
      }
    } catch (e) {
      console.warn('rsvp notifications failed', (e as Error)?.name)
    }
  }
  return NextResponse.json({ ok: true, emailed })
}
