import { db, type Tables, type TablesUpdate } from '@/lib/db/browser'
import type { InterestId, Setting } from '@/lib/discovery/taxonomy'
import { venueTypeFromSetting } from '@/lib/discovery/party-context'

export type Party = Tables<'parties'>

export const PARTY_COLUMNS =
  'id, user_id, child_name, child_age, party_date, party_time, zip_code, city, state, latitude, longitude, guest_count, budget, interests, venue_type, theme, theme_details, search_radius_miles, status, created_at, updated_at'

export interface NewPartyInput {
  childName: string
  childAge: number
  partyDate: string
  zip: string
  guestCount: number
  budget: number | null
  setting: Setting
  interests: InterestId[]
  theme: string | null
  location?: { lat: number; lng: number; city: string | null; state: string | null } | null
}

export async function listParties(): Promise<Party[]> {
  const { data, error } = await db.from('parties').select(PARTY_COLUMNS).order('party_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as Party[]
}

export async function createParty(userId: string, input: NewPartyInput): Promise<Party> {
  const { data, error } = await db
    .from('parties')
    .insert({
      user_id: userId,
      child_name: input.childName.trim(),
      child_age: input.childAge,
      party_date: input.partyDate,
      zip_code: input.zip,
      guest_count: input.guestCount,
      budget: input.budget,
      venue_type: venueTypeFromSetting(input.setting),
      interests: input.interests,
      theme: input.theme,
      latitude: input.location?.lat ?? null,
      longitude: input.location?.lng ?? null,
      city: input.location?.city ?? null,
      state: input.location?.state ?? null,
      search_radius_miles: 20,
      status: 'PLANNING',
    })
    .select(PARTY_COLUMNS)
    .single()
  if (error) throw error
  return data as Party
}

export async function updateParty(id: string, patch: TablesUpdate<'parties'>): Promise<Party> {
  const { data, error } = await db.from('parties').update(patch).eq('id', id).select(PARTY_COLUMNS).single()
  if (error) throw error
  return data as Party
}

export async function deleteParty(id: string): Promise<void> {
  const { error } = await db.from('parties').delete().eq('id', id)
  if (error) throw error
}

/** Make sure the signed-in user has a public.users row (legacy FK target of parties.user_id). */
export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const { data } = await db.from('users').select('id').eq('id', user.id).maybeSingle()
  if (data) return
  const name = (user.user_metadata?.display_name as string) || (user.user_metadata?.full_name as string) || null
  await db.from('users').insert({ id: user.id, email: user.email ?? `${user.id}@users.invalid`, full_name: name })
}
