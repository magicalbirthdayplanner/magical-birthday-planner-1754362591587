import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ 
        error: 'Missing Supabase configuration',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!serviceKey
        }
      }, { status: 500 });
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔍 Force trial for user:', userEmail);

    // Check if trial columns exist first
    try {
      const { data: columns } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'users')
        .in('column_name', ['trial_started_at', 'trial_expires_at', 'trial_plan', 'is_trial_active', 'has_used_trial']);
      
      const existingColumns = columns?.map(c => c.column_name) || [];
      const missingColumns = ['trial_started_at', 'trial_expires_at', 'trial_plan', 'is_trial_active', 'has_used_trial']
        .filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        return NextResponse.json({
          error: 'Database not ready - trial columns missing',
          missingColumns,
          needsSetup: true
        }, { status: 400 });
      }
    } catch (schemaError) {
      console.error('Schema check failed:', schemaError);
    }

    // Find user by email
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .limit(1);

    if (findError) {
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: findError.message 
      }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ 
        error: 'User not found in database',
        email: userEmail
      }, { status: 404 });
    }

    const user = users[0];
    console.log('👤 Found user:', user.email, 'Current plan:', user.current_plan);

    // Activate 24-hour trial
    const now = new Date();
    const trialExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: updatedUser, error: updateError } = await supabaseAdmin
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
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to activate trial', 
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '24-hour trial activated!',
      user: {
        email: userEmail,
        currentPlan: 'PRO',
        trialStarted: now.toISOString(),
        trialExpires: trialExpires.toISOString(),
        timeRemainingMinutes: 24 * 60
      },
      updatedUser: {
        current_plan: updatedUser.current_plan,
        is_trial_active: updatedUser.is_trial_active,
        trial_expires_at: updatedUser.trial_expires_at
      }
    });

  } catch (error) {
    console.error('Force trial error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}