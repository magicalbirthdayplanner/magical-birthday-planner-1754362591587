import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  let isNewUser = false

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
        
        // Ensure user profile exists and check if user is new
        if (data.user) {
          try {
            // Check if profile already exists
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id, created_at')
              .eq('id', data.user.id)
              .single()
            
            if (!existingProfile) {
              isNewUser = true
              console.log('New user detected, will redirect to party creation wizard')
            }
            
            // Create or update profile
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
          
          // For new users, always redirect to party creation wizard
          if (isNewUser) {
            console.log('Redirecting new user to party creation wizard')
            return NextResponse.redirect(new URL('/create-party', requestUrl.origin))
          }
          
          // For existing users, check if they have parties
          try {
            const { data: userParties } = await supabase
              .from('parties')
              .select('id')
              .eq('user_id', data.user.id)
              .limit(1)
            
            if (!userParties || userParties.length === 0) {
              console.log('Existing user with no parties, redirecting to wizard')
              return NextResponse.redirect(new URL('/create-party', requestUrl.origin))
            }
          } catch (partiesErr) {
            console.warn('Failed to check user parties, proceeding with normal redirect:', partiesErr)
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