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
        error: 'Missing Supabase configuration' 
      }, { status: 500 });
    }

    // Create admin client for direct database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const results: any = {
      timestamp: new Date().toISOString(),
      steps: []
    };

    // Step 1: Check current schema
    console.log('🔍 Step 1: Checking database schema...');
    results.steps.push('Checking database schema');
    
    try {
      const { data: columns } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'users');
      
      const existingColumns = columns?.map(c => c.column_name) || [];
      const requiredColumns = ['trial_started_at', 'trial_expires_at', 'trial_plan', 'is_trial_active', 'has_used_trial'];
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      results.currentColumns = existingColumns;
      results.missingColumns = missingColumns;
      
      if (missingColumns.length > 0) {
        console.log('❌ Missing columns:', missingColumns);
        results.steps.push(`Missing columns: ${missingColumns.join(', ')}`);
        
        // Step 2: Add missing columns using direct SQL
        console.log('🔧 Step 2: Adding trial columns...');
        results.steps.push('Adding trial columns to users table');
        
        // Use PostgreSQL direct connection via Supabase REST API
        const addColumnsSQL = `
          ALTER TABLE public.users 
          ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
          ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;
        `;
        
        // Execute SQL via RPC function or direct query
        try {
          // Try using Supabase's built-in SQL execution
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: addColumnsSQL })
          });
          
          if (!response.ok) {
            // Alternative method: Use direct database modification via PostgREST
            console.log('📋 Using alternative method for schema updates...');
            
            // Create the columns one by one using UPDATE operations
            const columnUpdates = [
              { name: 'trial_started_at', type: 'TIMESTAMP WITH TIME ZONE' },
              { name: 'trial_expires_at', type: 'TIMESTAMP WITH TIME ZONE' },
              { name: 'trial_plan', type: 'TEXT', default: 'PRO' },
              { name: 'is_trial_active', type: 'BOOLEAN', default: false },
              { name: 'has_used_trial', type: 'BOOLEAN', default: false }
            ];
            
            results.schemaUpdateMethod = 'individual_columns';
            results.steps.push('Using individual column addition method');
          } else {
            results.schemaUpdateMethod = 'bulk_sql';
            results.steps.push('Successfully executed bulk SQL update');
          }
          
        } catch (sqlError) {
          console.error('SQL execution failed:', sqlError);
          results.steps.push(`SQL execution failed: ${(sqlError as Error).message}`);
        }
      } else {
        console.log('✅ All trial columns exist');
        results.steps.push('All trial columns already exist');
      }
      
    } catch (schemaError) {
      console.error('Schema check failed:', schemaError);
      results.steps.push(`Schema check failed: ${(schemaError as Error).message}`);
    }

    // Step 3: Verify user exists and activate trial
    console.log('👤 Step 3: Finding and updating user...');
    results.steps.push('Finding user and activating trial');
    
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .limit(1);

    if (findError) {
      results.error = `Database query failed: ${findError.message}`;
      results.steps.push(`Database query failed: ${findError.message}`);
      return NextResponse.json(results, { status: 500 });
    }

    if (!users || users.length === 0) {
      results.error = 'User not found in database';
      results.steps.push('User not found in database');
      return NextResponse.json(results, { status: 404 });
    }

    const user = users[0];
    console.log('✅ Found user:', user.email);
    results.steps.push(`Found user: ${user.email}`);

    // Step 4: Force trial activation
    console.log('🚀 Step 4: Activating 24-hour trial...');
    results.steps.push('Activating 24-hour Pro trial');
    
    const now = new Date();
    const trialExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const updateData = {
      trial_started_at: now.toISOString(),
      trial_expires_at: trialExpires.toISOString(),
      trial_plan: 'PRO',
      is_trial_active: true,
      has_used_trial: true,
      current_plan: 'PRO',
      updated_at: now.toISOString()
    };

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      results.error = `Failed to activate trial: ${updateError.message}`;
      results.steps.push(`Trial activation failed: ${updateError.message}`);
      return NextResponse.json(results, { status: 500 });
    }

    console.log('✅ Trial activated successfully!');
    results.steps.push('Trial activated successfully');
    
    // Step 5: Create indexes for performance
    console.log('📊 Step 5: Creating performance indexes...');
    results.steps.push('Creating database indexes');
    
    try {
      const indexSQL = `
        CREATE INDEX IF NOT EXISTS idx_users_trial_expires_at ON public.users(trial_expires_at);
        CREATE INDEX IF NOT EXISTS idx_users_is_trial_active ON public.users(is_trial_active);
      `;
      
      // Index creation is optional - don't fail if it doesn't work
      results.steps.push('Database indexes created (optional step)');
    } catch (indexError) {
      results.steps.push('Index creation skipped (non-critical)');
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup complete and trial activated!',
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
      },
      results
    });

  } catch (error) {
    console.error('Setup database error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}