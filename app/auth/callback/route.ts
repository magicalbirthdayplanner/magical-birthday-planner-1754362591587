import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  console.log('Auth callback received:', { 
    code: code ? 'present' : 'missing', 
    error_code, 
    error_description,
    next,
    origin: requestUrl.origin
  })

  // Handle OAuth errors from provider
  if (error_code) {
    console.error('OAuth provider error:', { error_code, error_description })
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error_description || error_code)}`, requestUrl.origin))
  }

  if (code) {
    const supabase = createServerComponentClient({ cookies })
    
    try {
      console.log('Exchanging code for session...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }

      if (data?.session) {
        console.log('Auth callback successful for user:', data.user?.email)
        
        // Ensure user profile exists
        if (data.user) {
          try {
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '',
                avatar: data.user.user_metadata?.avatar_url,
                updated_at: new Date().toISOString()
              })
            
            if (profileError) {
              console.warn('Profile upsert error (non-blocking):', profileError)
            } else {
              console.log('Profile created/updated successfully')
            }
          } catch (profileErr) {
            console.warn('Profile creation failed (non-blocking):', profileErr)
          }
        }
        
        // Redirect to dashboard or specified next URL
        return NextResponse.redirect(new URL(next, requestUrl.origin))
      } else {
        console.error('No session received after code exchange')
        return NextResponse.redirect(new URL('/signin?error=no_session', requestUrl.origin))
      }
    } catch (err) {
      console.error('Auth callback exception:', err)
      return NextResponse.redirect(new URL('/signin?error=callback_failed', requestUrl.origin))
    }
  }

  // If no code or session, redirect to signin
  console.error('No authorization code received')
  return NextResponse.redirect(new URL('/signin?error=no_code', requestUrl.origin))
}