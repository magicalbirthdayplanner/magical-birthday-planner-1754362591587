import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.magicalbirthdayplanner.com'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      problem_identified: {
        issue: 'Supabase is using its own callback URL instead of your app callback URL',
        google_receives: 'https://hgczncztmdqtfhqimfar.supabase.co/auth/v1/callback',
        should_receive: `${baseUrl}/auth/callback`,
        root_cause: 'Supabase Site URL is not configured correctly'
      },
      fix_instructions: {
        step1: {
          action: 'Go to Supabase Dashboard',
          url: 'https://supabase.com/dashboard/projects',
          description: 'Login and select your project'
        },
        step2: {
          action: 'Navigate to Settings → API',
          description: 'This is where the Site URL configuration is located'
        },
        step3: {
          action: 'Update Site URL',
          current_wrong_value: 'Likely empty or set to Supabase URL',
          correct_value: baseUrl,
          critical_note: 'This MUST be your application domain, not Supabase domain'
        },
        step4: {
          action: 'Navigate to Authentication → Providers → Google',
          settings_to_verify: {
            site_url: baseUrl,
            redirect_urls: `${baseUrl}/auth/callback`,
            google_provider: 'Must be enabled with valid Client ID and Secret'
          }
        },
        step5: {
          action: 'Save all settings and wait 5-10 minutes',
          note: 'Configuration changes need time to propagate'
        }
      },
      supabase_settings_checklist: {
        api_settings: {
          site_url: `MUST be: ${baseUrl}`,
          project_url: `Will remain: ${supabaseUrl}`,
          note: 'Do NOT confuse Site URL with Project URL'
        },
        auth_provider_settings: {
          google_enabled: 'Must be ON/enabled',
          client_id: 'From Google Cloud Console',
          client_secret: 'From Google Cloud Console',
          redirect_urls: `Must include: ${baseUrl}/auth/callback`
        }
      },
      verification_after_fix: [
        'Clear browser cache and cookies',
        'Wait 5-10 minutes after saving settings',
        `Test Google OAuth at: ${baseUrl}/signin`,
        'Check that redirect URL in error (if any) now shows your domain'
      ]
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}