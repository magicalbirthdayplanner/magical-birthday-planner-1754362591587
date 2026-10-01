import 'server-only'
import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'invalid_zip'
  | 'rate_limited'
  | 'google_unavailable'
  | 'quota'
  | 'timeout'
  | 'not_configured'
  | 'server_error'

/** Consistent, user-safe error body. Never includes stack traces or upstream messages. */
export function apiError(status: number, code: ApiErrorCode, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers })
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim()
}
