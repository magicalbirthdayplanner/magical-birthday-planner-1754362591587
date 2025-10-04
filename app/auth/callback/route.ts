import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const state = requestUrl.searchParams.get('state')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  let isNewUser = false

  console.log('🔄 Auth callback received:', { 
    code: code ? 'present' : 'missing', 
    error_code, 
    error_description,
    state,
    next,
    origin: requestUrl.origin,
    fullUrl: requestUrl.toString(),
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
    allParams: Object.fromEntries(requestUrl.searchParams.entries())
  })

  // Handle OAuth errors from provider
  if (error_code) {
    console.error('❌ OAuth provider error:', { error_code, error_description })
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error_description || error_code)}`, requestUrl.origin))
  }

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    try {
      console.log('🔄 Exchanging code for session...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('❌ Auth callback error:', error.message, error)
        return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }

      if (data?.session && data?.user) {
        console.log('✅ Auth callback successful for user:', data.user.email)
        console.log('Session expires at:', data.session.expires_at)
        
        // Verify session is properly set and refresh if needed
        const { data: sessionCheck, error: sessionCheckError } = await supabase.auth.getSession()
        if (!sessionCheck.session) {
          console.error('❌ Session not properly established after OAuth')
          // Try to refresh the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError || !refreshData.session) {
            console.error('❌ Session refresh failed:', refreshError)
            return NextResponse.redirect(new URL('/signin?error=session_failed', requestUrl.origin))
          }
          console.log('✅ Session refreshed successfully')
        }
        
        // Ensure user profile exists and check if user is new
        if (data.user) {
          try {
            // Check if profile already exists in users table
            const { data: existingProfile, error: profileCheckError } = await supabase
              .from('users')
              .select('id, created_at')
              .eq('id', data.user.id)
              .single()
            
            if (profileCheckError && profileCheckError.code === 'PGRST116') {
              // Profile doesn't exist - new user
              isNewUser = true
              console.log('👤 New user detected, will show welcome screen')
            } else if (profileCheckError) {
              console.warn('⚠️ Error checking profile:', profileCheckError)
            } else {
              console.log('👤 Existing user profile found')
              // Check if user has parties - if not, still consider them new for welcome screen
              const { data: userParties, error: partiesCheckError } = await supabase
                .from('parties')
                .select('id')
                .eq('user_id', data.user.id)
                .limit(1)
              
              if (!partiesCheckError && (!userParties || userParties.length === 0)) {
                isNewUser = true
                console.log('🎆 User has no parties, treating as new user for welcome screen')
              }
            }
            
            // Create or update profile in users table - be more aggressive
            console.log('👤 Attempting to create/update user profile...')
            const { data: upsertData, error: profileError } = await supabase
              .from('users')
              .upsert({
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '',
                avatar_url: data.user.user_metadata?.avatar_url,
                current_plan: 'PRO', // Start with PRO plan for 24-hour trial
                trial_started_at: new Date().toISOString(),
                trial_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
                trial_plan: 'PRO',
                is_trial_active: true,
                has_used_trial: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id',
                ignoreDuplicates: false
              })
              .select()
            
            if (profileError) {
              console.error('⚠️ Profile upsert error:', profileError)
              // Log the exact error for debugging
              console.error('Error details:', {
                code: profileError.code,
                message: profileError.message,
                details: profileError.details,
                hint: profileError.hint
              })
              
              // Try a simple insert instead of upsert
              console.log('🔄 Trying simple insert...')
              const { data: insertData, error: insertError } = await supabase
                .from('users')
                .insert({
                  id: data.user.id,
                  email: data.user.email,
                  full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '',
                  avatar_url: data.user.user_metadata?.avatar_url,
                  current_plan: 'PRO', // Start with PRO plan for 24-hour trial
                  trial_started_at: new Date().toISOString(),
                  trial_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
                  trial_plan: 'PRO',
                  is_trial_active: true,
                  has_used_trial: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .select()
              
              if (insertError) {
                console.error('❌ Both upsert and insert failed:', insertError)
              } else {
                console.log('✅ User inserted successfully via fallback:', insertData)
              }
            } else {
              console.log('✅ Profile created/updated successfully:', upsertData)
            }
          } catch (profileErr) {
            console.warn('⚠️ Profile creation failed (non-blocking):', profileErr)
          }
          
          // For new users, redirect to signin with show_welcome parameter to trigger welcome screen
          if (isNewUser) {
            console.log('🎉 Redirecting new user to signin for welcome screen')
            const response = NextResponse.redirect(new URL('/signin?show_welcome=true', requestUrl.origin))
            
            // Ensure session cookies are properly set for new users too
            const session = sessionCheck.session || data.session
            if (session) {
              response.cookies.set('supabase-auth-token', session.access_token, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: session.expires_in || 3600
              })
            }
            
            return response
          }
          
          // For existing users, check if they have parties and redirect accordingly
          try {
            const { data: userParties, error: partiesError } = await supabase
              .from('parties')
              .select('id')
              .eq('user_id', data.user.id)
              .limit(1)
            
            if (partiesError) {
              console.warn('⚠️ Error checking user parties:', partiesError)
            } else if (!userParties || userParties.length === 0) {
              console.log('🎉 Existing user with no parties, redirecting to wizard')
              const response = NextResponse.redirect(new URL('/create-party', requestUrl.origin))
              
              // Set session cookies
              const session = sessionCheck.session || data.session
              if (session) {
                response.cookies.set('supabase-auth-token', session.access_token, {
                  httpOnly: true,
                  secure: true,
                  sameSite: 'lax',
                  maxAge: session.expires_in || 3600
                })
              }
              
              return response
            } else {
              console.log('📊 User has existing parties, redirecting to dashboard')
              const response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
              
              // Set session cookies
              const session = sessionCheck.session || data.session
              if (session) {
                response.cookies.set('supabase-auth-token', session.access_token, {
                  httpOnly: true,
                  secure: true,
                  sameSite: 'lax',
                  maxAge: session.expires_in || 3600
                })
              }
              
              return response
            }
          } catch (partiesErr) {
            console.warn('⚠️ Failed to check user parties, proceeding with dashboard redirect:', partiesErr)
          }
        }
        
        // Redirect to dashboard or specified next URL
        console.log('🏠 Redirecting to:', next)
        const response = NextResponse.redirect(new URL(next, requestUrl.origin))
        
        // Ensure session cookies are properly set
        const session = sessionCheck.session || data.session
        if (session) {
          response.cookies.set('supabase-auth-token', session.access_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: session.expires_in || 3600
          })
        }
        
        return response
      } else {
        console.error('❌ No session or user received after code exchange')
        return NextResponse.redirect(new URL('/signin?error=no_session', requestUrl.origin))
      }
    } catch (err) {
      console.error('❌ Auth callback exception:', err)
      return NextResponse.redirect(new URL('/signin?error=callback_failed', requestUrl.origin))
    }
  }

  // If no code or session, redirect to signin
  console.error('❌ No authorization code received')
  console.error('This usually means:')
  console.error('1. Google OAuth redirect URL is not configured properly')
  console.error('2. User cancelled the OAuth flow')
  console.error('3. OAuth provider (Supabase) configuration issue')
  console.error('Expected redirect URL should be: https://www.magicalbirthdayplanner.com/auth/callback')
  return NextResponse.redirect(new URL('/signin?error=no_code', requestUrl.origin))
}