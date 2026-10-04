import { NextResponse } from 'next/server'
import { reportDbError } from '@/lib/observability/telemetry'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { dailyInviteCap, emailConfigured, emailsSentSince, sendInvitationEmail, type PartyFacts } from '@/lib/server/notifications'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Body = z.object({
  partyId: z.string().uuid(),
  guestIds: z.array(z.string().uuid()).max(100).optional(),
  resend: z.boolean().optional(),
})

const MAX_PER_REQUEST = 100

/**
 * POST /api/invitations/send { partyId, guestIds?, resend? }
 * Emails the party's invitation link to guests that have an email address.
 * Party, invitation and guests are loaded AS THE HOST (RLS). Guests already
 * invited are skipped unless `resend` is true; Resend idempotency keys prevent
 * duplicates on retries.
 */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  // Product model: invitations & RSVP are Starter+ (lib/entitlements.ts). Same DB check as the guests RLS policies.
  const { data: paid } = await auth.supabase.rpc('has_paid_access')
  if (paid !== true) return apiError(403, 'forbidden', 'Guests & RSVP are part of Starter.')
  if (!emailConfigured()) return apiError(503, 'not_configured', 'Email isn’t set up yet — share the link instead.')
  if (!rateLimit(`invite-email:${auth.user.id}`, 5, 3_600_000).ok) {
    return apiError(429, 'rate_limited', 'You’ve sent several batches recently. Please try again later.')
  }
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid request.')
  }

  const { data: party } = await auth.supabase.from('parties').select('id, user_id, child_name, child_age, party_date, theme').eq('id', body.partyId).maybeSingle()
  if (!party) return apiError(404, 'not_found', 'Party not found.')
  const { data: inv } = await auth.supabase.from('party_invitations').select('*').eq('party_id', party.id).maybeSingle()
  if (!inv || !inv.is_active) return apiError(409, 'invalid_request', 'Create your invitation first.')

  let q = auth.supabase.from('guests').select('id, name, email, invite_status').eq('party_id', party.id).not('email', 'is', null)
  if (body.guestIds?.length) q = q.in('id', body.guestIds)
  const { data: guests, error } = await q
  if (error) {
    reportDbError('invitations_load_guests', error)
    return apiError(500, 'server_error', 'Couldn’t load your guests.')
  }

  // Daily cap across all instances (email_logs): the app must not become a spam relay.
  const remaining = dailyInviteCap() - (await emailsSentSince({ userId: auth.user.id, types: ['INVITATION'], hours: 24 }))
  if (remaining <= 0) return apiError(429, 'rate_limited', 'You’ve reached today’s invitation email limit. Share the link instead, or try again tomorrow.')
  const targets = (guests ?? []).filter((g) => g.email && (body.resend || g.invite_status === 'NOT_SENT')).slice(0, Math.min(MAX_PER_REQUEST, remaining))
  const facts: PartyFacts = {
    partyId: party.id,
    childName: party.child_name,
    childAge: party.child_age,
    partyDate: party.party_date,
    theme: party.theme,
    startTime: inv.start_time,
    endTime: inv.end_time,
    locationText: inv.location_text,
    headline: inv.headline,
    message: inv.message,
    hostName: inv.host_name,
    token: inv.token,
  }

  let sent = 0
  let failed = 0
  for (const g of targets) {
    const r = await sendInvitationEmail(facts, { id: g.id, name: g.name, email: g.email! }, auth.user.id)
    if (r.ok) {
      sent++
      await auth.supabase.from('guests').update({ invite_status: 'SENT', invited_at: new Date().toISOString() }).eq('id', g.id)
    } else failed++
  }
  if (sent) {
    await auth.supabase.from('party_invitations').update({ share_count: (inv.share_count ?? 0) + sent, last_shared_at: new Date().toISOString() }).eq('id', inv.id)
  }
  return NextResponse.json({ sent, failed, skipped: (guests?.length ?? 0) - targets.length })
}
