import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// Force dynamic rendering for this API route since it uses cookies
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Get the base URL that will be used for OAuth - ensure proper formatting
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.magicalbirthdayplanner.com').replace(/\/$/, '')
    const redirectTo = `${baseUrl}/auth/callback`
    
    // Validate the URL format
    let urlValidation
    try {
      new URL(redirectTo)
      urlValidation = 'Valid URL format'
    } catch (e) {
      urlValidation = `Invalid URL format: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      oauth_config: {
        expected_redirect_url: redirectTo,
        url_validation: urlValidation,
        base_url: baseUrl,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        node_env: process.env.NODE_ENV
      },
      instructions: {
        message: 'If Google OAuth is failing, check these settings:',
        supabase_steps: [
          '1. Go to Supabase Dashboard → Authentication → Providers → Google',
          '2. Ensure Google provider is enabled',
          '3. Check that redirect URL matches: ' + redirectTo,
          '4. Verify Google Client ID and Secret are configured'
        ],
        google_console_steps: [
          '1. Go to Google Cloud Console → APIs & Services → Credentials',
          '2. Find your OAuth 2.0 Client ID',
          '3. Add authorized redirect URI: ' + redirectTo,
          '4. Ensure authorized JavaScript origins includes: ' + baseUrl
        ]
      },
      troubleshooting: {
        common_issues: [
          'Redirect URL mismatch between Google Console and Supabase',
          'Google OAuth client not configured for web application',
          'Missing authorized redirect URIs in Google Console',
          'Supabase Google provider disabled or misconfigured'
        ]
      }
    })
    
  } catch (error) {
    console.error('OAuth config check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}