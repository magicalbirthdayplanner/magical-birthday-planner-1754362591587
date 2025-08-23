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

    const { partyId, activityId } = await request.json();
    
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

    // Get activity details
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

    // Return expanded host mode details
    return NextResponse.json({
      success: true,
      hostMode: {
        activityId: activity.id,
        activityName: activity.name,
        hostScript: activity.host_script || 'Host script coming soon!',
        stepByStepInstructions: activity.step_by_step_instructions,
        estimatedTime: activity.duration_minutes,
        peopleRequired: activity.helpers_required + 1, // +1 for host
        supplies: activity.supplies_needed || [],
        tips: `Perfect for ${party.childName}'s ${party.theme || 'birthday'} party!`
      }
    });

  } catch (error) {
    console.error('Error expanding host mode:', error);
    return NextResponse.json(
      { error: 'Failed to expand host mode' },
      { status: 500 }
    );
  }
}