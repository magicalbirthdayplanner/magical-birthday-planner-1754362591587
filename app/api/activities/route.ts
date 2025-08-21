import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const timeFilter = searchParams.get('time');
    const materialsFilter = searchParams.get('materials');
    const search = searchParams.get('search');

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      isActive: true
    };

    // Category filter
    if (category && category !== 'all') {
      whereClause.category = category;
    }

    // Time filter
    if (timeFilter && timeFilter !== 'all') {
      switch (timeFilter) {
        case 'short':
          whereClause.durationMinutes = { lt: 15 };
          break;
        case 'medium':
          whereClause.durationMinutes = { gte: 15, lte: 30 };
          break;
        case 'long':
          whereClause.durationMinutes = { gt: 30 };
          break;
      }
    }

    // Materials filter
    if (materialsFilter && materialsFilter !== 'all') {
      switch (materialsFilter) {
        case 'none':
          whereClause.suppliesNeeded = { isEmpty: true };
          break;
        case 'simple':
          whereClause.suppliesNeeded = { not: { isEmpty: true } };
          // For simple, we'll filter in the application layer
          break;
        case 'advanced':
          // For advanced, we'll filter in the application layer
          break;
      }
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } }
      ];
    }

    // Get total count for pagination
    const totalCount = await prisma.birthdayActivity.count({
      where: whereClause
    });

    // Fetch activities with pagination
    const activities = await prisma.birthdayActivity.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      skip: offset,
      take: limit
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

    // Apply materials filter in application layer for complex cases
    let finalActivities = transformedActivities;
    if (materialsFilter === 'simple') {
      finalActivities = finalActivities.filter(activity => 
        activity.suppliesNeeded && activity.suppliesNeeded.length <= 3
      );
    } else if (materialsFilter === 'advanced') {
      finalActivities = finalActivities.filter(activity => 
        activity.suppliesNeeded && activity.suppliesNeeded.length > 3
      );
    }

    return NextResponse.json({ 
      activities: finalActivities,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
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