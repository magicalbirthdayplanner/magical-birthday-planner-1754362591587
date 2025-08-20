import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkMissingEnvVars } from '@/lib/env-config'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Skip middleware for the env-check page itself to avoid infinite redirects
  if (request.nextUrl.pathname === '/env-check') {
    return NextResponse.next()
  }

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if any required environment variables are missing
  const missingEnvVars = checkMissingEnvVars()

  // If any env variables are missing, redirect to env-check page
  if (missingEnvVars.length > 0) {
    return NextResponse.redirect(new URL('/env-check', request.url))
  }

  // Create response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client for session management
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Configure cookies for cross-domain compatibility in production
          const cookieOptions = {
            ...options,
            // Use the actual hostname for domain configuration
            domain: process.env.NODE_ENV === 'production' ? 
              (request.headers.get('host')?.includes('magicalbirthdayplanner.com') ? '.magicalbirthdayplanner.com' : undefined) : undefined,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const
          }
          
          request.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
        },
        remove(name: string, options: CookieOptions) {
          const cookieOptions = {
            ...options,
            // Use the actual hostname for domain configuration
            domain: process.env.NODE_ENV === 'production' ? 
              (request.headers.get('host')?.includes('magicalbirthdayplanner.com') ? '.magicalbirthdayplanner.com' : undefined) : undefined,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const
          }
          
          request.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  try {
    await supabase.auth.getUser()
  } catch (error) {
    console.warn('Auth middleware error:', error)
    // Don't block the request if auth fails
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}