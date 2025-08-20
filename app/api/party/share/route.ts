import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { partyId } = await request.json();

    if (!partyId) {
      return NextResponse.json(
        { error: 'Party ID is required' },
        { status: 400 }
      );
    }

    // Get the user from Supabase auth using cookies
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // No-op since we're only reading
          },
          remove(name: string, options: CookieOptions) {
            // No-op since we're only reading
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = user.id;

    // Verify the party belongs to the user
    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        userId: userId,
      },
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Generate a unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Update the party with the share token
    await prisma.party.update({
      where: { id: partyId },
      data: {
        shareToken: shareToken,
        isShared: true,
        sharedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      shareToken: shareToken,
    });

  } catch (error) {
    console.error('Error generating share token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    // Find the party by share token
    const party = await prisma.party.findFirst({
      where: {
        shareToken: token,
        isShared: true,
      },
      include: {
        guests: true,
      },
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Shared party not found or no longer available' },
        { status: 404 }
      );
    }

    // Return party data without sensitive information
    const sharedParty = {
      id: party.id,
      childName: party.childName,
      age: party.childAge,
      theme: party.theme,
      date: party.partyDate,
      location: party.partyLocation,
      guestCount: party.guestCount,
      budget: party.budget || 0,
      currency: 'USD', // Default currency since not stored separately
      venueType: 'Mixed', // Default value since not in current schema
      duration: 'TBD', // Default value since not in current schema
      interests: party.interests || [],
      favoriteColors: party.favoriteColors || [],
      themeDescription: 'A magical birthday celebration',
      decorations: [],
      activities: [],
      food: [],
      guestSummary: {
        total: party.guests.length,
        adults: party.guests.filter(g => g.type === 'ADULT').length,
        children: party.guests.filter(g => g.type === 'CHILD').length,
      },
      completedTasks: 0, // Default since checklist is in separate structure
      totalTasks: 15, // Default number of tasks
      sharedAt: party.sharedAt,
    };

    return NextResponse.json({
      success: true,
      party: sharedParty,
    });

  } catch (error) {
    console.error('Error fetching shared party:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}