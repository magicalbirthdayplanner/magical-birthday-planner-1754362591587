import { NextResponse } from 'next/server'
import { safeNext } from '@/lib/security/redirect'
import { authCallbackFailed } from '@/lib/observability/auth'

// Never cache upstream fetches in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'

/**
 * GET /auth/callback?next=/home
 *
 * Return point for Supabase email confirmation and OAuth. The app's Supabase client
 * uses the implicit flow and keeps the session in the browser: the tokens arrive in
 * the URL fragment, which browsers carry across this redirect, and the client picks
 * them up on the target page. This route therefore only validates `next` (same-origin
 * paths only, no open redirect) and reports provider errors without echoing them.
 * The `users` profile row is created by the database trigger on sign-up.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'), '/home')
  if (url.searchParams.get('error') || url.searchParams.get('error_code')) {
    console.warn('auth callback: provider returned an error', url.searchParams.get('error_code') ?? url.searchParams.get('error'))
    authCallbackFailed(url.searchParams.get('error_code') ?? url.searchParams.get('error'))
    return NextResponse.redirect(new URL(`/login?error=callback&next=${encodeURIComponent(next)}`, url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
