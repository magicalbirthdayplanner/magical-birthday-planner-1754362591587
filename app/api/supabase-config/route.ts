import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.magicalbirthdayplanner.com'
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      supabase_config: {
        url: supabaseUrl || 'NOT_SET',
        key_present: !!supabaseKey,
        key_format_valid: supabaseKey?.startsWith('eyJ') || false
      },
      oauth_settings: {
        expected_site_url: baseUrl,
        expected_callback_url: `${baseUrl}/auth/callback`,
        current_environment: process.env.NODE_ENV
      },
      checklist: {
        step1: 'Go to Supabase Dashboard → Authentication → Providers',
        step2: 'Click on Google provider',
        step3: `Set Site URL to: ${baseUrl}`,
        step4: `Add Redirect URL: ${baseUrl}/auth/callback`,
        step5: 'Enable Google provider with Client ID and Secret',
        step6: 'Save configuration'
      },
      troubleshooting: {
        if_still_500_error: [
          'Check Google Cloud Console → APIs & Services → Credentials',
          `Ensure authorized redirect URI contains: ${baseUrl}/auth/callback`,
          'Verify OAuth client is configured for web application',
          'Check that Google OAuth is enabled in Supabase'
        ]
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}