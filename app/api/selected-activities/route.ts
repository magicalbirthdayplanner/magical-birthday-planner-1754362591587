import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerComponentClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return safeJson(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');

    if (!partyId) {
      return safeJson(
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
      return safeJson(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Get selected activities for this party
    const { data: selectedActivities, error: activitiesError } = await supabase
      .from('party_activities')
      .select(`
        *,
        activities (*)
      `)
      .eq('user_id', user.id)
      .eq('party_id', partyId)
      .eq('is_selected', true);

    if (activitiesError) {
      console.error('Error fetching selected activities:', activitiesError);
      return safeJson(
        { error: 'Failed to fetch selected activities' },
        { status: 500 }
      );
    }

    return safeJson({
      selectedActivities: selectedActivities || []
    });
  } catch (error) {
    console.error('Error fetching selected activities:', error);
    return safeJson(
      { error: 'Failed to fetch selected activities' },
      { status: 500 }
      );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return safeJson(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activityId, partyId } = await request.json();
    if (!activityId || !partyId) {
      return safeJson(
        { error: 'Activity ID and Party ID are required' },
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
      return safeJson(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Check if activity exists
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return safeJson(
        { error: 'Activity not found' },
        { status: 400 }
      );
    }

    // Create or update party activity
    const { data: selectedActivity, error: upsertError } = await supabase
      .from('party_activities')
      .upsert({
        user_id: user.id,
        party_id: partyId,
        activity_id: activityId,
        is_selected: true
      }, {
        onConflict: 'user_id,party_id,activity_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting party activity:', upsertError);
      return safeJson(
        { error: 'Failed to add activity to party plan' },
        { status: 500 }
      );
    }

    return safeJson({
      message: 'Activity added to party plan',
      selectedActivity
    });
  } catch (error) {
    console.error('Error adding selected activity:', error);
    return safeJson(
      { error: 'Failed to add activity to party plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return safeJson(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activityId, partyId } = await request.json();
    if (!activityId || !partyId) {
      return safeJson(
        { error: 'Activity ID and Party ID are required' },
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
      return safeJson(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Delete party activity
    const { error: deleteError } = await supabase
      .from('party_activities')
      .delete()
      .eq('user_id', user.id)
      .eq('party_id', partyId)
      .eq('activity_id', activityId);

    if (deleteError) {
      console.error('Error deleting party activity:', deleteError);
      return safeJson(
        { error: 'Failed to remove activity from party plan' },
        { status: 500 }
      );
    }

    return safeJson({
      message: 'Activity removed from party plan'
    });
  } catch (error) {
    console.error('Error removing selected activity:', error);
    return safeJson(
      { error: 'Failed to remove activity from party plan' },
      { status: 500 }
    );
  }
}
