import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Check current environment configuration
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.magicalbirthdayplanner.com'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const redirectUri = `${baseUrl}/auth/callback`
    
    // Try to get the actual OAuth URL that Supabase would generate
    let oauthDebugInfo: any = null
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true // This prevents actual redirect
        }
      })
      
      oauthDebugInfo = {
        success: !error,
        error: error?.message || null,
        oauth_url: data?.url || null
      }
    } catch (oauthError) {
      oauthDebugInfo = {
        success: false,
        error: oauthError instanceof Error ? oauthError.message : 'OAuth test failed',
        oauth_url: null
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'Advanced OAuth Diagnosis',
      configuration_check: {
        app_base_url: baseUrl,
        expected_redirect_uri: redirectUri,
        supabase_project_url: supabaseUrl,
        environment: process.env.NODE_ENV
      },
      oauth_test_results: oauthDebugInfo,
      troubleshooting_steps: {
        step1_verify_google_console: {
          description: 'Double-check Google Cloud Console OAuth settings',
          action: 'Go to Google Cloud Console → APIs & Services → Credentials',
          check: [
            `OAuth 2.0 Client ID exists for your project`,
            `Authorized redirect URIs contains: ${redirectUri}`,
            `Authorized JavaScript origins contains: ${baseUrl}`,
            'Client ID and Secret are correctly copied to Supabase'
          ]
        },
        step2_verify_supabase_config: {
          description: 'Verify Supabase Authentication Provider settings',
          action: 'Go to Supabase Dashboard → Authentication → Providers → Google',
          check: [
            'Google provider is enabled (toggle is ON)',
            `Site URL is set to: ${baseUrl}`,
            `Redirect URLs contains: ${redirectUri}`,
            'Google Client ID and Client Secret are filled in',
            'Configuration is saved'
          ]
        },
        step3_cache_and_timing: {
          description: 'Clear cache and wait for propagation',
          actions: [
            'Clear browser cache and cookies completely',
            'Wait 10-15 minutes after configuration changes',
            'Try in incognito/private browsing mode',
            'Test from a different browser'
          ]
        },
        step4_advanced_debugging: {
          description: 'If still not working, check these advanced issues',
          possible_causes: [
            'Multiple Google OAuth apps with conflicting settings',
            'Supabase project using wrong Google credentials',
            'Domain verification issues in Google Console',
            'Supabase service temporarily down or rate limited',
            'Environment variable mismatch between local and production'
          ]
        }
      },
      next_steps: [
        'If OAuth URL generation failed above, the issue is in Supabase configuration',
        'If OAuth URL generation succeeded, the issue is in Google Console configuration',
        'Check browser developer tools Network tab for actual redirect URLs',
        'Compare the redirect URL in the error with the configured one'
      ]
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}