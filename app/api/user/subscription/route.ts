import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    console.log('=== SUBSCRIPTION GET API ROUTE STARTED ===');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('=== AUTHENTICATION FAILED FOR SUBSCRIPTION GET ===');
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
    
    console.log('=== AUTHENTICATION SUCCESSFUL FOR SUBSCRIPTION GET ===');
    console.log('User ID:', user.id);

    // Fetch the user's actual subscription plan from the database
    const { data, error } = await supabase
      .from('users')
      .select('current_plan')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Database error fetching user plan:', error);
      // Fallback to STARTER if there's an error
      return NextResponse.json({
        currentPlan: 'STARTER',
        status: 'ACTIVE',
        userId: user.id
      });
    }

    // Return the actual plan from the database
    return NextResponse.json({
      currentPlan: data.current_plan || 'FREE',
      status: 'ACTIVE',
      userId: user.id
    });

  } catch (error) {
    console.error('Subscription GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    console.log('=== SUBSCRIPTION PATCH API ROUTE STARTED ===');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('=== AUTHENTICATION FAILED FOR SUBSCRIPTION PATCH ===');
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
    
    console.log('=== AUTHENTICATION SUCCESSFUL FOR SUBSCRIPTION PATCH ===');
    console.log('User ID:', user.id);

    const body = await request.json();
    const { currentPlan } = body;

    // Validate the plan
    const validPlans = ['FREE', 'STARTER', 'PLUS', 'PRO', 'PROFESSIONAL'];
    if (!validPlans.includes(currentPlan)) {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      );
    }

    // Update the user's subscription plan in the database
    const { error } = await supabase
      .from('users')
      .update({ current_plan: currentPlan })
      .eq('id', user.id);

    if (error) {
      console.error('Database error updating user plan:', error);
      return NextResponse.json(
        { error: 'Failed to update subscription plan' },
        { status: 500 }
      );
    }

    console.log(`User ${user.id} updated subscription to ${currentPlan}`);

    return NextResponse.json({
      success: true,
      currentPlan,
      userId: user.id,
      message: `Successfully updated to ${currentPlan} plan`
    });

  } catch (error) {
    console.error('Subscription PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
