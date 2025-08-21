import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');

    if (!partyId) {
      return NextResponse.json(
        { error: 'Party ID is required' },
        { status: 400 }
      );
    }

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email }
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this party
    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        userId: userRecord.id
      }
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    const selectedActivities = await prisma.selectedActivity.findMany({
      where: {
        userId: userRecord.id,
        partyId: partyId,
        isSelected: true
      },
      include: {
        // You might want to include activity details here
      }
    });

    return NextResponse.json({
      selectedActivities
    });
  } catch (error) {
    console.error('Error fetching selected activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selected activities' },
      { status: 500 }
      );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
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

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email }
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this party
    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        userId: userRecord.id
      }
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Check if activity exists
    const activity = await prisma.birthdayActivity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Create or update selected activity
    const selectedActivity = await prisma.selectedActivity.upsert({
      where: {
        userId_partyId_activityId: {
          userId: userRecord.id,
          partyId: partyId,
          activityId: activityId
        }
      },
      update: {
        isSelected: true
      },
      create: {
        userId: userRecord.id,
        partyId: partyId,
        activityId: activityId,
        isSelected: true
      }
    });

    return NextResponse.json({
      message: 'Activity added to party plan',
      selectedActivity
    });
  } catch (error) {
    console.error('Error adding selected activity:', error);
    return NextResponse.json(
      { error: 'Failed to add activity to party plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
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

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email }
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this party
    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        userId: userRecord.id
      }
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Delete selected activity
    await prisma.selectedActivity.deleteMany({
      where: {
        userId: userRecord.id,
        partyId: partyId,
        activityId: activityId
      }
    });

    return NextResponse.json({
      message: 'Activity removed from party plan'
    });
  } catch (error) {
    console.error('Error removing selected activity:', error);
    return NextResponse.json(
      { error: 'Failed to remove activity from party plan' },
      { status: 500 }
    );
  }
}
