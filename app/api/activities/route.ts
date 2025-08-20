import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const activities = await prisma.birthdayActivity.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        category: 'asc'
      }
    });

    // Transform database activities to match the expected interface
    const transformedActivities = activities.map(activity => ({
      id: activity.id,
      name: activity.name,
      description: activity.description,
      estimatedTime: activity.durationMinutes,
      timeUnit: 'minutes',
      category: activity.category,
      venue: transformVenueType(activity.venueType),
      isSelected: false,
      isRecommended: false,
      source: 'THEME_DEFAULT' as const,
      ageGroup: activity.ageGroup,
      effortLevel: activity.effortLevel,
      participantRange: activity.participantRange
    }));

    return NextResponse.json({ activities: transformedActivities });
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