import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current subscription plan
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { currentPlan: true }
    });

    return NextResponse.json({
      currentPlan: dbUser?.currentPlan || 'FREE'
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
    const supabase = createServerComponentClient({ cookies });
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

    // Update user's current plan
    const updatedUser = await prisma.user.update({
      where: { email: user.email! },
      data: { currentPlan },
      select: { currentPlan: true }
    });

    return NextResponse.json({
      currentPlan: updatedUser.currentPlan,
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