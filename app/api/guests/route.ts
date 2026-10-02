import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerClient } from '@supabase/ssr';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

// Multi-layered authentication helper (copied from parties route)
async function getAuthenticatedSupabaseClient(request: NextRequest) {
  const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  const supabaseConfig1 = {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set() {
        // No-op for API routes
      },
      remove() {
        // No-op for API routes
      }
    }
  };

  const supabaseConfig2 = accessToken ? {
    cookies: supabaseConfig1.cookies,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  } : undefined;
  
  console.log('Creating Supabase clients with multiple configurations');
  
  // Try multiple authentication approaches
  let authenticatedUser: any = null;
  let workingSupabase: any = null;
  
  // Approach 1: Standard SSR client
  try {
    console.log('Approach 1: Standard SSR client');
    const supabase1 = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      supabaseConfig1
    );
    
    const { data: { user }, error } = await supabase1.auth.getUser();
    
    if (!error && user) {
      console.log('Approach 1 successful - User authenticated:', user.id);
      authenticatedUser = user;
      workingSupabase = supabase1;
    } else {
      console.log('Approach 1 failed:', error?.message || 'No user found');
    }
  } catch (error) {
    console.log('Approach 1 error:', error);
  }
  
  // Approach 2: Client with explicit auth header
  if (!authenticatedUser && accessToken) {
    try {
      console.log('Approach 2: Client with explicit auth header');
      const supabase2 = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        supabaseConfig2!
      );
      
      const { data: { user }, error } = await supabase2.auth.getUser();
      
      if (!error && user) {
        console.log('Approach 2 successful - User authenticated:', user.id);
        authenticatedUser = user;
        workingSupabase = supabase2;
      } else {
        console.log('Approach 2 failed:', error?.message || 'No user found');
      }
    } catch (error) {
      console.log('Approach 2 error:', error);
    }
  }

  // Approach 3: Direct token verification (if we have a token but other methods failed)
  if (!authenticatedUser && accessToken) {
    try {
      console.log('Approach 3: Direct token verification');
      const supabase3 = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: supabaseConfig1.cookies }
      );
      
      // Try to verify the token directly
      const { data: { user: tokenUser }, error: tokenError } = await supabase3.auth.getUser(accessToken);
      
      if (!tokenError && tokenUser) {
        console.log('Approach 3 successful - Token verified for user:', tokenUser.id);
        authenticatedUser = tokenUser;
        workingSupabase = supabase3;
      } else {
        console.log('Approach 3 failed:', tokenError?.message || 'Token verification failed');
      }
    } catch (error) {
      console.log('Approach 3 error:', error);
    }
  }

  if (!authenticatedUser || !workingSupabase) {
    console.error('All authentication approaches failed');
    return null;
  }

  console.log('Authentication successful via working approach');
  return { user: authenticatedUser, supabase: workingSupabase };
}

// POST - Add a new guest
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedSupabaseClient(request);
    if (!authResult) {
      console.error('Authentication failed for guest creation');
      return safeJson(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { user, supabase } = authResult;
    const body = await request.json();
    const { partyId, guestData } = body;

    if (!partyId || !guestData) {
      return safeJson(
        { error: 'Party ID and guest data are required' },
        { status: 400 }
      );
    }


    // Verify party ownership
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single();

    if (partyError || !party) {
      console.error('Party verification failed:', partyError);
      return safeJson(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Map frontend guest types to database-compatible types
    // Frontend: ADULT, CHILD, FAMILY, COUPLE
    // Database: GUEST, HELPER, HOST (until constraint is fixed)
    const mapGuestType = (frontendType: string) => {
      switch (frontendType) {
        case 'ADULT':
        case 'CHILD':
        case 'FAMILY':
        case 'COUPLE':
          return 'GUEST'; // Map all to GUEST for now
        default:
          return 'GUEST';
      }
    };

    console.log('Mapping guest type:', guestData.type, '->', mapGuestType(guestData.type));

    // Add the guest
    const { data: newGuest, error: guestError } = await supabase
      .from('guests')
      .insert({
        party_id: partyId,
        user_id: user.id,
        name: guestData.name,
        email: guestData.email || null,
        phone: guestData.phone || null,
        type: mapGuestType(guestData.type), // Use mapped type
        age: guestData.age || null,
        notes: guestData.notes ? `${guestData.notes} [Original type: ${guestData.type}]` : `[Original type: ${guestData.type}]`
      })
      .select()
      .single();

    if (guestError) {
      console.error('Error adding guest:', guestError);
      return safeJson(
        { error: guestError.message },
        { status: 500 }
      );
    }

    console.log('Guest added successfully:', newGuest.id);
    return safeJson({ success: true, guest: newGuest });

  } catch (error) {
    console.error('Error in guest POST API:', error);
    return safeJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a guest
export async function PUT(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedSupabaseClient(request);
    if (!authResult) {
      console.error('Authentication failed for guest update');
      return safeJson(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { user, supabase } = authResult;
    const body = await request.json();
    const { guestId, updates } = body;

    if (!guestId || !updates) {
      return safeJson(
        { error: 'Guest ID and updates are required' },
        { status: 400 }
      );
    }


    // Verify party ownership through guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*, parties!inner(user_id)')
      .eq('id', guestId)
      .eq('parties.user_id', user.id)
      .single();

    if (guestError || !guest) {
      console.error('Guest verification failed:', guestError);
      return safeJson(
        { error: 'Guest not found or access denied' },
        { status: 404 }
      );
    }

    // Whitelist editable fields: the client must not be able to move a guest to
    // another party/user or rewrite server-managed columns.
    const ALLOWED: Record<string, (v: unknown) => boolean> = {
      name: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80,
      email: (v) => v === null || (typeof v === 'string' && v.length <= 200),
      phone: (v) => v === null || (typeof v === 'string' && v.length <= 40),
      age: (v) => v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 120),
      notes: (v) => v === null || (typeof v === 'string' && v.length <= 1000),
      rsvp_status: (v) => ['PENDING', 'CONFIRMED', 'DECLINED', 'MAYBE'].includes(v as string),
      type: (v) => typeof v === 'string' && v.length <= 20,
      dietary_restrictions: (v) => v === null || (Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && x.length <= 60)),
    };
    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates as Record<string, unknown>)) {
      if (!(key in ALLOWED)) continue;
      if (!ALLOWED[key](value)) {
        return safeJson({ error: `Invalid value for ${key}` }, { status: 400 });
      }
      safeUpdates[key] = value;
    }
    if (Object.keys(safeUpdates).length === 0) {
      return safeJson({ error: 'Nothing to update' }, { status: 400 });
    }

    // Update the guest
    const { error: updateError } = await supabase
      .from('guests')
      .update(safeUpdates)
      .eq('id', guestId);

    if (updateError) {
      console.error('Error updating guest:', updateError);
      return safeJson(
        { error: updateError.message },
        { status: 500 }
      );
    }

    console.log('Guest updated successfully:', guestId);
    return safeJson({ success: true });

  } catch (error) {
    console.error('Error in guest PUT API:', error);
    return safeJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a guest
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedSupabaseClient(request);
    if (!authResult) {
      console.error('Authentication failed for guest deletion');
      return safeJson(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { user, supabase } = authResult;
    const url = new URL(request.url);
    const guestId = url.searchParams.get('id');

    if (!guestId) {
      return safeJson(
        { error: 'Guest ID is required' },
        { status: 400 }
      );
    }

    console.log('Deleting guest:', guestId);

    // Verify party ownership through guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*, parties!inner(user_id)')
      .eq('id', guestId)
      .eq('parties.user_id', user.id)
      .single();

    if (guestError || !guest) {
      console.error('Guest verification failed:', guestError);
      return safeJson(
        { error: 'Guest not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the guest
    const { error: deleteError } = await supabase
      .from('guests')
      .delete()
      .eq('id', guestId);

    if (deleteError) {
      console.error('Error deleting guest:', deleteError);
      return safeJson(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    console.log('Guest deleted successfully:', guestId);
    return safeJson({ success: true });

  } catch (error) {
    console.error('Error in guest DELETE API:', error);
    return safeJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
