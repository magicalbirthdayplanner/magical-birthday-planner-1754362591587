import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isBlockedPath } from '@/lib/security/blocked-routes'

export function middleware(request: NextRequest) {
  if (isBlockedPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     * - _next/static, _next/image
     * - favicon, icons, manifest, service worker
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.png|icons/|manifest.webmanifest|sw.js).*)',
  ],
}
