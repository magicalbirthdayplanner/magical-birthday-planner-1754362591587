import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createServerClient } from '@supabase/ssr';

const prisma = new PrismaClient();

// Get user from Supabase session
async function getUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // SSR doesn't need to set cookies
        },
        remove(name: string, options: any) {
          // SSR doesn't need to remove cookies
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/venue-favorites - Get user's favorite venues
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const venueFavorites = await prisma.venueFavorite.findMany({
      where: {
        userId: user.id,
        favorited: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      favorites: venueFavorites
    });

  } catch (error) {
    console.error('Error fetching venue favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch venue favorites' },
      { status: 500 }
    );
  }
}

// POST /api/venue-favorites - Add venue to favorites
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      venueId, 
      wizardSessionId,
      title, 
      address, 
      rating, 
      reviewsCount, 
      phone, 
      website, 
      imageUrl, 
      category,
      coordinates 
    } = body;

    // Validate required fields
    if (!venueId || !title || !address) {
      return NextResponse.json(
        { error: 'Missing required fields: venueId, title, and address are required' },
        { status: 400 }
      );
    }

    // Check if venue is already favorited
    const existingFavorite = await prisma.venueFavorite.findUnique({
      where: {
        venueId_userId: {
          venueId,
          userId: user.id
        }
      }
    });

    if (existingFavorite) {
      // Update existing favorite to be favorited again if it was unfavorited
      const updatedFavorite = await prisma.venueFavorite.update({
        where: {
          id: existingFavorite.id
        },
        data: {
          favorited: true,
          wizardSessionId,
          // Update cached venue data
          title,
          address,
          rating: rating || null,
          reviewsCount: reviewsCount || null,
          phone: phone || null,
          website: website || null,
          imageUrl: imageUrl || null,
          category: category || null,
          coordinates: coordinates || null,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        favorite: updatedFavorite,
        message: 'Venue added to favorites'
      });
    }

    // Create new favorite
    const newFavorite = await prisma.venueFavorite.create({
      data: {
        venueId,
        userId: user.id,
        wizardSessionId,
        title,
        address,
        rating: rating || null,
        reviewsCount: reviewsCount || null,
        phone: phone || null,
        website: website || null,
        imageUrl: imageUrl || null,
        category: category || null,
        coordinates: coordinates || null,
        favorited: true,
        selected: false
      }
    });

    return NextResponse.json({
      success: true,
      favorite: newFavorite,
      message: 'Venue added to favorites'
    });

  } catch (error) {
    console.error('Error adding venue to favorites:', error);
    return NextResponse.json(
      { error: 'Failed to add venue to favorites' },
      { status: 500 }
    );
  }
}

// PUT /api/venue-favorites - Update favorite (select/unselect)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { venueId, selected } = body;

    if (!venueId || typeof selected !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: venueId and selected (boolean) are required' },
        { status: 400 }
      );
    }

    // Find the favorite venue
    const favorite = await prisma.venueFavorite.findUnique({
      where: {
        venueId_userId: {
          venueId,
          userId: user.id
        }
      }
    });

    if (!favorite) {
      return NextResponse.json(
        { error: 'Venue not found in favorites' },
        { status: 404 }
      );
    }

    // If selecting this venue, unselect all other venues for this user
    if (selected) {
      await prisma.venueFavorite.updateMany({
        where: {
          userId: user.id,
          selected: true
        },
        data: {
          selected: false
        }
      });
    }

    // Update the target venue
    const updatedFavorite = await prisma.venueFavorite.update({
      where: {
        id: favorite.id
      },
      data: {
        selected
      }
    });

    return NextResponse.json({
      success: true,
      favorite: updatedFavorite,
      message: selected ? 'Venue selected as final choice' : 'Venue unselected'
    });

  } catch (error) {
    console.error('Error updating venue favorite:', error);
    return NextResponse.json(
      { error: 'Failed to update venue favorite' },
      { status: 500 }
    );
  }
}

// DELETE /api/venue-favorites - Remove venue from favorites
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json(
        { error: 'Missing required parameter: venueId' },
        { status: 400 }
      );
    }

    // Find and delete the favorite
    const deletedFavorite = await prisma.venueFavorite.deleteMany({
      where: {
        venueId,
        userId: user.id
      }
    });

    if (deletedFavorite.count === 0) {
      return NextResponse.json(
        { error: 'Venue not found in favorites' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Venue removed from favorites'
    });

  } catch (error) {
    console.error('Error removing venue from favorites:', error);
    return NextResponse.json(
      { error: 'Failed to remove venue from favorites' },
      { status: 500 }
    );
  }
}