import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  return NextResponse.json({
    message: 'This endpoint requires POST method',
    usage: 'POST /api/auto-fix-oauth',
    timestamp: new Date().toISOString()
  })
}

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Check if user is currently authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        message: 'Please sign in with Google first',
        redirect: 'https://www.magicalbirthdayplanner.com/signin',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Check if user exists in users table
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: 'User record already exists',
        user: existingUser,
        action: 'no_action_needed',
        timestamp: new Date().toISOString()
      })
    }
    
    // Create the user record
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
      return NextResponse.json({
        success: false,
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        user_info: {
          id: user.id,
          email: user.email
        },
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'User record created successfully',
      user: newUser,
      action: 'user_created',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}