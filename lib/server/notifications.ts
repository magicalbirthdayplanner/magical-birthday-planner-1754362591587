/**
 * Transactional email (Resend). SERVER ONLY.
 *
 *  - party invitation (host → guests with an email)
 *  - RSVP confirmation (→ the guest, when they left an email)
 *  - RSVP notification (→ the host)
 *
 * Every user-supplied string is HTML-escaped before it reaches a template.
 * Sends carry a Resend idempotency key so retries never double-send, and are
 * logged to email_logs. Email failures never fail the user's action.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { getResend } from '@/lib/email'
import { generateInvitationEmail } from '@/lib/email-templates/invitation'
import { generateRSVPConfirmationEmail } from '@/lib/email-templates/rsvp-confirmation'
import { getSupabaseAdmin, hasServiceRole } from './supabase-admin'

export const emailConfigured = () => !!process.env.RESEND_API_KEY

/**
 * Sender. Defaults to Resend's shared sender, the only one an account without a
 * verified domain may use. Set EMAIL_FROM only to an address on a domain that is
 * VERIFIED in this Resend account.
 */
export const RESEND_SHARED_SENDER = 'Magical Birthday Planner <onboarding@resend.dev>'
export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || RESEND_SHARED_SENDER
}
/** Optional reply-to; omitted unless explicitly configured (no default mailbox). */
export function emailReplyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO?.trim() || undefined
}
export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3100')
  return raw.trim().replace(/\/$/, '')
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const isEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)

export interface SendResult {
  ok: boolean
  id?: string | null
  error?: string
}

interface SendInput {
  to: string
  subject: string
  html: string
  text?: string
  idempotencyKey: string
  log: { type: string; userId?: string | null; partyId?: string | null }
}

export async function sendTransactional(input: SendInput): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: 'not_configured' }
  if (!isEmail(input.to)) return { ok: false, error: 'invalid_recipient' }
  let result: SendResult
  try {
    const { data, error } = await getResend().emails.send(
      {
        from: emailFrom(),
        to: [input.to],
        subject: input.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
        html: input.html,
        text: input.text,
        replyTo: emailReplyTo(),
      },
      { idempotencyKey: createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 64) },
    )
    result = error ? { ok: false, error: error.name || 'send_failed' } : { ok: true, id: data?.id ?? null }
  } catch (e) {
    result = { ok: false, error: (e as Error)?.name || 'send_failed' }
  }
  if (!result.ok) console.warn('email send failed', input.log.type, result.error)
  if (hasServiceRole()) {
    await getSupabaseAdmin()
      .from('email_logs')
      .insert({
        user_id: input.log.userId ?? null,
        party_id: input.log.partyId ?? null,
        email_type: input.log.type,
        recipient_email: input.to.toLowerCase(),
        subject: input.subject.slice(0, 200),
        status: result.ok ? 'SENT' : 'FAILED',
        error_message: result.ok ? null : (result.error ?? null),
      })
      .then(() => undefined, () => undefined)
  }
  return result
}

// ------------------------------------------------------------------ shared formatting
export interface PartyFacts {
  partyId: string
  childName: string
  childAge: number | null
  partyDate: string
  theme: string | null
  startTime: string | null
  endTime: string | null
  locationText: string | null
  headline: string | null
  message: string | null
  hostName: string | null
  token: string
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmtTime = (t: string | null) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const am = h < 12
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${am ? 'AM' : 'PM'}`
}
const timeRange = (p: PartyFacts) => [fmtTime(p.startTime), fmtTime(p.endTime)].filter(Boolean).join(' – ') || 'Time to be confirmed'
const first = (name: string) => name.trim().split(/\s+/)[0] || name

export const inviteLink = (token: string) => `${appBaseUrl()}/invite/${token}`

// ------------------------------------------------------------------ invitation
export async function sendInvitationEmail(p: PartyFacts, guest: { id: string; name: string; email: string }, hostUserId: string): Promise<SendResult> {
  const { html, text } = generateInvitationEmail({
    guestName: escapeHtml(guest.name),
    hostName: escapeHtml(p.hostName || 'Your host'),
    childName: escapeHtml(first(p.childName)),
    childAge: p.childAge ?? 0,
    partyTheme: escapeHtml(p.theme || 'party'),
    partyDate: escapeHtml(fmtDate(p.partyDate)),
    partyTime: escapeHtml(timeRange(p)),
    partyLocation: escapeHtml(p.locationText || 'Location to be confirmed'),
    rsvpUrl: escapeHtml(inviteLink(p.token)),
    personalMessage: p.message ? escapeHtml(p.message) : undefined,
    baseUrl: escapeHtml(appBaseUrl()),
  })
  return sendTransactional({
    to: guest.email,
    subject: `You’re invited to ${first(p.childName)}’s birthday party!`,
    html,
    text,
    idempotencyKey: `invite:${p.partyId}:${guest.id}:${p.token}`,
    log: { type: 'INVITATION', userId: hostUserId, partyId: p.partyId },
  })
}

// ------------------------------------------------------------------ RSVP
export type RsvpStatus = 'CONFIRMED' | 'DECLINED' | 'MAYBE'

export async function sendRsvpConfirmation(p: PartyFacts, rsvp: { name: string; email: string; status: RsvpStatus; nonce: string }): Promise<SendResult> {
  const { html, text } = generateRSVPConfirmationEmail({
    guestName: escapeHtml(rsvp.name),
    childName: escapeHtml(first(p.childName)),
    partyDate: escapeHtml(fmtDate(p.partyDate)),
    partyTime: escapeHtml(timeRange(p)),
    partyLocation: escapeHtml(p.locationText || 'Location to be confirmed'),
    rsvpStatus: rsvp.status === 'CONFIRMED' ? 'accepted' : rsvp.status === 'DECLINED' ? 'declined' : 'maybe',
    hostName: escapeHtml(p.hostName || 'the host'),
    baseUrl: escapeHtml(appBaseUrl()),
  })
  return sendTransactional({
    to: rsvp.email,
    subject: `Your RSVP for ${first(p.childName)}’s party`,
    html,
    text,
    idempotencyKey: `rsvp-confirm:${p.partyId}:${rsvp.email.toLowerCase()}:${rsvp.status}:${rsvp.nonce}`,
    log: { type: 'RSVP_CONFIRMATION', partyId: p.partyId },
  })
}

export async function sendHostRsvpNotification(
  p: PartyFacts,
  host: { userId: string; email: string },
  rsvp: { name: string; status: RsvpStatus; adults: number; children: number; note?: string | null; nonce: string },
): Promise<SendResult> {
  const verb = rsvp.status === 'CONFIRMED' ? 'is coming 🎉' : rsvp.status === 'DECLINED' ? 'can’t make it' : 'might come'
  const counts = rsvp.status === 'DECLINED' ? '' : `${rsvp.children} kid${rsvp.children === 1 ? '' : 's'}, ${rsvp.adults} adult${rsvp.adults === 1 ? '' : 's'}`
  const guestsUrl = `${appBaseUrl()}/guests`
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;background:#fbf8f3;font-family:Inter,Segoe UI,Arial,sans-serif;color:#221b3a">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:14px;color:#5b2fb8;font-weight:600;margin:0">New RSVP · ${escapeHtml(first(p.childName))}’s party</p>
<h1 style="font-size:26px;margin:8px 0 16px">${escapeHtml(rsvp.name)} ${escapeHtml(verb)}</h1>
${counts ? `<p style="font-size:16px;margin:0 0 8px">${escapeHtml(counts)}</p>` : ''}
${rsvp.note ? `<p style="font-size:15px;background:#fff;border-radius:12px;padding:12px 16px;margin:12px 0">“${escapeHtml(rsvp.note)}”</p>` : ''}
<a href="${escapeHtml(guestsUrl)}" style="display:inline-block;margin-top:16px;background:#5b2fb8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">See your guest list</a>
<p style="font-size:12px;color:#6b6480;margin-top:28px">You’re receiving this because you’re hosting this party on Magical Birthday Planner.</p>
</div></body></html>`
  const text = `${rsvp.name} ${verb}${counts ? ` (${counts})` : ''} for ${first(p.childName)}’s party.${rsvp.note ? `\nNote: ${rsvp.note}` : ''}\nGuest list: ${guestsUrl}`
  return sendTransactional({
    to: host.email,
    subject: `${rsvp.name.slice(0, 60)} ${verb.replace(' 🎉', '')} — ${first(p.childName)}’s party`,
    html,
    text,
    idempotencyKey: `rsvp-host:${p.partyId}:${rsvp.name.toLowerCase()}:${rsvp.status}:${rsvp.nonce}`,
    log: { type: 'RSVP_HOST_NOTIFICATION', userId: host.userId, partyId: p.partyId },
  })
}

// ------------------------------------------------------------------ lookups (service role)
export async function partyFactsByToken(token: string): Promise<(PartyFacts & { hostUserId: string }) | null> {
  const { data } = await getSupabaseAdmin()
    .from('party_invitations')
    .select('token, headline, message, host_name, location_text, start_time, end_time, is_active, parties!inner(id, user_id, child_name, child_age, party_date, theme)')
    .eq('token', token)
    .maybeSingle()
  if (!data || !data.is_active) return null
  const party = (data as unknown as { parties: { id: string; user_id: string; child_name: string; child_age: number; party_date: string; theme: string | null } }).parties
  return {
    partyId: party.id,
    hostUserId: party.user_id,
    childName: party.child_name,
    childAge: party.child_age,
    partyDate: party.party_date,
    theme: party.theme,
    startTime: data.start_time,
    endTime: data.end_time,
    locationText: data.location_text,
    headline: data.headline,
    message: data.message,
    hostName: data.host_name,
    token: data.token,
  }
}

/** Host email + whether they want notifications (users.email_notifications, default on). */
export async function hostContact(userId: string): Promise<{ email: string; wantsEmail: boolean } | null> {
  const admin = getSupabaseAdmin()
  const { data: auth } = await admin.auth.admin.getUserById(userId)
  const email = auth?.user?.email
  if (!email) return null
  const { data: profile } = await admin.from('users').select('email_notifications').eq('id', userId).maybeSingle()
  return { email, wantsEmail: profile?.email_notifications !== false }
}
