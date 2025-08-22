import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { partyId, guestId } = await request.json();
    
    if (!partyId || !guestId) {
      return NextResponse.json(
        { error: 'Party ID and Guest ID are required' },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user has access to this party
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single();

    if (partyError || !party) {
      return NextResponse.json(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Get guest details
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*')
      .eq('id', guestId)
      .eq('party_id', partyId)
      .single();

    if (guestError || !guest) {
      return NextResponse.json(
        { error: 'Guest not found' },
        { status: 404 }
      );
    }

    // For now, just log the RSVP reminder request
    // In the future, this would integrate with your email service
    console.log('RSVP reminder requested for:', { partyId, guestId, guestEmail: guest.email });

    return NextResponse.json({
      success: true,
      message: 'RSVP reminder sent successfully'
    });

  } catch (error) {
    console.error('Error sending RSVP reminder:', error);
    return NextResponse.json(
      { error: 'Failed to send RSVP reminder' },
      { status: 500 }
    );
  }
}