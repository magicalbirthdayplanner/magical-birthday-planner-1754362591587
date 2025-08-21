import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');

    if (!partyId) {
      return NextResponse.json(
        { error: 'Party ID is required' },
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

    // Get party activities
    const { data: partyActivities, error: activitiesError } = await supabase
      .from('party_activities')
      .select(`
        *,
        activities (*)
      `)
      .eq('user_id', user.id)
      .eq('party_id', partyId)
      .eq('is_selected', true)
      .order('sort_order', { ascending: true });

    if (activitiesError) {
      console.error('Error fetching party activities:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch party activities' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      partyActivities: partyActivities || []
    });

  } catch (error) {
    console.error('Error fetching party activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch party activities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { partyId, activityId, customNotes, estimatedTime, peopleRequired } = await request.json();
    
    if (!partyId || !activityId) {
      return NextResponse.json(
        { error: 'Party ID and Activity ID are required' },
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

    // Create or update party activity
    const { data: partyActivity, error: upsertError } = await supabase
      .from('party_activities')
      .upsert({
        user_id: user.id,
        party_id: partyId,
        activity_id: activityId,
        is_selected: true,
        custom_notes: customNotes,
        estimated_time: estimatedTime,
        people_required: peopleRequired
      }, {
        onConflict: 'user_id,party_id,activity_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting party activity:', upsertError);
      return NextResponse.json(
        { error: 'Failed to add activity to party' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Activity added to party successfully',
      partyActivity
    });

  } catch (error) {
    console.error('Error adding party activity:', error);
    return NextResponse.json(
      { error: 'Failed to add activity to party' },
      { status: 500 }
    );
  }
}