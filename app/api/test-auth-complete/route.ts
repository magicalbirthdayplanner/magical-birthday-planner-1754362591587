import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Get all cookies to check what's being set
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('supabase') || 
      cookie.name.includes('auth') ||
      cookie.name.includes('sb-')
    )
    
    // Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Try to manually create user record if authenticated
    let userInsertResult: {
      success: boolean
      error?: string
      data?: any
    } | null = null
    if (user) {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          avatar_url: user.user_metadata?.avatar_url,
          updated_at: new Date().toISOString()
        })
        .select()
      
      userInsertResult = {
        success: !error,
        error: error?.message,
        data: data
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      authentication: {
        hasSession: !!session,
        hasUser: !!user,
        sessionError: sessionError?.message,
        userError: userError?.message,
        userId: user?.id,
        userEmail: user?.email,
        userMetadata: user?.user_metadata
      },
      cookies: {
        total: allCookies.length,
        authRelated: authCookies.map(c => ({ name: c.name, hasValue: !!c.value })),
        supabaseCookies: authCookies.filter(c => c.name.includes('supabase'))
      },
      userInsert: userInsertResult,
      environment: {
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}