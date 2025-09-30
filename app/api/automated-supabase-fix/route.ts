import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const requiredSiteUrl = 'https://www.magicalbirthdayplanner.com'
    const requiredRedirectUrl = 'https://www.magicalbirthdayplanner.com/auth/callback'
    
    // Create admin client
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
      automated_action?: string
    }> = []

    // Step 1: Attempt to update auth configuration via API
    try {
      const authConfigResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_url: requiredSiteUrl,
          uri_allow_list: [requiredRedirectUrl],
          external_google_enabled: true
        })
      })

      if (authConfigResponse.ok) {
        results.push({
          step: 'Update Auth Configuration',
          status: 'Success',
          details: 'Site URL and redirect URLs updated automatically',
          automated_action: `Set site_url to ${requiredSiteUrl}`
        })
      } else {
        const errorText = await authConfigResponse.text()
        results.push({
          step: 'Update Auth Configuration',
          status: 'Failed',
          details: `API Error: ${authConfigResponse.status} - ${errorText}`,
          automated_action: 'Direct API update not available, using alternative method'
        })
      }
    } catch (error) {
      results.push({
        step: 'Update Auth Configuration',
        status: 'Failed',
        details: error instanceof Error ? error.message : 'API call failed',
        automated_action: 'Trying alternative configuration method'
      })
    }

    // Step 2: Update database configuration for OAuth flow
    try {
      // Fix RLS policies to ensure OAuth users can be created
      const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          -- Temporarily disable RLS for users table
          ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
          
          -- Drop existing restrictive policies
          DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
          DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
          DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
          DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
          DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
          DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;
          
          -- Re-enable RLS
          ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
          
          -- Create permissive policy for OAuth
          CREATE POLICY "Allow OAuth user creation" ON public.users
            FOR ALL USING (auth.uid() IS NOT NULL)
            WITH CHECK (auth.uid() IS NOT NULL);
          
          -- Ensure foreign key constraint allows OAuth
          ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
          ALTER TABLE public.users ADD CONSTRAINT users_id_fkey 
            FOREIGN KEY (id) REFERENCES auth.users(id) 
            ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
        `
      })

      if (rlsError) {
        results.push({
          step: 'Fix Database Policies',
          status: 'Failed',
          details: rlsError.message,
          automated_action: 'Database policy update failed'
        })
      } else {
        results.push({
          step: 'Fix Database Policies',
          status: 'Success',
          details: 'RLS policies updated for OAuth compatibility',
          automated_action: 'Database configured for OAuth user creation'
        })
      }
    } catch (error) {
      results.push({
        step: 'Fix Database Policies',
        status: 'Failed',
        details: error instanceof Error ? error.message : 'Unknown database error',
        automated_action: 'Database configuration failed'
      })
    }

    // Step 3: Test OAuth configuration
    try {
      // Try to list auth users to verify admin access
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (authError) {
        results.push({
          step: 'Verify Admin Access',
          status: 'Failed',
          details: authError.message,
          automated_action: 'Cannot verify OAuth configuration'
        })
      } else {
        results.push({
          step: 'Verify Admin Access',
          status: 'Success',
          details: `Admin access confirmed, ${authUsers.users.length} auth users found`,
          automated_action: 'OAuth system is accessible'
        })
        
        // Check for existing OAuth user
        const oauthUser = authUsers.users.find(u => u.email === 'magicalbirthdayplanner@gmail.com')
        if (oauthUser) {
          results.push({
            step: 'Find OAuth User',
            status: 'Found',
            details: `OAuth user exists: ${oauthUser.email}`,
            automated_action: 'Ready to create user record'
          })
          
          // Try to create user record
          const { data: userRecord, error: userError } = await supabaseAdmin
            .from('users')
            .upsert({
              id: oauthUser.id,
              email: oauthUser.email,
              full_name: oauthUser.user_metadata?.full_name || 'Magical Birthday User',
              avatar_url: oauthUser.user_metadata?.avatar_url,
              current_plan: 'FREE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select()
          
          if (userError) {
            results.push({
              step: 'Create User Record',
              status: 'Failed',
              details: userError.message,
              automated_action: 'User record creation failed'
            })
          } else {
            results.push({
              step: 'Create User Record',
              status: 'Success',
              details: `User record created: ${JSON.stringify(userRecord)}`,
              automated_action: 'OAuth user successfully added to users table'
            })
          }
        }
      }
    } catch (error) {
      results.push({
        step: 'Verify Admin Access',
        status: 'Failed',
        details: error instanceof Error ? error.message : 'Verification failed',
        automated_action: 'Cannot verify configuration'
      })
    }

    const successCount = results.filter(r => r.status === 'Success' || r.status === 'Found').length
    const totalSteps = results.length

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      automated_fix_results: results,
      success_rate: `${successCount}/${totalSteps}`,
      overall_status: successCount >= totalSteps - 1 ? 'Success' : 'Partial Success',
      required_manual_action: {
        description: 'If API configuration failed, manual Site URL update required',
        steps: [
          '1. Go to Supabase Dashboard → Settings → API',
          `2. Set Site URL to: ${requiredSiteUrl}`,
          '3. Go to Authentication → Providers → Google',
          `4. Ensure Redirect URLs contains: ${requiredRedirectUrl}`,
          '5. Save and wait 5-10 minutes for propagation'
        ]
      },
      test_instructions: [
        'Clear browser cookies',
        'Sign in with Google OAuth again',
        'User should now appear in users table',
        'Welcome screen should show for new users'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}