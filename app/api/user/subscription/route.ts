import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { prisma, connectToPrisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  try {
    // Add timeout wrapper for entire operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 6000)
    );

    const operationPromise = async () => {
      const supabase = createServerComponentClient({ cookies });
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Test database connection before proceeding
      const isConnected = await connectToPrisma();
      if (!isConnected) {
        console.error('Failed to connect to database for subscription fetch');
        return NextResponse.json(
          { error: 'Database connection failed' },
          { status: 503 }
        );
      }

      // Get user's current subscription plan with upsert to handle missing users
      const dbUser = await prisma.user.upsert({
        where: { email: user.email! },
        update: {},
        create: {
          email: user.email!,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          displayName: user.user_metadata?.display_name || '',
          currentPlan: 'FREE',
          emailNotifications: true,
          partyReminders: true,
          marketingEmails: false
        },
        select: { currentPlan: true }
      });

      return NextResponse.json({
        currentPlan: dbUser.currentPlan
      });
    };

    // Race between operation and timeout
    const result = await Promise.race([operationPromise(), timeoutPromise]);
    return result as NextResponse;
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    
    // Enhanced error categorization
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408 }
      );
    }
    
    if ((error as any).code === 'P1001' || (error as any).code === 'P1008' || (error as any).code === 'P1009') {
      return NextResponse.json(
        { error: 'Database connection issue - please try again' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Add timeout wrapper for PATCH operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 6000)
    );

    const operationPromise = async () => {
      const supabase = createServerComponentClient({ cookies });
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Test database connection before proceeding
      const isConnected = await connectToPrisma();
      if (!isConnected) {
        console.error('Failed to connect to database for subscription update');
        return NextResponse.json(
          { error: 'Database connection failed' },
          { status: 503 }
        );
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

      // Update user's current plan with upsert to handle missing users
      const updatedUser = await prisma.user.upsert({
        where: { email: user.email! },
        update: { currentPlan },
        create: {
          email: user.email!,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          displayName: user.user_metadata?.display_name || '',
          currentPlan,
          emailNotifications: true,
          partyReminders: true,
          marketingEmails: false
        },
        select: { currentPlan: true }
      });

      return NextResponse.json({
        currentPlan: updatedUser.currentPlan,
        success: true
      });
    };

    // Race between operation and timeout
    const result = await Promise.race([operationPromise(), timeoutPromise]);
    return result as NextResponse;
  } catch (error) {
    console.error('Error updating user subscription:', error);
    
    // Enhanced error categorization
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408 }
      );
    }
    
    if ((error as any).code === 'P1001' || (error as any).code === 'P1008' || (error as any).code === 'P1009') {
      return NextResponse.json(
        { error: 'Database connection issue - please try again' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}