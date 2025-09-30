import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    
    // Expected configurations
    const expectedRedirectUrl = `${baseUrl}/auth/callback`
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      current_config: {
        supabase_project_url: supabaseUrl,
        app_base_url: baseUrl,
        expected_redirect_url: expectedRedirectUrl
      },
      required_supabase_settings: {
        site_url: baseUrl,
        redirect_urls: [expectedRedirectUrl],
        google_provider: {
          enabled: true,
          client_id: "Must be set",
          client_secret: "Must be set"
        }
      },
      critical_issue: {
        problem: "Session not persisting after OAuth",
        most_likely_cause: "Supabase Site URL misconfiguration",
        fix_instructions: [
          "1. Go to Supabase Dashboard → Settings → API",
          `2. Set Site URL to: ${baseUrl}`,
          "3. Go to Authentication → Providers → Google",
          `4. Ensure Redirect URLs contains: ${expectedRedirectUrl}`,
          "5. Ensure Google provider is enabled",
          "6. Wait 5-10 minutes for changes to propagate"
        ]
      },
      debug_steps: [
        "After making Supabase changes, test OAuth again",
        "Check browser Network tab during OAuth for redirect issues",
        "Look for 'redirect_uri_mismatch' or similar errors",
        "Verify cookies are being set in browser dev tools"
      ]
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}