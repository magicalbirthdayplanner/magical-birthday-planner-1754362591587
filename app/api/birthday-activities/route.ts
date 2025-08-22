import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient();
    
    // Get activities from Supabase
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Transform to match expected interface
    const transformedActivities = activities?.map(activity => ({
      id: activity.id,
      name: activity.name,
      description: activity.description,
      estimatedTime: activity.duration_minutes,
      timeUnit: 'minutes',
      category: activity.category,
      venue: transformVenueType(activity.venue_type),
      suppliesNeeded: activity.supplies_needed || [],
      participantRange: activity.participant_range,
      minParticipants: activity.min_participants,
      maxParticipants: activity.max_participants,
      effortLevel: activity.effort_level,
      ageGroup: activity.age_group || [],
      themeCompatibility: activity.theme_compatibility || [],
      tags: activity.tags || [],
      isSelected: false,
      isRecommended: false,
      source: 'DATABASE' as const
    })) || [];

    return NextResponse.json({ 
      activities: transformedActivities,
      total: transformedActivities.length
    });

  } catch (error) {
    console.error('Error fetching birthday activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

function transformVenueType(venueTypes: string[]): 'indoor' | 'outdoor' | 'both' {
  if (!venueTypes || venueTypes.length === 0) return 'both';
  
  if (venueTypes.includes('INDOOR') && venueTypes.includes('OUTDOOR')) {
    return 'both';
  } else if (venueTypes.includes('OUTDOOR')) {
    return 'outdoor';
  } else {
    return 'indoor';
  }
}