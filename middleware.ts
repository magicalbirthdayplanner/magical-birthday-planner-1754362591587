// Middleware temporarily disabled for Vercel Edge Runtime compatibility
// Will be re-enabled once Edge Runtime issues are resolved

// import { NextResponse } from 'next/server'
// import type { NextRequest } from 'next/server'

// export async function middleware(request: NextRequest) {
//   return NextResponse.next()
// }

// export const config = {
//   matcher: [
//     '/((?!api|_next/static|_next/image|favicon.ico).*)',
//   ],
// }