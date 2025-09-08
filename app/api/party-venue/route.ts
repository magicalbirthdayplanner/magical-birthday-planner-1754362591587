import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Save venue selection for a party
export async function POST(request: NextRequest) {
  try {
    const { partyId, userId, venue, isCustom } = await request.json();

    if (!partyId || !userId) {
      return NextResponse.json({ error: 'Party ID and User ID are required' }, { status: 400 });
    }

    let venueId = null;

    // If it's a Google Places venue, ensure it's stored in the venues table
    if (!isCustom && venue?.placeId) {
      const venueData = {
        place_id: venue.placeId,
        name: venue.name,
        address: venue.address,
        formatted_address: venue.formattedAddress,
        phone: venue.phone,
        website: venue.website,
        rating: venue.rating,
        reviews_count: venue.reviewsCount,
        price_level: venue.priceLevel,
        category: venue.category,
        types: venue.types,
        business_status: venue.businessStatus,
        latitude: venue.latitude,
        longitude: venue.longitude,
        zip_code: venue.zipCode,
        city: venue.city,
        state: venue.state,
        photos: venue.photos,
        opening_hours: venue.openingHours,
        last_validated_at: new Date().toISOString()
      };

      // Upsert venue data
      const { data: venueRecord, error: venueError } = await supabase
        .from('venues')
        .upsert(venueData, { onConflict: 'place_id' })
        .select()
        .single();

      if (venueError) {
        console.error('Error saving venue:', venueError);
        return NextResponse.json({ error: 'Failed to save venue data' }, { status: 500 });
      }

      venueId = venueRecord.id;
    }

    // Save party venue selection
    const partyVenueData = {
      party_id: partyId,
      venue_id: venueId,
      user_id: userId,
      custom_name: isCustom ? venue?.name : null,
      custom_address: isCustom ? venue?.address : null,
      custom_notes: isCustom ? JSON.stringify(venue) : null,
      is_custom: isCustom || false,
      selected_at: new Date().toISOString()
    };

    // Upsert party venue (replace existing selection)
    const { data: partyVenue, error: partyVenueError } = await supabase
      .from('party_venues')
      .upsert(partyVenueData, { onConflict: 'party_id' })
      .select()
      .single();

    if (partyVenueError) {
      console.error('Error saving party venue:', partyVenueError);
      return NextResponse.json({ error: 'Failed to save venue selection' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      partyVenue,
      message: `Venue "${venue?.name}" selected successfully`
    });

  } catch (error) {
    console.error('Error in party venue API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get venue selection for a party
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');

    if (!partyId) {
      return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
    }

    const { data: partyVenue, error } = await supabase
      .from('party_venues')
      .select(`
        *,
        venues (*)
      `)
      .eq('party_id', partyId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching party venue:', error);
      return NextResponse.json({ error: 'Failed to fetch venue selection' }, { status: 500 });
    }

    if (!partyVenue) {
      return NextResponse.json({ venue: null });
    }

    // Transform data back to frontend format
    let venue: any = null;
    if (partyVenue.is_custom) {
      venue = {
        name: partyVenue.custom_name,
        address: partyVenue.custom_address,
        ...(partyVenue.custom_notes ? JSON.parse(partyVenue.custom_notes) : {})
      };
    } else if (partyVenue.venues) {
      const v = partyVenue.venues;
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
        photos: v.photos,
        openingHours: v.opening_hours,
        partyPackagesAvailable: v.party_packages_available
      };
    }

    return NextResponse.json({ 
      venue,
      selectedAt: partyVenue.selected_at,
      isCustom: partyVenue.is_custom
    });

  } catch (error) {
    console.error('Error in party venue GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete venue selection for a party
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');
    const userId = searchParams.get('userId');

    if (!partyId || !userId) {
      return NextResponse.json({ error: 'Party ID and User ID are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('party_venues')
      .delete()
      .eq('party_id', partyId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting party venue:', error);
      return NextResponse.json({ error: 'Failed to delete venue selection' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Venue selection removed successfully'
    });

  } catch (error) {
    console.error('Error in party venue DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}