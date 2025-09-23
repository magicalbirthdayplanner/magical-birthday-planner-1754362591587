import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Test the OAuth URL generation without actually redirecting
    const baseUrl = 'https://www.magicalbirthdayplanner.com'
    const redirectTo = `${baseUrl}/auth/callback`
    
    console.log('Testing Google OAuth URL generation...')
    console.log('Base URL:', baseUrl)
    console.log('Redirect URL:', redirectTo)
    
    // This will test if the OAuth configuration works
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          scopes: 'openid email profile'
        }
      })
      
      if (error) {
        console.error('OAuth test error:', error)
        return NextResponse.json({
          success: false,
          error: error.message,
          error_details: error,
          redirect_url: redirectTo,
          timestamp: new Date().toISOString(),
          next_steps: [
            'Check Supabase Dashboard → Authentication → Providers → Google',
            'Ensure Google provider is enabled',
            'Verify Site URL is set to: https://www.magicalbirthdayplanner.com',
            'Verify Redirect URLs contain: ' + redirectTo
          ]
        })
      }
      
      return NextResponse.json({
        success: true,
        message: 'OAuth configuration test successful',
        oauth_url: data?.url || 'URL not provided',
        redirect_url: redirectTo,
        timestamp: new Date().toISOString(),
        note: 'If you see this, the Supabase OAuth configuration is working'
      })
      
    } catch (oauthError) {
      console.error('OAuth configuration error:', oauthError)
      return NextResponse.json({
        success: false,
        error: 'OAuth configuration failed',
        details: oauthError instanceof Error ? oauthError.message : 'Unknown OAuth error',
        redirect_url: redirectTo,
        timestamp: new Date().toISOString()
      })
    }
    
  } catch (error) {
    console.error('Test Google OAuth error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}