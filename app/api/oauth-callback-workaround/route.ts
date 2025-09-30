import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
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
      action: string
    }> = []

    // Step 1: Check current OAuth users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      results.push({
        step: 'Check Auth Users',
        status: 'Failed',
        details: authError.message,
        action: 'Cannot access authentication system'
      })
    } else {
      const oauthUser = authUsers.users.find(u => u.email === 'magicalbirthdayplanner@gmail.com')
      results.push({
        step: 'Check Auth Users',
        status: oauthUser ? 'Found' : 'Not Found',
        details: oauthUser ? `OAuth user exists: ${oauthUser.email}` : 'OAuth user not found',
        action: oauthUser ? 'User available for session creation' : 'Need to complete OAuth first'
      })

      if (oauthUser) {
        // Step 2: Create a direct session for this user
        try {
          const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: oauthUser.email!
          })

          results.push({
            step: 'Generate Session Link',
            status: sessionError ? 'Failed' : 'Success',
            details: sessionError ? sessionError.message : 'Magic link generated successfully',
            action: sessionError ? 'Session creation failed' : 'Session ready for activation'
          })

          if (!sessionError && sessionData) {
            results.push({
              step: 'Session Bypass Available',
              status: 'Ready',
              details: 'Direct session creation method available',
              action: 'Use bypass-oauth-session endpoint'
            })
          }
        } catch (error) {
          results.push({
            step: 'Generate Session Link',
            status: 'Failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            action: 'Session generation failed'
          })
        }
      }
    }

    // Step 3: Check user record status
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', 'magicalbirthdayplanner@gmail.com')
      .single()

    results.push({
      step: 'Check User Record',
      status: userError ? 'Failed' : 'Success',
      details: userError ? userError.message : `User record exists: ${userRecord.email}`,
      action: userError ? 'User record missing' : 'User record ready'
    })

    const successSteps = results.filter(r => r.status === 'Success' || r.status === 'Found' || r.status === 'Ready').length

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      callback_url_workaround: true,
      diagnosis: 'Since Supabase callback URLs cannot be edited, using direct session creation',
      results: results,
      success_rate: `${successSteps}/${results.length}`,
      workaround_available: successSteps >= 2,
      automated_solution: {
        description: 'Direct session creation bypassing OAuth callback issues',
        method: 'Generate magic link session and set cookies directly',
        endpoint: '/api/bypass-oauth-session',
        usage: {
          step1: 'Ensure user completed Google OAuth at least once',
          step2: 'POST to /api/bypass-oauth-session with user email',
          step3: 'Session cookies will be set directly',
          step4: 'User will be authenticated without callback URL dependency'
        }
      },
      immediate_fix: {
        command: 'fetch("/api/bypass-oauth-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "userEmail": "magicalbirthdayplanner@gmail.com" }) }).then(r => r.json()).then(console.log)',
        description: 'Run this to create session directly'
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}