import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const results: Array<{
      step: string
      status: string
      details: string
    }> = []

    // Step 1: List all auth users to find our OAuth user
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      results.push({
        step: 'List Auth Users',
        status: 'Failed',
        details: authError.message
      })
    } else {
      results.push({
        step: 'List Auth Users',
        status: 'Success',
        details: `Found ${authUsers.users.length} auth users`
      })
      
      // Look for our target user
      const targetUser = authUsers.users.find(u => u.email === 'magicalbirthdayplanner@gmail.com')
      
      if (targetUser) {
        results.push({
          step: 'Find Target User',
          status: 'Found',
          details: `User ID: ${targetUser.id}, Email: ${targetUser.email}`
        })
        
        // Step 2: Create user record in custom users table
        const { data: userRecord, error: userError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: targetUser.id,
            email: targetUser.email,
            full_name: targetUser.user_metadata?.full_name || 'Magical Birthday Planner User',
            avatar_url: targetUser.user_metadata?.avatar_url,
            current_plan: 'FREE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select()
        
        if (userError) {
          results.push({
            step: 'Create User Record',
            status: 'Failed',
            details: userError.message
          })
        } else {
          results.push({
            step: 'Create User Record',
            status: 'Success',
            details: `User record created: ${JSON.stringify(userRecord)}`
          })
        }
      } else {
        results.push({
          step: 'Find Target User',
          status: 'Not Found',
          details: 'magicalbirthdayplanner@gmail.com not found in auth.users - user needs to complete OAuth first'
        })
      }
    }

    // Step 3: Fix RLS policies
    const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Temporarily disable RLS
        ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
        
        -- Drop existing restrictive policies
        DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
        
        -- Re-enable RLS
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        
        -- Create permissive policy
        CREATE POLICY "Allow authenticated users full access" ON public.users
          FOR ALL USING (auth.uid() IS NOT NULL)
          WITH CHECK (auth.uid() IS NOT NULL);
      `
    })
    
    if (rlsError) {
      results.push({
        step: 'Fix RLS Policies',
        status: 'Failed',
        details: rlsError.message
      })
    } else {
      results.push({
        step: 'Fix RLS Policies',
        status: 'Success',
        details: 'RLS policies updated for authenticated users'
      })
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      results: results,
      success: results.every(r => r.status === 'Success' || r.status === 'Found'),
      next_steps: [
        'Test OAuth flow again',
        'Check if user appears in users table',
        'Welcome screen should now appear for new users'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}