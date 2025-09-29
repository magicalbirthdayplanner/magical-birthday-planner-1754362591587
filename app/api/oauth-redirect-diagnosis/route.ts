import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.magicalbirthdayplanner.com'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const redirectUri = `${baseUrl}/auth/callback`
    
    // Clean base URL (remove trailing slashes)
    const cleanBaseUrl = baseUrl.replace(/\/$/, '')
    const properRedirectUri = `${cleanBaseUrl}/auth/callback`
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      oauth_redirect_diagnosis: {
        current_configuration: {
          base_url: baseUrl,
          clean_base_url: cleanBaseUrl,
          redirect_uri: redirectUri,
          proper_redirect_uri: properRedirectUri,
          supabase_project_url: supabaseUrl,
          environment: process.env.NODE_ENV
        },
        
        expected_google_console_config: {
          authorized_redirect_uris: [
            properRedirectUri,
            // Include localhost for development if needed
            "http://localhost:3000/auth/callback"
          ],
          authorized_javascript_origins: [
            cleanBaseUrl,
            "http://localhost:3000"
          ]
        },
        
        expected_supabase_config: {
          site_url: cleanBaseUrl,
          redirect_urls: properRedirectUri,
          google_provider_enabled: true,
          note: "Site URL should be your app domain, NOT the Supabase project URL"
        },
        
        common_redirect_issues: {
          trailing_slash_mismatch: {
            problem: "URL ends with / vs without /",
            fix: "Ensure consistent format in both Google Console and Supabase"
          },
          http_vs_https: {
            problem: "Protocol mismatch between config and actual requests",
            fix: "Always use HTTPS for production"
          },
          supabase_url_confusion: {
            problem: "Using Supabase project URL instead of app domain",
            fix: `Use ${cleanBaseUrl} NOT ${supabaseUrl}`
          },
          case_sensitivity: {
            problem: "Uppercase/lowercase differences in URL paths",
            fix: "Ensure exact case match: /auth/callback"
          }
        },
        
        verification_steps: [
          {
            step: 1,
            action: "Check Google Cloud Console",
            details: [
              "Go to https://console.cloud.google.com/",
              "Navigate to APIs & Services → Credentials",
              "Find OAuth 2.0 Client ID for Magical Birthday Planner",
              `Verify Authorized redirect URIs contains: ${properRedirectUri}`,
              `Verify Authorized JavaScript origins contains: ${cleanBaseUrl}`
            ]
          },
          {
            step: 2,
            action: "Check Supabase Dashboard",
            details: [
              "Go to https://supabase.com/dashboard",
              "Navigate to Authentication → Providers → Google",
              `Verify Site URL is set to: ${cleanBaseUrl}`,
              `Verify Redirect URLs contains: ${properRedirectUri}`,
              "Ensure Google provider is enabled"
            ]
          },
          {
            step: 3,
            action: "Clear cache and test",
            details: [
              "Clear browser cache and cookies",
              "Wait 5-10 minutes for changes to propagate",
              "Test OAuth flow again"
            ]
          }
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