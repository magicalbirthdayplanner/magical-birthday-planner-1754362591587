import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      issue: 'Google OAuth redirecting to Supabase instead of application',
      current_problem: {
        description: 'Google is redirecting to https://hgczncztmdqtfhqimfar.supabase.co/auth/v1/callback instead of https://www.magicalbirthdayplanner.com/auth/callback',
        error: 'site url is improperly formatted',
        root_cause: 'Supabase Google OAuth provider configuration is incorrect'
      },
      environment_check: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
        NEXT_PUBLIC_BASE_URL_TRIMMED: (process.env.NEXT_PUBLIC_BASE_URL || '').trim(),
        expected_app_callback: 'https://www.magicalbirthdayplanner.com/auth/callback',
        actual_supabase_callback: 'https://hgczncztmdqtfhqimfar.supabase.co/auth/v1/callback',
        detected_issue: process.env.NEXT_PUBLIC_BASE_URL?.includes('\n') ? 'NEWLINE CHARACTER DETECTED' : 'No obvious formatting issues'
      },
      fix_required: {
        step1: 'Go to Supabase Dashboard → Authentication → Providers → Google',
        step2: 'Check the Site URL field - it should be: https://www.magicalbirthdayplanner.com',
        step3: 'Check Redirect URLs - it should contain: https://www.magicalbirthdayplanner.com/auth/callback',
        step4: 'Make sure Google Console has the correct redirect URI: https://www.magicalbirthdayplanner.com/auth/callback',
        critical_note: 'Google should NEVER redirect directly to the Supabase URL'
      },
      supabase_settings_check: {
        site_url: 'Should be set to: https://www.magicalbirthdayplanner.com',
        redirect_urls: 'Should include: https://www.magicalbirthdayplanner.com/auth/callback',
        google_oauth_enabled: 'Should be enabled with correct Client ID and Secret'
      },
      google_console_check: {
        authorized_redirect_uris: [
          'https://www.magicalbirthdayplanner.com/auth/callback',
          'NOT https://hgczncztmdqtfhqimfar.supabase.co/auth/v1/callback'
        ],
        authorized_javascript_origins: [
          'https://www.magicalbirthdayplanner.com'
        ]
      }
    }
    
    return NextResponse.json(diagnosis, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}