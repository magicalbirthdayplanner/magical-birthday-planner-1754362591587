import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper function to create authenticated Supabase client
async function getAuthenticatedSupabaseClient(request: NextRequest) {
  console.log('=== AUTHENTICATION HELPER STARTED ===');
  
  // Extract authorization header
  const authHeader = request.headers.get('authorization');
  let accessToken: string | null = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
    console.log('Access token found in Authorization header');
  }
  
  // Create multiple Supabase client configurations for maximum compatibility
  const cookieStore = cookies();
  
  // Configuration 1: Standard SSR client
  const supabaseConfig1 = {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          console.warn('Cookie setting failed:', error);
        }
      },
    },
  };
  
  // Configuration 2: With explicit auth header
  const supabaseConfig2 = {
    ...supabaseConfig1,
    global: accessToken ? {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    } : undefined
  };
  
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
        supabaseConfig2
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
  
  // Approach 3: Direct token verification
  if (!authenticatedUser && accessToken) {
    try {
      console.log('Approach 3: Direct token verification');
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData && userData.id) {
          console.log('Approach 3 successful - Direct token verified:', userData.id);
          authenticatedUser = userData;
          // Create a fresh client for database operations
          workingSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            supabaseConfig2
          );
        }
      } else {
        console.log('Approach 3 failed - Invalid token response:', response.status);
      }
    } catch (error) {
      console.log('Approach 3 error:', error);
    }
  }
  
  return { user: authenticatedUser, supabase: workingSupabase };
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== PARTY FETCH API ROUTE STARTED ===');
    
    // Get party ID from query parameters
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('id');
    
    if (!partyId) {
      return NextResponse.json(
        { success: false, error: 'Party ID is required' },
        { status: 400 }
      );
    }
    
    console.log('Fetching party with ID:', partyId);
    
    // Get authenticated user and Supabase client
    const { user: authenticatedUser, supabase: workingSupabase } = await getAuthenticatedSupabaseClient(request);
    
    // Final authentication check
    if (!authenticatedUser || !workingSupabase) {
      console.error('=== AUTHENTICATION FAILED FOR PARTY FETCH ===');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication failed. Please sign out and sign in again.',
          debug: {
            partyId,
            timestamp: new Date().toISOString()
          }
        },
        { status: 401 }
      );
    }
    
    console.log('=== AUTHENTICATION SUCCESSFUL FOR PARTY FETCH ===');
    console.log('User ID:', authenticatedUser.id);
    console.log('Fetching party:', partyId);
    
    // First, check if party exists at all
    const { data: partyExists, error: existsError } = await workingSupabase
      .from('parties')
      .select('id, user_id, child_name')
      .eq('id', partyId)
      .single();
    
    if (existsError) {
      console.error('Party lookup error:', existsError);
      if (existsError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: `Party not found: No party exists with ID ${partyId}` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Database error: ${existsError.message}` },
        { status: 500 }
      );
    }
    
    if (!partyExists) {
      console.error(`No party found with ID: ${partyId}`);
      return NextResponse.json(
        { success: false, error: `Party not found: No party exists with ID ${partyId}` },
        { status: 404 }
      );
    }
    
    console.log(`Party exists. Owner: ${partyExists.user_id}, Current user: ${authenticatedUser.id}`);
    
    // Check if user owns this party
    if (partyExists.user_id !== authenticatedUser.id) {
      console.error(`Access denied. Party belongs to user ${partyExists.user_id}, current user is ${authenticatedUser.id}`);
      return NextResponse.json(
        { success: false, error: `Access denied: This party belongs to another user. You can only view parties you created.` },
        { status: 403 }
      );
    }
    
    // Now fetch the full party data
    const { data: party, error: fetchError } = await workingSupabase
      .from('parties')
      .select(`
        *,
        guests(id, name, email, phone, type, age, notes),
        invitations(id, guest_id, status, responded_at, sent_at)
      `)
      .eq('id', partyId)
      .eq('user_id', authenticatedUser.id)
      .single();

    if (fetchError) {
      console.error('Full party fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: `Failed to load party details: ${fetchError.message}` },
        { status: 500 }
      );
    }
    
    console.log(`=== PARTY FETCH SUCCESSFUL ===`);
    console.log('Party name:', party.child_name);
    console.log('Guests count:', party.guests?.length || 0);
    console.log('Invitations count:', party.invitations?.length || 0);
    
    return NextResponse.json({
      success: true,
      party
    });
    
  } catch (error) {
    console.error('=== PARTY FETCH API ERROR ===', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// PUT - Update party
export async function PUT(request: NextRequest) {
  try {
    console.log('=== PARTY UPDATE API ROUTE STARTED ===');
    
    // Get authenticated user and Supabase client
    const { user: authenticatedUser, supabase: workingSupabase } = await getAuthenticatedSupabaseClient(request);
    
    if (!authenticatedUser || !workingSupabase) {
      console.error('Authentication failed for party update');
      return NextResponse.json(
        { success: false, error: 'Authentication failed. Please sign out and sign in again.' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { partyId, updates } = body;
    
    if (!partyId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Party ID and updates are required' },
        { status: 400 }
      );
    }
    
    console.log('Updating party:', partyId, 'Updates:', updates);
    
    // Verify party ownership
    const { data: party, error: partyError } = await workingSupabase
      .from('parties')
      .select('id, user_id')
      .eq('id', partyId)
      .eq('user_id', authenticatedUser.id)
      .single();
    
    if (partyError || !party) {
      console.error('Party verification failed:', partyError);
      return NextResponse.json(
        { success: false, error: 'Party not found or access denied' },
        { status: 404 }
      );
    }
    
    // Prepare update data with proper field mapping
    const updateData: any = {};
    if (updates.childName !== undefined) updateData.child_name = updates.childName;
    if (updates.childAge !== undefined) updateData.child_age = updates.childAge;
    if (updates.childGender !== undefined) updateData.child_gender = updates.childGender;
    if (updates.partyDate !== undefined) updateData.party_date = new Date(updates.partyDate).toISOString();
    if (updates.theme !== undefined) updateData.theme = updates.theme;
    if (updates.guestCount !== undefined) updateData.guest_count = updates.guestCount;
    if (updates.budget !== undefined) updateData.budget = updates.budget;
    if (updates.location !== undefined) updateData.zip_code = updates.location;
    if (updates.venue !== undefined) updateData.venue_type = updates.venue;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.checklistData !== undefined) updateData.checklist_data = updates.checklistData;
    
    // Update the party
    const { data: updatedParty, error: updateError } = await workingSupabase
      .from('parties')
      .update(updateData)
      .eq('id', partyId)
      .eq('user_id', authenticatedUser.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating party:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }
    
    console.log('Party updated successfully:', partyId);
    return NextResponse.json({ success: true, party: updatedParty });
    
  } catch (error) {
    console.error('Error in party PUT API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete party
export async function DELETE(request: NextRequest) {
  try {
    console.log('=== PARTY DELETE API ROUTE STARTED ===');
    
    // Get authenticated user and Supabase client
    const { user: authenticatedUser, supabase: workingSupabase } = await getAuthenticatedSupabaseClient(request);
    
    if (!authenticatedUser || !workingSupabase) {
      console.error('Authentication failed for party deletion');
      return NextResponse.json(
        { success: false, error: 'Authentication failed. Please sign out and sign in again.' },
        { status: 401 }
      );
    }
    
    // Get party ID from query parameters
    const url = new URL(request.url);
    const partyId = url.searchParams.get('id');
    
    if (!partyId) {
      return NextResponse.json(
        { success: false, error: 'Party ID is required' },
        { status: 400 }
      );
    }
    
    console.log('Deleting party:', partyId);
    
    // Verify party ownership and delete
    const { error: deleteError } = await workingSupabase
      .from('parties')
      .delete()
      .eq('id', partyId)
      .eq('user_id', authenticatedUser.id);
    
    if (deleteError) {
      console.error('Error deleting party:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }
    
    console.log('Party deleted successfully:', partyId);
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in party DELETE API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== PARTY CREATION API ROUTE STARTED ===');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    // Get authenticated user and Supabase client
    const { user: authenticatedUser, supabase: workingSupabase } = await getAuthenticatedSupabaseClient(request);
    
    // Final authentication check
    if (!authenticatedUser || !workingSupabase) {
      console.error('=== AUTHENTICATION FAILED - ALL METHODS ===');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication failed. Please sign out and sign in again.',
          debug: {
            timestamp: new Date().toISOString()
          }
        },
        { status: 401 }
      );
    }
    
    console.log('=== AUTHENTICATION SUCCESSFUL ===');
    console.log('User ID:', authenticatedUser.id);
    console.log('User email:', authenticatedUser.email);
    
    // Parse and validate request body
    let partyData;
    try {
      partyData = await request.json();
      console.log('Party data received:', {
        childName: partyData.childName,
        childAge: partyData.childAge,
        theme: partyData.theme,
        partyDate: partyData.partyDate
      });
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!partyData.childName || !partyData.childAge || !partyData.partyDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: childName, childAge, or partyDate' },
        { status: 400 }
      );
    }
    
    // Prepare insert data with proper validation
    const insertData = {
      user_id: authenticatedUser.id,
      child_name: partyData.childName.trim(),
      child_age: parseInt(String(partyData.childAge), 10),
      child_gender: partyData.childGender || null,
      party_date: new Date(partyData.partyDate).toISOString(),
      theme: partyData.theme || null,
      guest_count: partyData.guestCount || 0,
      budget: partyData.budget || null,
      zip_code: partyData.location || null,
      venue_type: partyData.venue || null,
      status: partyData.status || 'PLANNING'
    };
    
    console.log('Inserting party data:', insertData);
    
    // Insert party into database with retry logic
    let insertResult;
    let insertError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Database insert attempt ${attempt}`);
        
        const { data, error } = await workingSupabase
          .from('parties')
          .insert(insertData)
          .select()
          .single();
        
        if (error) {
          insertError = error;
          console.error(`Insert attempt ${attempt} failed:`, error);
          
          if (attempt === 3) {
            throw error;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        insertResult = data;
        console.log('Party inserted successfully:', data.id);
        break;
        
      } catch (error) {
        insertError = error;
        console.error(`Insert attempt ${attempt} exception:`, error);
        
        if (attempt === 3) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    if (insertError || !insertResult) {
      console.error('=== DATABASE INSERT FAILED ===');
      console.error('Final error:', insertError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Database error: ${insertError?.message || 'Insert failed'}`,
          debug: {
            code: insertError?.code,
            details: insertError?.details,
            hint: insertError?.hint
          }
        },
        { status: 500 }
      );
    }
    
    console.log('=== PARTY CREATION SUCCESSFUL ===');
    console.log('Party ID:', insertResult.id);
    
    return NextResponse.json({
      success: true,
      party: insertResult,
      debug: {
        method: 'api_route',
        userId: authenticatedUser.id,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('=== API ROUTE EXCEPTION ===');
    console.error('Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown server error',
        debug: {
          type: 'exception',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}