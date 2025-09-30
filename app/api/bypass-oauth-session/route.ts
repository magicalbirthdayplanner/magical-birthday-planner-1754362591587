import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { userEmail } = await request.json()
    
    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email required'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find the OAuth user in auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to access auth users'
      }, { status: 500 })
    }

    const targetUser = authUsers.users.find(u => u.email === userEmail)
    
    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: 'OAuth user not found'
      }, { status: 404 })
    }

    // Generate a magic link session for this user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email!,
      options: {
        redirectTo: 'https://www.magicalbirthdayplanner.com/dashboard'
      }
    })

    if (sessionError) {
      return NextResponse.json({
        success: false,
        error: sessionError.message
      }, { status: 500 })
    }

    // Create a session using the magic link token
    const magicLinkUrl = new URL(sessionData.properties.action_link)
    const token = magicLinkUrl.searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Failed to extract session token'
      }, { status: 500 })
    }

    // Exchange the token for a session
    const { data: sessionExchange, error: exchangeError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink'
    })

    if (exchangeError) {
      return NextResponse.json({
        success: false,
        error: exchangeError.message
      }, { status: 500 })
    }

    // Check if this is a new user
    const userCreatedAt = new Date(targetUser.created_at)
    const now = new Date()
    const minutesSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60)
    const isRecentlyCreated = minutesSinceCreation <= 30

    console.log('🔍 New user analysis for', targetUser.email, {
      created_at: targetUser.created_at,
      minutes_since_creation: Math.round(minutesSinceCreation),
      is_recently_created: isRecentlyCreated
    })

    // Check if user has parties
    const { data: userParties } = await supabaseAdmin
      .from('parties')
      .select('id')
      .eq('user_id', targetUser.id)
      .limit(1)

    const hasParties = userParties && userParties.length > 0
    
    // Check if user record exists in users table
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('created_at, full_name')
      .eq('id', targetUser.id)
      .single()
    
    const hasUserRecord = userRecord && userRecord.full_name
    
    // TEMPORARY: Force welcome screen for testing magicalbirthdayplanner@gmail.com
    let isNewUser = !hasParties // Default logic: no parties = new user
    if (userEmail === 'magicalbirthdayplanner@gmail.com') {
      isNewUser = true
      console.log('🎯 FORCED welcome screen for test user')
    }

    console.log('🎯 User analysis result:', {
      has_parties: hasParties,
      has_user_record: hasUserRecord,
      user_full_name: userRecord?.full_name,
      is_new_user: isNewUser,
      force_welcome: 'TESTING_DEPLOYMENT',
      redirect_url: isNewUser ? '/signin?show_welcome=true' : '/dashboard'
    })

    // Set session cookies manually
    const response = NextResponse.json({
      success: true,
      message: 'Session created successfully',
      user: sessionExchange.user,
      is_new_user: isNewUser,
      user_analysis: {
        recently_created: isRecentlyCreated,
        has_parties: hasParties,
        minutes_since_creation: Math.round(minutesSinceCreation)
      },
      redirect_to: isNewUser ? '/signin?show_welcome=true' : '/dashboard'
    })

    // Set the session cookies
    if (sessionExchange.session) {
      response.cookies.set('supabase-auth-token', sessionExchange.session.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: sessionExchange.session.expires_in || 3600,
        path: '/'
      })
      
      response.cookies.set('supabase-refresh-token', sessionExchange.session.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
      })
    }

    return response

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'OAuth session bypass for when callback URLs cannot be edited',
    usage: 'POST with { "userEmail": "user@example.com" }'
  })
}