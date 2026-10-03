import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health — "is the app reachable?" for uptime monitoring (Sentry Uptime).
 * Deliberately shallow: no database, AI, Google or payment calls, and nothing about the environment.
 */
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'magical-birthday-planner' }, { headers: { 'Cache-Control': 'no-store' } })
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
