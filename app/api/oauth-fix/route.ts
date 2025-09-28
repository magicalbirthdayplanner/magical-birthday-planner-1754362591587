import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.magicalbirthdayplanner.com'
    const redirectUri = `${baseUrl}/auth/callback`
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      redirect_uri_mismatch_fix: {
        problem: 'Google OAuth redirect_uri_mismatch error',
        current_redirect_uri: redirectUri,
        google_console_steps: [
          'Go to Google Cloud Console: https://console.cloud.google.com/',
          'Navigate to APIs & Services → Credentials',
          'Find your OAuth 2.0 Client ID for Magical Birthday Planner',
          'Click Edit (pencil icon)',
          'In Authorized redirect URIs section, ensure you have:',
          `  → ${redirectUri}`,
          'Save the changes',
          'Wait 5-10 minutes for changes to propagate'
        ],
        supabase_steps: [
          'Go to Supabase Dashboard: https://supabase.com/dashboard',
          'Select your project',
          'Navigate to Authentication → Providers',
          'Click on Google provider',
          'Ensure the following settings:',
          `  → Site URL: ${baseUrl}`,
          `  → Redirect URLs: ${redirectUri}`,
          'Make sure Google provider is enabled',
          'Save configuration'
        ],
        verification_steps: [
          'After making changes, wait 5-10 minutes',
          'Clear your browser cache and cookies',
          `Test Google sign-in at: ${baseUrl}/signin`,
          'Check browser console for any error messages'
        ]
      },
      environment_check: {
        base_url: baseUrl,
        redirect_uri: redirectUri,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}"