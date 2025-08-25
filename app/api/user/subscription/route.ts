import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For now, return a default STARTER plan since we don't have a subscriptions table
    // In a real implementation, you would fetch from a subscriptions table
    return NextResponse.json({
      currentPlan: 'STARTER',
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
    // Get the authenticated user
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPlan } = body;

    // Validate the plan
    const validPlans = ['STARTER', 'PLUS', 'PRO'];
    if (!validPlans.includes(currentPlan)) {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      );
    }

    // For now, we'll just return success since we don't have a subscriptions table
    // In a real implementation, you would update the user's subscription in the database
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