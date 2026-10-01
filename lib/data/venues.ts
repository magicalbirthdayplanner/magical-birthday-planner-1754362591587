import { db, type Tables } from '@/lib/db/browser'
import { rowToVenue } from '@/lib/discovery/venue-row'
import { toClientVenue, type ClientVenue } from '@/lib/discovery/client-venue'

export type SavedVenue = Tables<'saved_venues'> & { venue: ClientVenue | null }

const VENUE_SELECT =
  'id, place_id, name, address, formatted_address, short_address, city, state, zip_code, latitude, longitude, rating, reviews_count, price_level, types, primary_type, primary_type_label, categories, photo_refs, business_status, google_maps_url, phone, website, opening_hours, editorial_summary, good_for_children, good_for_groups, max_capacity, last_synced_at, details_synced_at'

async function venueIdFor(placeId: string): Promise<string> {
  const { data, error } = await db.from('venues').select('id').eq('place_id', placeId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This place is no longer available. Refresh your results and try again.')
  return data.id
}

export async function listSavedVenues(partyId: string): Promise<SavedVenue[]> {
  const { data, error } = await db
    .from('saved_venues')
    .select(`*, venues (${VENUE_SELECT})`)
    .eq('party_id', partyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const { venues, ...rest } = row as typeof row & { venues: Parameters<typeof rowToVenue>[0] | null }
    return { ...rest, venue: venues ? toClientVenue(rowToVenue(venues)) : null } as SavedVenue
  })
}

export async function saveVenue(partyId: string, placeId: string): Promise<void> {
  const venueId = await venueIdFor(placeId)
  const { error } = await db.from('saved_venues').upsert({ party_id: partyId, venue_id: venueId, place_id: placeId }, { onConflict: 'party_id,venue_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function unsaveVenue(partyId: string, placeId: string): Promise<void> {
  const { error } = await db.from('saved_venues').delete().eq('party_id', partyId).eq('place_id', placeId)
  if (error) throw error
}

export async function updateSavedVenueNotes(id: string, notes: string): Promise<void> {
  const { error } = await db.from('saved_venues').update({ notes: notes.slice(0, 2000) || null }).eq('id', id)
  if (error) throw error
}

/** The venue chosen for the party ("Add to party"). Shares party_venues with the legacy planner. */
export async function getChosenVenue(partyId: string): Promise<ClientVenue | null> {
  const { data, error } = await db.from('party_venues').select(`venue_id, venues (${VENUE_SELECT})`).eq('party_id', partyId).maybeSingle()
  if (error) throw error
  const v = (data as unknown as { venues: Parameters<typeof rowToVenue>[0] | null } | null)?.venues
  return v ? toClientVenue(rowToVenue(v)) : null
}

export async function chooseVenue(partyId: string, userId: string, placeId: string): Promise<void> {
  const venueId = await venueIdFor(placeId)
  const { error } = await db
    .from('party_venues')
    .upsert({ party_id: partyId, venue_id: venueId, user_id: userId, is_custom: false, selected_at: new Date().toISOString() }, { onConflict: 'party_id' })
  if (error) throw error
}

export async function clearChosenVenue(partyId: string): Promise<void> {
  const { error } = await db.from('party_venues').delete().eq('party_id', partyId)
  if (error) throw error
}
