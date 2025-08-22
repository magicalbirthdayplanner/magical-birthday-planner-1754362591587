import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category') || undefined;
    const time = searchParams.get('time') || undefined;
    const materials = searchParams.get('materials') || undefined;
    const search = searchParams.get('search') || undefined;

    const supabase = createServerComponentClient();
    
    // Build query
    let query = supabase
      .from('activities')
      .select('*', { count: 'exact' });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (time) {
      // Map time filter to duration values
      let durationFilter = time;
      if (time === 'short') durationFilter = 'DURATION_15';
      if (time === 'medium') durationFilter = 'DURATION_30';
      if (time === 'long') durationFilter = 'DURATION_60';
      query = query.eq('duration', durationFilter);
    }
    
    if (materials) {
      // Map materials filter
      let materialsFilter = materials;
      if (materials === 'none') materialsFilter = 'No Prep';
      if (materials === 'simple') materialsFilter = 'Simple Prep';
      if (materials === 'advanced') materialsFilter = 'Advanced Prep';
      // Note: This would need to be adjusted based on your actual data structure
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: activities, error, count } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Transform to match expected interface with safe defaults for missing columns
    const transformedActivities = activities?.map(activity => ({
      id: activity.id,
      name: activity.name,
      description: activity.description,
      estimatedTime: activity.duration_minutes || 30, // Default to 30 minutes
      timeUnit: 'minutes',
      category: activity.category || 'General',
      venue: transformVenueType(activity.venue_type || ['INDOOR']), // Default to indoor
      suppliesNeeded: activity.supplies_needed || ['Basic supplies'], // Default supplies
      participantRange: activity.participant_range || '2-10',
      minParticipants: activity.min_participants || 2,
      maxParticipants: activity.max_participants || 10,
      effortLevel: activity.effort_level || 'Medium',
      ageGroup: activity.age_group || ['5-12'],
      themeCompatibility: activity.theme_compatibility || ['General'],
      tags: activity.tags || [],
      isSelected: false,
      isRecommended: false,
      source: 'THEME_DEFAULT' as const
    })) || [];

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({ 
      activities: transformedActivities,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasMore: page < totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

function transformVenueType(venueTypes: string[]): 'indoor' | 'outdoor' | 'both' {
  // Handle undefined or null venueTypes
  if (!venueTypes || !Array.isArray(venueTypes)) {
    return 'indoor'; // Default to indoor
  }
  
  if (venueTypes.includes('INDOOR') && venueTypes.includes('OUTDOOR')) {
    return 'both';
  } else if (venueTypes.includes('OUTDOOR')) {
    return 'outdoor';
  } else {
    return 'indoor';
  }
}