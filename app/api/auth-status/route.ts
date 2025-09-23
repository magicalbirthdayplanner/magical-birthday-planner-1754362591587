import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// Force dynamic rendering for this API route since it uses cookies
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Check current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    // Check user
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      },
      session: {
        hasSession: !!sessionData.session,
        sessionError: sessionError?.message || null,
        sessionExpiry: sessionData.session?.expires_at || null
      },
      user: {
        hasUser: !!userData.user,
        userError: userError?.message || null,
        userId: userData.user?.id || null,
        userEmail: userData.user?.email || null
      }
    })
    
  } catch (error) {
    console.error('Auth status check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}