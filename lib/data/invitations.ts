import { db, type Tables } from '@/lib/db/browser'

export type PartyInvitation = Tables<'party_invitations'>

export interface InvitationInput {
  headline?: string | null
  message?: string | null
  host_name?: string | null
  location_text?: string | null
  start_time?: string | null
  end_time?: string | null
  rsvp_by?: string | null
  design?: string
}

export async function getInvitation(partyId: string): Promise<PartyInvitation | null> {
  const { data, error } = await db.from('party_invitations').select('*').eq('party_id', partyId).maybeSingle()
  if (error) throw error
  return data
}

export async function saveInvitation(partyId: string, input: InvitationInput): Promise<PartyInvitation> {
  const clean = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
  const { data, error } = await db
    .from('party_invitations')
    .upsert({ party_id: partyId, ...clean }, { onConflict: 'party_id' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function markInvitationShared(inv: PartyInvitation): Promise<void> {
  await db
    .from('party_invitations')
    .update({ share_count: (inv.share_count ?? 0) + 1, last_shared_at: new Date().toISOString() })
    .eq('id', inv.id)
}

export function inviteUrl(token: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}/invite/${token}`
}

export interface PublicInvitation {
  child_name: string
  child_age: number
  party_date: string
  start_time: string | null
  end_time: string | null
  location_text: string | null
  headline: string | null
  message: string | null
  host_name: string | null
  theme: string | null
  design: string
  rsvp_by: string | null
}

export async function getPublicInvitation(token: string): Promise<PublicInvitation | null> {
  const { data, error } = await db.rpc('get_invitation', { p_token: token })
  if (error) throw error
  return (data as unknown as PublicInvitation) ?? null
}

const memoryRespondents = new Map<string, string>()

/**
 * A random secret per invitation per device: the server uses it (hashed) to recognise the same invitee, so
 * "Change my RSVP", retries and double-taps update one guest instead of adding another.
 */
function rsvpRespondent(token: string): string {
  const key = `mbp.rsvp.${token.slice(0, 16)}`
  let stored: string | null = memoryRespondents.get(key) ?? null
  try {
    stored = localStorage.getItem(key) ?? stored
  } catch {
    /* storage unavailable: keep it for this page session */
  }
  if (stored && /^[a-f0-9]{32}$/.test(stored)) return stored
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const fresh = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  memoryRespondents.set(key, fresh)
  try {
    localStorage.setItem(key, fresh)
  } catch {
    /* storage unavailable */
  }
  return fresh
}

export async function submitRsvp(token: string, input: { name: string; email?: string; status: 'CONFIRMED' | 'DECLINED' | 'MAYBE'; adults: number; children: number; note?: string }) {
  let res: Response
  try {
    res = await fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, respondent: rsvpRespondent(token) }),
    })
  } catch {
    throw new Error('We couldn’t reach our servers. Check your connection and try again.')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? 'We couldn’t save your RSVP. Please try again.')
  }
}

/** New 192-bit link token; the old link stops working immediately. */
export function newInviteToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function rotateInvitationToken(inv: PartyInvitation): Promise<PartyInvitation> {
  const { data, error } = await db.from('party_invitations').update({ token: newInviteToken(), share_count: 0 }).eq('id', inv.id).select('*').single()
  if (error) throw error
  return data
}

export async function emailInvitations(partyId: string, opts: { resend?: boolean } = {}) {
  const { apiFetch } = await import('./api')
  return apiFetch<{ sent: number; failed: number; skipped: number }>('/api/invitations/send', {
    method: 'POST',
    body: JSON.stringify({ partyId, resend: opts.resend || undefined }),
  })
}
