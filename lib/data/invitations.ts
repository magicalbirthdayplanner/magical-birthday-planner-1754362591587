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

export async function submitRsvp(token: string, input: { name: string; email?: string; status: 'CONFIRMED' | 'DECLINED' | 'MAYBE'; adults: number; children: number; note?: string }) {
  const { error } = await db.rpc('submit_rsvp', {
    p_token: token,
    p_name: input.name,
    p_email: input.email ?? '',
    p_status: input.status,
    p_adults: input.adults,
    p_children: input.children,
    p_note: input.note ?? undefined,
  })
  if (error) {
    if (/invitation_not_found/.test(error.message)) throw new Error('This invitation link is no longer active.')
    if (/invalid_email/.test(error.message)) throw new Error('That email doesn’t look right.')
    if (/invalid_name/.test(error.message)) throw new Error('Please add your name.')
    throw new Error('We couldn’t save your RSVP. Please try again.')
  }
}
