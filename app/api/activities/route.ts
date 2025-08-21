import { NextRequest, NextResponse } from 'next/server';
import { activitiesApi } from '@/lib/supabase-integration';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category') || undefined;
    const time = searchParams.get('time') || undefined;
    const materials = searchParams.get('materials') || undefined;
    const search = searchParams.get('search') || undefined;

    // Map time filter to duration values
    let durationFilter = time;
    if (time === 'short') durationFilter = 'DURATION_15';
    if (time === 'medium') durationFilter = 'DURATION_30';
    if (time === 'long') durationFilter = 'DURATION_60';

    // Map materials filter
    let materialsFilter = materials;
    if (materials === 'none') materialsFilter = 'No Prep';
    if (materials === 'simple') materialsFilter = 'Simple Prep';
    if (materials === 'advanced') materialsFilter = 'Advanced Prep';

    const result = await activitiesApi.getActivities({
      page,
      limit,
      category,
      time: durationFilter,
      materials: materialsFilter,
      search
    });

    // Transform to match expected interface
    const transformedActivities = result.activities.map(activity => ({
      id: activity.id,
      name: activity.name,
      description: activity.description,
      estimatedTime: activity.durationMinutes,
      timeUnit: 'minutes',
      category: activity.category,
      venue: transformVenueType(activity.venueType),
      suppliesNeeded: activity.suppliesNeeded,
      participantRange: activity.participantRange,
      minParticipants: activity.minParticipants,
      maxParticipants: activity.maxParticipants,
      effortLevel: activity.effortLevel,
      ageGroup: activity.ageGroup,
      themeCompatibility: activity.themeCompatibility,
      tags: activity.tags,
      isSelected: false,
      isRecommended: false,
      source: 'THEME_DEFAULT' as const
    }));

    return NextResponse.json({ 
      activities: transformedActivities,
      pagination: {
        page,
        limit,
        total: result.totalCount,
        totalPages: result.pagination.totalPages,
        hasMore: result.pagination.hasNextPage
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
  if (venueTypes.includes('INDOOR') && venueTypes.includes('OUTDOOR')) {
    return 'both';
  } else if (venueTypes.includes('OUTDOOR')) {
    return 'outdoor';
  } else {
    return 'indoor';
  }
}