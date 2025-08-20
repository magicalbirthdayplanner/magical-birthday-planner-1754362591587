import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUserFromRequest(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

// GET - Get user's theme favorites
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const favorites = await prisma.themePreference.findMany({
      where: {
        userId: user.id,
        isFavorite: true
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('Error fetching theme favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme favorites' },
      { status: 500 }
    );
  }
}

// POST - Add theme to favorites
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { themeId, themeType = 'CLASSIC' } = await req.json();

    if (!themeId) {
      return NextResponse.json(
        { error: 'Theme ID is required' },
        { status: 400 }
      );
    }

    const favorite = await prisma.themePreference.upsert({
      where: {
        userId_themeId: {
          userId: user.id,
          themeId: themeId
        }
      },
      update: {
        isFavorite: true,
        themeType: themeType,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        themeId: themeId,
        themeType: themeType,
        isFavorite: true
      }
    });

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error('Error adding theme favorite:', error);
    return NextResponse.json(
      { error: 'Failed to add theme favorite' },
      { status: 500 }
    );
  }
}

// DELETE - Remove theme from favorites
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const themeId = searchParams.get('themeId');

    if (!themeId) {
      return NextResponse.json(
        { error: 'Theme ID is required' },
        { status: 400 }
      );
    }

    await prisma.themePreference.deleteMany({
      where: {
        userId: user.id,
        themeId: themeId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing theme favorite:', error);
    return NextResponse.json(
      { error: 'Failed to remove theme favorite' },
      { status: 500 }
    );
  }
}