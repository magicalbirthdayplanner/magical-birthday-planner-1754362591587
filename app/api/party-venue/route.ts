import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { getAuthedRequest } from '@/lib/server/auth';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic';

/*
 * Legacy planner venue selection (party_venues).
 *
 * Security: previously used the service role and trusted `userId`/`partyId` from the
 * request (any caller could read, overwrite or delete any party's venue). Now the
 * caller must send their access token; every party_venues read/write runs AS THE USER
 * so RLS enforces ownership. The shared venues catalogue is never written
 * from here: unknown places are stored as a custom selection on the caller's party. Response shapes are unchanged.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Save venue selection for a party
export async function POST(request: NextRequest) {
  const auth = await getAuthedRequest(request);
  if (!auth) return safeJson({ error: 'Authentication required' }, { status: 401 });
  try {
    const { partyId, venue, isCustom } = await request.json();
    if (!partyId || !UUID.test(partyId)) {
      return safeJson({ error: 'Party ID is required' }, { status: 400 });
    }

    // RLS: only returns the party if the caller owns it.
    const { data: party } = await auth.supabase.from('parties').select('id').eq('id', partyId).maybeSingle();
    if (!party) return safeJson({ error: 'Party not found' }, { status: 404 });

    let venueId: string | null = null;
    if (!isCustom && typeof venue?.placeId === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(venue.placeId)) {
      const { data: existing } = await auth.supabase.from('venues').select('id').eq('place_id', venue.placeId).maybeSingle();
      venueId = existing?.id ?? null;
    }
    // Never create shared catalogue rows from client-supplied data (catalogue poisoning,
    // and it would bypass the "only places discovery surfaced" guard on paid Google calls).
    // Unknown places are kept as a custom selection on the caller's own party instead.
    const asCustom = !!isCustom || !venueId;

    const { data: partyVenue, error: partyVenueError } = await auth.supabase
      .from('party_venues')
      .upsert(
        {
          party_id: partyId,
          venue_id: venueId,
          user_id: auth.user.id,
          custom_name: asCustom ? str(venue?.name) : null,
          custom_address: asCustom ? str(venue?.address) : null,
          custom_notes: asCustom ? JSON.stringify(venue ?? {}).slice(0, 4000) : null,
          is_custom: asCustom,
          selected_at: new Date().toISOString(),
        },
        { onConflict: 'party_id' },
      )
      .select()
      .single();

    if (partyVenueError) {
      console.error('Error saving party venue:', partyVenueError.message);
      return safeJson({ error: 'Failed to save venue selection' }, { status: 500 });
    }

    return safeJson({ success: true, partyVenue, message: `Venue "${str(venue?.name, 120) ?? ''}" selected successfully` });
  } catch (error) {
    console.error('Error in party venue API:', error);
    return safeJson({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get venue selection for a party
export async function GET(request: NextRequest) {
  const auth = await getAuthedRequest(request);
  if (!auth) return safeJson({ error: 'Authentication required' }, { status: 401 });
  try {
    const partyId = new URL(request.url).searchParams.get('partyId');
    if (!partyId || !UUID.test(partyId)) {
      return safeJson({ error: 'Party ID is required' }, { status: 400 });
    }

    const { data: partyVenue, error } = await auth.supabase.from('party_venues').select('*, venues (*)').eq('party_id', partyId).maybeSingle();
    if (error) {
      console.error('Error fetching party venue:', error.message);
      return safeJson({ error: 'Failed to fetch venue selection' }, { status: 500 });
    }
    if (!partyVenue) return safeJson({ venue: null });

    let venue: Record<string, unknown> | null = null;
    if (partyVenue.is_custom) {
      let extra = {};
      try {
        extra = partyVenue.custom_notes ? JSON.parse(partyVenue.custom_notes) : {};
      } catch {
        extra = {};
      }
      venue = { name: partyVenue.custom_name, address: partyVenue.custom_address, ...extra };
    } else if (partyVenue.venues) {
      const v = partyVenue.venues as Record<string, unknown>;
      venue = {
        id: v.id,
        placeId: v.place_id,
        name: v.name,
        address: v.address,
        formattedAddress: v.formatted_address,
        phone: v.phone,
        website: v.website,
        rating: v.rating,
        reviewsCount: v.reviews_count,
        priceLevel: v.price_level,
        category: v.category,
        types: v.types,
        businessStatus: v.business_status,
        latitude: v.latitude,
        longitude: v.longitude,
        zipCode: v.zip_code,
        city: v.city,
        state: v.state,
        openingHours: v.opening_hours,
        partyPackagesAvailable: v.party_packages_available,
      };
    }

    return safeJson({ venue, selectedAt: partyVenue.selected_at, isCustom: partyVenue.is_custom });
  } catch (error) {
    console.error('Error in party venue GET:', error);
    return safeJson({ error: 'Internal server error' }, { status: 500 });
  }
}

// Remove venue selection
export async function DELETE(request: NextRequest) {
  const auth = await getAuthedRequest(request);
  if (!auth) return safeJson({ error: 'Authentication required' }, { status: 401 });
  try {
    const partyId = new URL(request.url).searchParams.get('partyId');
    if (!partyId || !UUID.test(partyId)) {
      return safeJson({ error: 'Party ID is required' }, { status: 400 });
    }
    const { error } = await auth.supabase.from('party_venues').delete().eq('party_id', partyId);
    if (error) {
      console.error('Error deleting party venue:', error.message);
      return safeJson({ error: 'Failed to delete venue selection' }, { status: 500 });
    }
    return safeJson({ success: true, message: 'Venue selection removed successfully' });
  } catch (error) {
    console.error('Error in party venue DELETE:', error);
    return safeJson({ error: 'Internal server error' }, { status: 500 });
  }
}
