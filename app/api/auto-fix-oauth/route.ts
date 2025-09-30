import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    const results: Array<{
      step: string
      status: string
      details: string
    }> = []

    // Step 1: Check if user is currently authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      results.push({
        step: 'Check Authentication',
        status: 'Failed',
        details: 'No authenticated user found. Please sign in with Google first.'
      })
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        results: results,
        success: false,
        next_action: 'Please sign in with Google OAuth first at https://www.magicalbirthdayplanner.com/signin'
      })
    }
    
    results.push({
      step: 'Check Authentication',
      status: 'Success',
      details: `Authenticated as: ${user.email} (ID: ${user.id})`
    })

    // Step 2: Check if user exists in custom users table
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (queryError && queryError.code !== 'PGRST116') {
      results.push({
        step: 'Check User Record',
        status: 'Failed', 
        details: `Database query error: ${queryError.message}`
      })
    } else if (existingUser) {
      results.push({
        step: 'Check User Record',
        status: 'Found',
        details: `User record already exists: ${JSON.stringify(existingUser)}`
      })
    } else {
      results.push({
        step: 'Check User Record',
        status: 'Not Found',
        details: 'User record needs to be created'
      })
      
      // Step 3: Create the user record
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url,
          current_plan: 'FREE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (insertError) {
        results.push({
          step: 'Create User Record',
          status: 'Failed',
          details: `Insert error: ${insertError.message}`
        })
      } else {
        results.push({
          step: 'Create User Record', 
          status: 'Success',
          details: `User record created: ${JSON.stringify(newUser)}`
        })
      }
    }

    // Step 4: Verify the user can now be found
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email!)
    
    results.push({
      step: 'Verify User Record',
      status: verifyError ? 'Failed' : 'Success',
      details: verifyError ? verifyError.message : `User record verified: ${verifyUser?.length} records found`
    })

    const allSuccess = results.every(r => r.status === 'Success' || r.status === 'Found')

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      results: results,
      success: allSuccess,
      user_info: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata
      },
      next_steps: allSuccess ? [
        'User record is now properly set up',
        'Welcome screen should appear for new users',
        'OAuth flow should work completely'
      ] : [
        'Check RLS policies in Supabase',
        'Verify database permissions',
        'Try manual user creation if needed'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}