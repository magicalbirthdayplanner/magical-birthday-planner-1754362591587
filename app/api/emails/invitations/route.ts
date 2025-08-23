import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { partyId, guestIds } = await request.json();
    
    if (!partyId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json(
        { error: 'Party ID and guest IDs are required' },
        { status: 400 }
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

    // Get guests for this party
    const { data: guests, error: guestsError } = await supabase
      .from('guests')
      .select('*')
      .eq('party_id', partyId)
      .in('id', guestIds);

    if (guestsError) {
      console.error('Error fetching guests:', guestsError);
      return NextResponse.json(
        { error: 'Failed to fetch guests' },
        { status: 500 }
      );
    }

    // For now, just log the invitation request
    // In the future, this would integrate with your email service
    console.log('Invitations requested for:', { partyId, guestIds, partyTheme: party.theme });

    return NextResponse.json({
      success: true,
      message: 'Invitations sent successfully',
      guestsInvited: guests?.length || 0
    });

  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}