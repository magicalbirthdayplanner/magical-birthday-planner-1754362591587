import { NextResponse } from 'next/server'
import { reportDbError } from '@/lib/observability/telemetry'
import { z } from 'zod'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { emailConfigured, hostContact, partyFactsByToken, sendHostRsvpNotification, sendRsvpConfirmation, dailyRsvpEmailCap, emailsSentSince } from '@/lib/server/notifications'
import { createHash, randomUUID } from 'node:crypto'

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
  /** Random per-device secret (stored by the RSVP page) that identifies this invitee across changes. */
  respondent: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/).optional(),
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
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params
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

  // Stored hashed: a guest row never holds the raw secret that can edit it.
  const respondent = body.respondent ? createHash('sha256').update(body.respondent).digest('hex') : undefined
  const args = {
    p_token: params.token,
    p_name: body.name,
    p_email: body.email || '',
    p_status: body.status,
    p_adults: body.status === 'DECLINED' ? 0 : body.adults,
    p_children: body.status === 'DECLINED' ? 0 : body.children,
    p_note: body.note || undefined,
  }
  let { data: result, error } = await getSupabaseAdmin().rpc('submit_rsvp', { ...args, p_respondent: respondent })
  // Safety net if this code ever runs before migration 20251004001100: the old function has no p_respondent.
  if (error?.code === 'PGRST202' && respondent) ({ data: result, error } = await getSupabaseAdmin().rpc('submit_rsvp', args))
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k))
    if (key) return apiError(MESSAGES[key][0], 'invalid_request', MESSAGES[key][1])
    console.error('rsvp failed', error.code)
    reportDbError('rsvp_submit', error)
    return apiError(500, 'server_error', 'We couldn’t save your RSVP. Please try again.')
  }
  // Notifications are best-effort: an email problem never fails the RSVP. An exact repeat of the current answer
  // (double-click, retry, refresh + resubmit) changes nothing, so it sends nothing; a real change notifies again.
  const outcome = (result ?? {}) as { created?: boolean; changed?: boolean }
  const notify = outcome.created !== false || outcome.changed !== false
  let emailed = { guest: false, host: false }
  if (notify && emailConfigured()) {
    try {
      const party = await partyFactsByToken(params.token)
      // Per-party daily cap (all instances): an invite link can't be used to mass-mail arbitrary addresses.
      const underCap = party ? (await emailsSentSince({ partyId: party.partyId, types: ['RSVP_CONFIRMATION', 'RSVP_HOST_NOTIFICATION'], hours: 24 })) < dailyRsvpEmailCap() : false
      if (party && underCap) {
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
