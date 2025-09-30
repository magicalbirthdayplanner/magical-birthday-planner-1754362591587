import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Get all cookies to see what's present
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('supabase') || 
      cookie.name.includes('auth') ||
      cookie.name.includes('sb-')
    )
    
    // Try to get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session_status: {
        has_session: !!session,
        has_user: !!user,
        session_error: sessionError?.message,
        user_error: userError?.message,
        user_email: user?.email,
        user_id: user?.id,
        session_expires_at: session?.expires_at
      },
      cookies_analysis: {
        total_cookies: allCookies.length,
        auth_related_cookies: authCookies.length,
        cookie_names: authCookies.map(c => c.name),
        has_supabase_cookies: authCookies.some(c => c.name.includes('supabase'))
      },
      environment: {
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        base_url: process.env.NEXT_PUBLIC_BASE_URL,
        node_env: process.env.NODE_ENV
      },
      diagnosis: {
        likely_issue: authCookies.length === 0 ? 
          'No auth cookies found - OAuth session not created/persisted' :
          'Auth cookies present but session invalid',
        recommended_action: authCookies.length === 0 ? 
          'Check Supabase Site URL configuration' :
          'Check cookie domain and session validity'
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      diagnosis: 'Session debugging failed - check server configuration'
    }, { status: 500 })
  }
}