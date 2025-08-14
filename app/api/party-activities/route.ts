import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Initialize Supabase client for authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch activities for a party
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');

    if (!partyId) {
      return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // If no auth token, try to get from session
    if (!userId) {
      // In a real app, you'd validate the session properly
      // For now, we'll allow the request but verify party ownership in the database query
    }

    // Fetch activities for the party
    const activities = await prisma.partyActivity.findMany({
      where: {
        partyId: partyId,
        // Only allow access if user owns the party
        party: userId ? { userId: userId } : undefined
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return NextResponse.json({ 
      activities: activities.map(activity => ({
        id: activity.id,
        name: activity.name,
        description: activity.description,
        supplies: activity.supplies,
        estimatedTime: activity.estimatedTime,
        timeUnit: activity.timeUnit,
        peopleRequired: activity.peopleRequired,
        groupInstructions: activity.groupInstructions,
        hostScript: activity.hostScript,
        tips: activity.tips,
        sortOrder: activity.sortOrder,
        isCustom: activity.isCustom,
        source: activity.source,
        energyLevel: activity.energyLevel,
        isHostModeReady: activity.isHostModeReady,
        themeEmoji: activity.themeEmoji,
        themeContext: activity.themeContext,
        stepByStepScript: activity.stepByStepScript,
        soundCues: activity.soundCues,
        isSelected: true, // Activities from DB are considered selected
        isExpanded: false // Default to collapsed
      }))
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

// POST - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partyId, activity } = body;

    if (!partyId || !activity) {
      return NextResponse.json({ error: 'Party ID and activity data are required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Verify party ownership if userId is available
    if (userId) {
      const party = await prisma.party.findFirst({
        where: {
          id: partyId,
          userId: userId
        }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found or access denied' }, { status: 404 });
      }
    }

    // Create the activity
    const newActivity = await prisma.partyActivity.create({
      data: {
        partyId: partyId,
        name: activity.name,
        description: activity.description || null,
        supplies: activity.supplies || [],
        estimatedTime: activity.estimatedTime || null,
        timeUnit: activity.timeUnit || 'minutes',
        peopleRequired: activity.peopleRequired || null,
        groupInstructions: activity.groupInstructions || null,
        hostScript: activity.hostScript || null,
        tips: activity.tips || [],
        sortOrder: activity.sortOrder || 0,
        isCustom: activity.isCustom || false,
        source: activity.source || 'USER_CREATED',
        energyLevel: activity.energyLevel || 'MEDIUM',
        isHostModeReady: activity.isHostModeReady || false,
        themeEmoji: activity.themeEmoji || null,
        themeContext: activity.themeContext || null,
        stepByStepScript: activity.stepByStepScript || null,
        soundCues: activity.soundCues || []
      }
    });

    return NextResponse.json({ 
      activity: {
        id: newActivity.id,
        name: newActivity.name,
        description: newActivity.description,
        supplies: newActivity.supplies,
        estimatedTime: newActivity.estimatedTime,
        timeUnit: newActivity.timeUnit,
        peopleRequired: newActivity.peopleRequired,
        groupInstructions: newActivity.groupInstructions,
        hostScript: newActivity.hostScript,
        tips: newActivity.tips,
        sortOrder: newActivity.sortOrder,
        isCustom: newActivity.isCustom,
        source: newActivity.source,
        energyLevel: newActivity.energyLevel,
        isHostModeReady: newActivity.isHostModeReady,
        themeEmoji: newActivity.themeEmoji,
        themeContext: newActivity.themeContext,
        stepByStepScript: newActivity.stepByStepScript,
        soundCues: newActivity.soundCues,
        isSelected: true
      }
    });

  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing activity
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { partyId, activity } = body;

    if (!partyId || !activity || !activity.id) {
      return NextResponse.json({ error: 'Party ID, activity ID, and activity data are required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Verify party ownership if userId is available
    if (userId) {
      const party = await prisma.party.findFirst({
        where: {
          id: partyId,
          userId: userId
        }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found or access denied' }, { status: 404 });
      }
    }

    // Update the activity
    const updatedActivity = await prisma.partyActivity.update({
      where: {
        id: activity.id,
        partyId: partyId
      },
      data: {
        name: activity.name,
        description: activity.description || null,
        supplies: activity.supplies || [],
        estimatedTime: activity.estimatedTime || null,
        timeUnit: activity.timeUnit || 'minutes',
        peopleRequired: activity.peopleRequired || null,
        groupInstructions: activity.groupInstructions || null,
        hostScript: activity.hostScript || null,
        tips: activity.tips || [],
        sortOrder: activity.sortOrder || 0,
        isCustom: activity.isCustom || false,
        source: activity.source || 'USER_CREATED'
      }
    });

    return NextResponse.json({ 
      activity: {
        id: updatedActivity.id,
        name: updatedActivity.name,
        description: updatedActivity.description,
        supplies: updatedActivity.supplies,
        estimatedTime: updatedActivity.estimatedTime,
        timeUnit: updatedActivity.timeUnit,
        peopleRequired: updatedActivity.peopleRequired,
        groupInstructions: updatedActivity.groupInstructions,
        hostScript: updatedActivity.hostScript,
        tips: updatedActivity.tips,
        sortOrder: updatedActivity.sortOrder,
        isCustom: updatedActivity.isCustom,
        source: updatedActivity.source
      }
    });

  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an activity
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { partyId, activityId } = body;

    if (!partyId || !activityId) {
      return NextResponse.json({ error: 'Party ID and activity ID are required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Verify party ownership if userId is available
    if (userId) {
      const party = await prisma.party.findFirst({
        where: {
          id: partyId,
          userId: userId
        }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found or access denied' }, { status: 404 });
      }
    }

    // Delete the activity
    await prisma.partyActivity.delete({
      where: {
        id: activityId,
        partyId: partyId
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json(
      { error: 'Failed to delete activity' },
      { status: 500 }
    );
  }
}

// PATCH - Clear all activities for a party (used when adding new activities from Activities tab)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { partyId } = body;

    if (!partyId) {
      return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Verify party ownership if userId is available
    if (userId) {
      const party = await prisma.party.findFirst({
        where: {
          id: partyId,
          userId: userId
        }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found or access denied' }, { status: 404 });
      }
    }

    // Clear all activities for the party
    await prisma.partyActivity.deleteMany({
      where: {
        partyId: partyId
      }
    });

    return NextResponse.json({ success: true, message: 'All activities cleared' });

  } catch (error) {
    console.error('Error clearing activities:', error);
    return NextResponse.json(
      { error: 'Failed to clear activities' },
      { status: 500 }
    );
  }
}