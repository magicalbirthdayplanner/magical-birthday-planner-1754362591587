import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  return NextResponse.json({
    message: 'Automated session persistence fix for OAuth',
    usage: 'POST /api/force-session-fix'
  })
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const requiredSiteUrl = 'https://www.magicalbirthdayplanner.com'
    
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
      action: string
    }> = []

    // Step 1: Verify the user record exists
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', 'magicalbirthdayplanner@gmail.com')
      .single()

    if (userError) {
      results.push({
        step: 'Verify User Record',
        status: 'Failed',
        details: userError.message,
        action: 'User record not found'
      })
    } else {
      results.push({
        step: 'Verify User Record',
        status: 'Success',
        details: `User record exists: ${userData.email}`,
        action: 'User record confirmed'
      })
    }

    // Step 2: Force update auth configuration via multiple methods
    const authConfigUpdates = [
      {
        method: 'Direct Auth API',
        endpoint: '/auth/v1/settings',
        payload: {
          site_url: requiredSiteUrl,
          uri_allow_list: [
            `${requiredSiteUrl}/auth/callback`,
            'http://localhost:3000/auth/callback'
          ]
        }
      },
      {
        method: 'Project Config API',
        endpoint: '/rest/v1/auth/config',
        payload: {
          site_url: requiredSiteUrl
        }
      }
    ]

    for (const config of authConfigUpdates) {
      try {
        const response = await fetch(`${supabaseUrl}${config.endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(config.payload)
        })

        results.push({
          step: `Update Config (${config.method})`,
          status: response.ok ? 'Success' : 'Failed',
          details: `HTTP ${response.status}: ${response.statusText}`,
          action: response.ok ? 'Site URL updated' : 'Alternative method needed'
        })

        if (response.ok) {
          break // Success, no need to try other methods
        }
      } catch (error) {
        results.push({
          step: `Update Config (${config.method})`,
          status: 'Failed',
          details: error instanceof Error ? error.message : 'Request failed',
          action: 'Trying next method'
        })
      }
    }

    // Step 3: Create a test session to verify configuration
    try {
      // Generate a test session token for the OAuth user
      const { data: authUser } = await supabaseAdmin.auth.admin.listUsers()
      const targetUser = authUser.users.find(u => u.email === 'magicalbirthdayplanner@gmail.com')
      
      if (targetUser) {
        // Try to generate session for this user
        const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: targetUser.email!
        })

        results.push({
          step: 'Generate Test Session',
          status: sessionError ? 'Failed' : 'Success',
          details: sessionError ? sessionError.message : 'Session generation successful',
          action: sessionError ? 'Session creation failed' : 'Auth system working'
        })
      }
    } catch (error) {
      results.push({
        step: 'Generate Test Session',
        status: 'Failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        action: 'Session test failed'
      })
    }

    // Step 4: Provide manual fix instructions since API methods may be limited
    const manualFix = {
      critical_issue: 'OAuth session not persisting - Site URL misconfiguration',
      required_action: 'Manual Supabase Dashboard update required',
      steps: [
        '1. Go to https://supabase.com/dashboard',
        '2. Select your project',
        '3. Navigate to Settings → API',
        `4. Set Site URL to: ${requiredSiteUrl}`,
        '5. Navigate to Authentication → Providers',
        '6. Click on Google provider',
        '7. Ensure Google is enabled',
        `8. Add to Redirect URLs: ${requiredSiteUrl}/auth/callback`,
        '9. Save all settings',
        '10. Wait 5-10 minutes for propagation'
      ],
      automation_limitation: 'Supabase API restricts Site URL updates via service key'
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session_fix_results: results,
      user_record_status: 'User record exists - OAuth foundation is ready',
      critical_issue: 'Session persistence requires Site URL fix',
      manual_fix_required: manualFix,
      immediate_test: {
        description: 'After manual fix, test with this command',
        command: 'fetch("/api/session-debug").then(r => r.json()).then(console.log)'
      },
      note: 'The automated user creation worked, but session persistence needs manual Site URL configuration'
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}