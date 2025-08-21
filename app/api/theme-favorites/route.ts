import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const { data: favorites, error: fetchError } = await supabase
      .from('theme_preferences')
      .select(`
        *,
        user:users(id, email, name)
      `)
      .eq('userId', user.id)
      .eq('isFavorite', true);

    if (fetchError) {
      console.error('Error fetching theme favorites:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch theme favorites' },
        { status: 500 }
      );
    }

    return NextResponse.json({ favorites: favorites || [] });
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

    const { data: favorite, error: upsertError } = await supabase
      .from('theme_preferences')
      .upsert({
        userId: user.id,
        themeId: themeId,
        themeType: themeType,
        isFavorite: true,
        updatedAt: new Date().toISOString()
      }, {
        onConflict: 'userId,themeId'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting theme favorite:', upsertError);
      return NextResponse.json(
        { error: 'Failed to add theme favorite' },
        { status: 500 }
      );
    }

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

    const { error: deleteError } = await supabase
      .from('theme_preferences')
      .delete()
      .eq('userId', user.id)
      .eq('themeId', themeId);

    if (deleteError) {
      console.error('Error removing theme favorite:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove theme favorite' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing theme favorite:', error);
    return NextResponse.json(
      { error: 'Failed to remove theme favorite' },
      { status: 500 }
    );
  }
}