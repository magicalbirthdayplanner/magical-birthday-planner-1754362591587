import { db, type Tables } from '@/lib/db/browser'
import { reportDbError } from '@/lib/observability/telemetry'

export type Guest = Tables<'guests'>
export type RsvpStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'MAYBE'
export type InviteStatus = 'NOT_SENT' | 'SENT' | 'VIEWED'

const COLS = 'id, party_id, user_id, name, email, phone, type, rsvp_status, adult_count, child_count, invite_status, invited_at, responded_at, notes, source, created_at, updated_at'

export interface GuestInput {
  name: string
  email?: string | null
  phone?: string | null
  adultCount?: number
  childCount?: number
  notes?: string | null
}

export async function listGuests(partyId: string): Promise<Guest[]> {
  const { data, error } = await db.from('guests').select(COLS).eq('party_id', partyId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Guest[]
}

export function validateGuest(input: GuestInput): string | null {
  const name = input.name.trim()
  if (!name) return 'Please add a name.'
  if (name.length > 80) return 'That name is a little long.'
  if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) return 'That email doesn’t look right.'
  return null
}

export async function addGuest(partyId: string, userId: string, input: GuestInput): Promise<Guest> {
  const { data, error } = await db
    .from('guests')
    .insert({
      party_id: partyId,
      user_id: userId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      adult_count: input.adultCount ?? 1,
      child_count: input.childCount ?? 1,
      notes: input.notes?.trim() || null,
      type: 'FAMILY',
      rsvp_status: 'PENDING',
      source: 'host',
    })
    .select(COLS)
    .single()
  if (error) {
    if (error.code) reportDbError('guest_create', error) // no code = offline/network, not a database failure
    throw error
  }
  return data as Guest
}

export async function updateGuest(id: string, patch: Partial<Pick<Guest, 'name' | 'email' | 'phone' | 'adult_count' | 'child_count' | 'notes' | 'rsvp_status' | 'invite_status' | 'invited_at'>>): Promise<void> {
  const { error } = await db.from('guests').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteGuest(id: string): Promise<void> {
  const { error } = await db.from('guests').delete().eq('id', id)
  if (error) throw error
}

export function guestTotals(guests: Guest[]) {
  const by = (s: string) => guests.filter((g) => g.rsvp_status === s)
  const heads = (list: Guest[]) => list.reduce((n, g) => n + (g.adult_count ?? 0) + (g.child_count ?? 0), 0)
  const kids = (list: Guest[]) => list.reduce((n, g) => n + (g.child_count ?? 0), 0)
  return {
    invited: guests.length,
    confirmed: by('CONFIRMED').length,
    declined: by('DECLINED').length,
    maybe: by('MAYBE').length,
    pending: by('PENDING').length,
    confirmedHeads: heads(by('CONFIRMED')),
    confirmedKids: kids(by('CONFIRMED')),
  }
}
