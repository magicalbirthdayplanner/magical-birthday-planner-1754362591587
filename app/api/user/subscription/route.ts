import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient, handleSupabaseResponse } from '@/lib/supabase-client';

export async function GET() {
  try {
    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current subscription plan from Supabase
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('current_plan')
      .eq('id', user.id)
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database error:', dbError);
    }

    return NextResponse.json({
      currentPlan: dbUser?.current_plan || 'FREE'
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerComponentClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPlan } = await request.json();

    // Validate the plan
    const validPlans = ['FREE', 'STARTER', 'PROFESSIONAL'];
    if (!validPlans.includes(currentPlan)) {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      );
    }

    // Update user's current plan in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ current_plan: currentPlan })
      .eq('id', user.id)
      .select('current_plan')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      currentPlan: updatedUser.current_plan,
      success: true
    });
  } catch (error) {
    console.error('Error updating user subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}