import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import crypto from 'crypto';
import { cookies } from 'next/headers';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest) {
  try {
    const { partyId } = await request.json();

    if (!partyId) {
      return safeJson(
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
      return safeJson(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = user.id;

    // Verify the party belongs to the user
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .eq('userId', userId)
      .single();

    if (partyError || !party) {
      return safeJson(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Generate a unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Update the party with the share token
    const { error: updateError } = await supabase
      .from('parties')
      .update({
        shareToken: shareToken,
        isShared: true,
        sharedAt: new Date().toISOString(),
      })
      .eq('id', partyId);

    if (updateError) {
      console.error('Error updating party with share token:', updateError);
      return safeJson(
        { error: 'Failed to generate share token' },
        { status: 500 }
      );
    }

    return safeJson({
      success: true,
      shareToken: shareToken,
    });

  } catch (error) {
    console.error('Error generating share token:', error);
    return safeJson(
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
      return safeJson(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    // Create Supabase client for this request
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

    // Find the party by share token
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*, guests(*)')
      .eq('shareToken', token)
      .eq('isShared', true)
      .single();

    if (partyError || !party) {
      return safeJson(
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
        total: party.guests?.length || 0,
        adults: party.guests?.filter((g: any) => g.type === 'ADULT').length || 0,
        children: party.guests?.filter((g: any) => g.type === 'CHILD').length || 0,
      },
      completedTasks: 0, // Default since checklist is in separate structure
      totalTasks: 15, // Default number of tasks
      sharedAt: party.sharedAt,
    };

    return safeJson({
      success: true,
      party: sharedParty,
    });

  } catch (error) {
    console.error('Error fetching shared party:', error);
    return safeJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
