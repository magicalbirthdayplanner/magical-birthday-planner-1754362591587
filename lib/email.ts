import 'server-only'
import { Resend } from 'resend'

/**
 * Resend client (server only). Lazily constructed: `new Resend(undefined)` throws, which
 * would break `next build` when RESEND_API_KEY is unset; sends fail gracefully instead.
 * Templates and sending live in lib/server/notifications.ts.
 */
let resendClient: Resend | null = null
export function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) throw new Error('Email is not configured (RESEND_API_KEY missing)')
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}
