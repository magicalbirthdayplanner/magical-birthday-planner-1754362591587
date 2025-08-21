import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's theme preferences
    const { data: themes, error } = await supabase
      .from('theme_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_favorite', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching custom themes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom themes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      themes: themes || []
    });

  } catch (error) {
    console.error('Error fetching custom themes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom themes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { themeName } = await request.json();
    
    if (!themeName) {
      return NextResponse.json(
        { error: 'Theme name is required' },
        { status: 400 }
      );
    }

    // Create or update theme preference
    const { data: theme, error } = await supabase
      .from('theme_preferences')
      .upsert({
        user_id: user.id,
        theme_name: themeName,
        is_favorite: true
      }, {
        onConflict: 'user_id,theme_name'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating custom theme:', error);
      return NextResponse.json(
        { error: 'Failed to create custom theme' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Custom theme created successfully',
      theme
    });

  } catch (error) {
    console.error('Error creating custom theme:', error);
    return NextResponse.json(
      { error: 'Failed to create custom theme' },
      { status: 500 }
    );
  }
}