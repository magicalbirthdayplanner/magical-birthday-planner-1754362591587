import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's trial status from the database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select(`
        id,
        trial_started_at,
        trial_expires_at,
        trial_plan,
        is_trial_active,
        has_used_trial,
        current_plan,
        created_at
      `)
      .eq('id', user.id)
      .single();

    if (dbError) {
      console.error('Database error fetching trial status:', dbError);
      return NextResponse.json({ error: 'Failed to fetch trial status' }, { status: 500 });
    }

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate trial status
    const now = new Date();
    const trialStarted = userData.trial_started_at ? new Date(userData.trial_started_at) : null;
    const trialExpires = userData.trial_expires_at ? new Date(userData.trial_expires_at) : null;
    
    let trialStatus = 'NOT_STARTED';
    let timeRemainingMinutes = 0;
    let isTrialActive = false;

    if (userData.has_used_trial) {
      if (userData.is_trial_active && trialExpires && trialExpires > now) {
        trialStatus = 'ACTIVE';
        timeRemainingMinutes = Math.max(0, Math.floor((trialExpires.getTime() - now.getTime()) / 60000));
        isTrialActive = true;
      } else {
        trialStatus = 'EXPIRED';
        isTrialActive = false;
      }
    }

    // Check if trial has expired and update database if needed
    if (userData.is_trial_active && trialExpires && trialExpires <= now) {
      try {
        await supabase
          .from('users')
          .update({
            is_trial_active: false,
            current_plan: 'FREE',
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        isTrialActive = false;
        trialStatus = 'EXPIRED';
      } catch (expireError) {
        console.error('Error updating expired trial:', expireError);
      }
    }

    return NextResponse.json({
      userId: user.id,
      trialStatus,
      isTrialActive,
      hasUsedTrial: userData.has_used_trial,
      trialPlan: userData.trial_plan || 'PRO',
      trialStartedAt: userData.trial_started_at,
      trialExpiresAt: userData.trial_expires_at,
      timeRemainingMinutes,
      currentPlan: userData.current_plan,
      userCreatedAt: userData.created_at
    });

  } catch (error) {
    console.error('Error fetching trial status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'start_trial') {
      // Check if user has already used their trial
      const { data: userData, error: checkError } = await supabase
        .from('users')
        .select('has_used_trial, is_trial_active')
        .eq('id', user.id)
        .single();

      if (checkError) {
        console.error('Error checking trial eligibility:', checkError);
        return NextResponse.json({ error: 'Failed to check trial eligibility' }, { status: 500 });
      }

      if (userData?.has_used_trial) {
        return NextResponse.json({ 
          error: 'Trial already used',
          message: 'You have already used your 24-hour free trial'
        }, { status: 400 });
      }

      // Start the 24-hour trial
      const now = new Date();
      const trialExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      const { error: updateError } = await supabase
        .from('users')
        .update({
          trial_started_at: now.toISOString(),
          trial_expires_at: trialExpires.toISOString(),
          trial_plan: 'PRO',
          is_trial_active: true,
          has_used_trial: true,
          current_plan: 'PRO',
          updated_at: now.toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error starting trial:', updateError);
        return NextResponse.json({ error: 'Failed to start trial' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '24-hour free trial started!',
        trialStartedAt: now.toISOString(),
        trialExpiresAt: trialExpires.toISOString(),
        trialPlan: 'PRO',
        timeRemainingMinutes: 24 * 60
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error managing trial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}