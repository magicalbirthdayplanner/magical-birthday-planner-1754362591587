import { NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    console.log('=== SUBSCRIPTION GET API ROUTE STARTED ===');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('=== AUTHENTICATION FAILED FOR SUBSCRIPTION GET ===');
      return safeJson(
        { 
          success: false, 
          error: 'Authentication failed. Please sign out and sign in again.',
        },
        { status: 401 }
      );
    }
    
    console.log('=== AUTHENTICATION SUCCESSFUL FOR SUBSCRIPTION GET ===');
    console.log('User ID:', user.id);

    // Fetch the user's actual subscription plan from the database
    const { data, error } = await supabase
      .from('users')
      .select('current_plan')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Database error fetching user plan:', error.message);
      // Fail closed: never grant a paid plan because of an error.
      return safeJson({
        currentPlan: 'FREE',
        status: 'ACTIVE',
        userId: user.id
      });
    }

    // Return the actual plan from the database
    return safeJson({
      currentPlan: data.current_plan || 'FREE',
      status: 'ACTIVE',
      userId: user.id
    });

  } catch (error) {
    console.error('Subscription GET error:', error);
    return safeJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Plans are server-managed. A signed-in client must never be able to set its own
 * plan (this endpoint used to accept any plan without payment). Plan changes are
 * made by the payment webhook / admin tooling with the service role. See
 * docs/BILLING_SECURITY.md.
 */
export async function PATCH() {
  return safeJson(
    { error: 'Plan changes are managed by billing and cannot be made from the app.' },
    { status: 403 },
  );
}
