import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const ageGroups = searchParams.get('ageGroups')?.split(',') || [];
    const venueTypes = searchParams.get('venueTypes')?.split(',') || [];
    const durations = searchParams.get('durations')?.split(',') || [];
    const effortLevels = searchParams.get('effortLevels')?.split(',') || [];
    const themes = searchParams.get('themes')?.split(',') || [];
    const categories = searchParams.get('categories')?.split(',') || [];
    const minParticipants = searchParams.get('minParticipants') ? parseInt(searchParams.get('minParticipants')!) : undefined;
    const maxParticipants = searchParams.get('maxParticipants') ? parseInt(searchParams.get('maxParticipants')!) : undefined;
    const search = searchParams.get('search') || '';
    const randomize = searchParams.get('randomize') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // Build filter conditions
    const where: any = {
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    // Age group filter
    if (ageGroups.length > 0) {
      where.ageGroup = { hasSome: ageGroups };
    }

    // Venue type filter
    if (venueTypes.length > 0) {
      where.venueType = { hasSome: venueTypes };
    }

    // Duration filter
    if (durations.length > 0) {
      where.duration = { in: durations };
    }

    // Effort level filter
    if (effortLevels.length > 0) {
      where.effortLevel = { in: effortLevels };
    }

    // Theme compatibility filter
    if (themes.length > 0) {
      where.themeCompatibility = { hasSome: themes };
    }

    // Category filter
    if (categories.length > 0) {
      where.category = { in: categories };
    }

    // Participant count filters
    if (minParticipants !== undefined) {
      where.minParticipants = { gte: minParticipants };
    }
    if (maxParticipants !== undefined) {
      where.OR = [
        { maxParticipants: { lte: maxParticipants } },
        { maxParticipants: null }, // Activities with unlimited participants
      ];
    }

    // Query options
    const queryOptions: any = {
      where,
      orderBy: randomize ? undefined : { name: 'asc' },
    };

    if (limit) {
      queryOptions.take = limit;
    }

    // Fetch activities
    let activities = await prisma.birthdayActivity.findMany(queryOptions);

    // Randomize if requested
    if (randomize) {
      activities = activities.sort(() => Math.random() - 0.5);
      if (limit) {
        activities = activities.slice(0, limit);
      }
    }

    return NextResponse.json({
      success: true,
      data: activities,
      count: activities.length,
    });

  } catch (error) {
    console.error('Error fetching birthday activities:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch activities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const activity = await prisma.birthdayActivity.create({
      data: {
        name: body.name,
        description: body.description,
        fullDescription: body.fullDescription,
        suppliesNeeded: body.suppliesNeeded || [],
        setupTime: body.setupTime || 5,
        helpersRequired: body.helpersRequired || 1,
        stepByStepInstructions: body.stepByStepInstructions,
        hostScript: body.hostScript,
        ageGroup: body.ageGroup || [],
        venueType: body.venueType || [],
        duration: body.duration,
        durationMinutes: body.durationMinutes,
        themeCompatibility: body.themeCompatibility || [],
        effortLevel: body.effortLevel,
        participantRange: body.participantRange,
        minParticipants: body.minParticipants || 1,
        maxParticipants: body.maxParticipants,
        category: body.category,
        tags: body.tags || [],
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: activity,
    });

  } catch (error) {
    console.error('Error creating birthday activity:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}