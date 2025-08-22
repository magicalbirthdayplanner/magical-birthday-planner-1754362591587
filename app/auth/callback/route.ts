import { createServerComponentClient } from '@/lib/supabase-client'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createServerComponentClient({ cookies })
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }

      if (data?.session) {
        console.log('Auth callback successful for user:', data.user?.email)
        // Redirect to dashboard or specified next URL
        return NextResponse.redirect(new URL(next, requestUrl.origin))
      }
    } catch (err) {
      console.error('Auth callback exception:', err)
      return NextResponse.redirect(new URL('/signin?error=callback_failed', requestUrl.origin))
    }
  }

  // If no code or session, redirect to signin
  return NextResponse.redirect(new URL('/signin?error=no_code', requestUrl.origin))
}