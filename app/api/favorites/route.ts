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

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
      include: {
        activityFavorites: {
          include: {
            // You might want to include activity details here
          }
        }
      }
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      favorites: userRecord.activityFavorites
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
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

    const { activityId } = await request.json();
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
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

    // Create favorite
    const favorite = await prisma.activityFavorite.create({
      data: {
        userId: userRecord.id,
        activityId: activityId
      }
    });

    return NextResponse.json({
      message: 'Activity added to favorites',
      favorite
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json(
      { error: 'Failed to add favorite' },
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

    const { activityId } = await request.json();
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
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

    // Delete favorite
    await prisma.activityFavorite.deleteMany({
      where: {
        userId: userRecord.id,
        activityId: activityId
      }
    });

    return NextResponse.json({
      message: 'Activity removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json(
      { error: 'Failed to remove favorite' },
      { status: 500 }
    );
  }
}
