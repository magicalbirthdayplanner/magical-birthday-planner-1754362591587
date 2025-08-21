import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-client';

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

    const { activityId, partyId } = await request.json();
    
    if (!activityId || !partyId) {
      return NextResponse.json(
        { error: 'Activity ID and Party ID are required' },
        { status: 400 }
      );
    }

    // Get activity details from Supabase
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
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

    // Return expanded activity details
    return NextResponse.json({
      success: true,
      activity: {
        id: activity.id,
        name: activity.name,
        description: activity.description,
        fullDescription: activity.full_description,
        suppliesNeeded: activity.supplies_needed,
        setupTime: activity.setup_time,
        helpersRequired: activity.helpers_required,
        stepByStepInstructions: activity.step_by_step_instructions,
        hostScript: activity.host_script,
        ageGroup: activity.age_group,
        venueType: activity.venue_type,
        duration: activity.duration,
        durationMinutes: activity.duration_minutes,
        themeCompatibility: activity.theme_compatibility,
        effortLevel: activity.effort_level,
        participantRange: activity.participant_range,
        minParticipants: activity.min_participants,
        maxParticipants: activity.max_participants,
        category: activity.category,
        tags: activity.tags
      }
    });

  } catch (error) {
    console.error('Error expanding activity:', error);
    return NextResponse.json(
      { error: 'Failed to expand activity' },
      { status: 500 }
    );
  }
}