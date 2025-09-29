import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.magicalbirthdayplanner.com'
    const redirectUri = `${baseUrl}/auth/callback`
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      redirect_analysis: {
        configured_base_url: baseUrl,
        expected_redirect_uri: redirectUri,
        instructions: [
          'Copy the redirect_uri below and check if it EXACTLY matches what you have in:',
          '1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs',
          '2. Supabase Dashboard → Authentication → Providers → Google → Redirect URLs',
          '',
          'Common issues:',
          '- Extra trailing slashes: /auth/callback/ vs /auth/callback',
          '- HTTP vs HTTPS mismatch',
          '- www vs non-www domain differences',
          '- Case sensitivity in URL paths'
        ]
      },
      exact_redirect_uri_to_copy: redirectUri,
      verification_checklist: {
        google_console: [
          'Login to Google Cloud Console',
          'Navigate to the correct project',
          'Go to APIs & Services → Credentials',
          'Find your OAuth 2.0 Client ID',
          'In Authorized redirect URIs, ensure EXACT match:',
          redirectUri,
          'Save configuration'
        ],
        supabase_dashboard: [
          'Login to Supabase Dashboard',
          'Select correct project',
          'Go to Authentication → Providers',
          'Click Google provider',
          'In Redirect URLs field, ensure EXACT match:',
          redirectUri,
          'Ensure Google provider is enabled',
          'Save configuration'
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