/**
 * Email sign-in codes (Supabase email OTP): helpers shared by the auth form and its tests. Pure, no I/O.
 * The code length must match Supabase → Authentication → Providers → Email → "Email OTP Length" (and
 * `[auth.email] otp_length` in supabase/config.toml).
 */
export const EMAIL_CODE_LENGTH = 6
/** Supabase lets one address request a new email once a minute. */
export const RESEND_AFTER_SECONDS = 60

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const isValidEmail = (email: string) => EMAIL.test(email.trim())

/** Digits only, at most EMAIL_CODE_LENGTH (pasted "123 456" or "Code: 123456" both work). */
export const normalizeCode = (raw: string) => raw.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH)

/** "For security purposes, you can only request this after 42 seconds." → 42. */
export function retryAfterSeconds(message: string): number | null {
  const m = /after (\d+) seconds?/i.exec(message)
  return m ? Number(m[1]) : null
}

/** Supabase auth error → a sentence for parents. Never echoes the raw message. */
export function friendlyAuthError(message: string, code?: string): string {
  const wait = retryAfterSeconds(message)
  if (wait !== null) return `Please wait ${wait} seconds before asking for another code.`
  if (code === 'otp_expired' || /token has expired|token.*invalid|otp.*(expired|invalid)/i.test(message)) return 'That code isn’t right or has expired. Check it, or send a new code.'
  if (code === 'otp_disabled' || /signups not allowed/i.test(message)) return 'We couldn’t find an account for that email. Check it, or create a new account.'
  if (/error sending .*email/i.test(message)) return 'We couldn’t send the email just now. Please try again in a minute.'
  if (/email rate limit/i.test(message)) return 'We’ve sent a lot of emails just now. Please try again in a few minutes.'
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Try again?'
  if (/already registered|already exists/i.test(message)) return 'You already have an account — sign in instead.'
  if (/password.*(at least|short|weak)/i.test(message)) return 'Use at least 8 characters for your password.'
  if (/email.*not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox.'
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.'
  if (/fetch|network/i.test(message)) return 'We couldn’t reach our servers. Check your connection.'
  return 'Something went wrong. Please try again.'
}
