import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

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

// GET - Fetch all user parties
export async function GET(request: NextRequest) {
  try {
    console.log('=== USER PARTIES FETCH API ROUTE STARTED ===');
    
    const authResult = await getAuthenticatedSupabaseClient(request);
    if (!authResult) {
      console.error('Authentication failed for user parties fetch');
      return safeJson(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { user, supabase } = authResult;
    console.log('Fetching parties for user:', user.id);

    // Fetch all user parties with related data
    const { data: parties, error } = await supabase
      .from('parties')
      .select(`
        *,
        guests(id, name, email, phone, type, age, notes),
        invitations(id, status, responded_at, sent_at)
      `)
      .eq('user_id', user.id)
      .order('party_date', { ascending: true });

    if (error) {
      console.error('Error fetching user parties:', error);
      return safeJson(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`Successfully fetched ${parties?.length || 0} parties for user`);
    return safeJson({ 
      success: true, 
      parties: parties || [] 
    });

  } catch (error) {
    console.error('Error in user parties GET API:', error);
    return safeJson(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}