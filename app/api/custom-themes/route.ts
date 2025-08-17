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

// GET - Get user's custom themes
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customThemes = await prisma.customTheme.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ customThemes });
  } catch (error) {
    console.error('Error fetching custom themes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom themes' },
      { status: 500 }
    );
  }
}

// POST - Create new custom theme
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      description,
      emoji,
      colorPalette = [],
      decorations = [],
      activities = [],
      printableIdeas = [],
      whyRecommended,
      matchScore = 0,
      ageAppropriate = true,
      generatedBy = 'AI',
      basedOnInterests = [],
      basedOnColors = []
    } = await req.json();

    if (!name || !description || !emoji) {
      return NextResponse.json(
        { error: 'Name, description, and emoji are required' },
        { status: 400 }
      );
    }

    const customTheme = await prisma.customTheme.create({
      data: {
        userId: user.id,
        name,
        description,
        emoji,
        colorPalette,
        decorations,
        activities,
        printableIdeas,
        whyRecommended,
        matchScore,
        ageAppropriate,
        generatedBy,
        basedOnInterests,
        basedOnColors
      }
    });

    return NextResponse.json({ customTheme });
  } catch (error) {
    console.error('Error creating custom theme:', error);
    return NextResponse.json(
      { error: 'Failed to create custom theme' },
      { status: 500 }
    );
  }
}

// PUT - Update custom theme
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const themeId = searchParams.get('id');

    if (!themeId) {
      return NextResponse.json(
        { error: 'Theme ID is required' },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      emoji,
      colorPalette,
      decorations,
      activities,
      printableIdeas,
      whyRecommended,
      matchScore,
      ageAppropriate
    } = await req.json();

    // Verify the theme belongs to the user
    const existingTheme = await prisma.customTheme.findFirst({
      where: {
        id: themeId,
        userId: user.id
      }
    });

    if (!existingTheme) {
      return NextResponse.json(
        { error: 'Theme not found or unauthorized' },
        { status: 404 }
      );
    }

    const updatedTheme = await prisma.customTheme.update({
      where: {
        id: themeId
      },
      data: {
        name,
        description,
        emoji,
        colorPalette,
        decorations,
        activities,
        printableIdeas,
        whyRecommended,
        matchScore,
        ageAppropriate,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ customTheme: updatedTheme });
  } catch (error) {
    console.error('Error updating custom theme:', error);
    return NextResponse.json(
      { error: 'Failed to update custom theme' },
      { status: 500 }
    );
  }
}

// DELETE - Delete custom theme
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const themeId = searchParams.get('id');

    if (!themeId) {
      return NextResponse.json(
        { error: 'Theme ID is required' },
        { status: 400 }
      );
    }

    // Verify the theme belongs to the user
    const existingTheme = await prisma.customTheme.findFirst({
      where: {
        id: themeId,
        userId: user.id
      }
    });

    if (!existingTheme) {
      return NextResponse.json(
        { error: 'Theme not found or unauthorized' },
        { status: 404 }
      );
    }

    // Also remove from favorites if it exists
    await prisma.themePreference.deleteMany({
      where: {
        userId: user.id,
        themeId: themeId
      }
    });

    // Delete the custom theme
    await prisma.customTheme.delete({
      where: {
        id: themeId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom theme:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom theme' },
      { status: 500 }
    );
  }
}