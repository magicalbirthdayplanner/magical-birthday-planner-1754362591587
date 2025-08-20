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

// GET /api/venue-favorites/selected - Get user's selected venue
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const selectedVenue = await prisma.venueFavorite.findFirst({
      where: {
        userId: user.id,
        selected: true
      }
    });

    return NextResponse.json({
      success: true,
      selectedVenue: selectedVenue || null
    });

  } catch (error) {
    console.error('Error fetching selected venue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selected venue' },
      { status: 500 }
    );
  }
}