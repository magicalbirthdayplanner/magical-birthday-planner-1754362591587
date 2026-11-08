import { describe, expect, it } from 'vitest'
import { EMAIL_CODE_LENGTH, friendlyAuthError, isValidEmail, normalizeCode, retryAfterSeconds } from '@/lib/auth/email-code'

describe('email sign-in codes', () => {
  it('keeps digits only, up to the code length (pasted with spaces or text)', () => {
    expect(EMAIL_CODE_LENGTH).toBe(6)
    expect(normalizeCode('123 456')).toBe('123456')
    expect(normalizeCode('Code: 987-654-321')).toBe('987654')
    expect(normalizeCode('abc')).toBe('')
  })

  it('validates email addresses', () => {
    expect(isValidEmail(' sam@example.com ')).toBe(true)
    expect(isValidEmail('sam@example')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('reads Supabase’s wait time', () => {
    expect(retryAfterSeconds('For security purposes, you can only request this after 42 seconds.')).toBe(42)
    expect(retryAfterSeconds('For security purposes, you can only request this after 1 second.')).toBe(1)
    expect(retryAfterSeconds('Token has expired or is invalid')).toBeNull()
  })

  it('turns Supabase errors into plain sentences', () => {
    expect(friendlyAuthError('For security purposes, you can only request this after 42 seconds.')).toBe('Please wait 42 seconds before asking for another code.')
    expect(friendlyAuthError('Token has expired or is invalid', 'otp_expired')).toBe('That code isn’t right or has expired. Check it, or send a new code.')
    expect(friendlyAuthError('Signups not allowed for otp', 'otp_disabled')).toBe('We couldn’t find an account for that email. Check it, or create a new account.')
    expect(friendlyAuthError('Error sending magic link email')).toBe('We couldn’t send the email just now. Please try again in a minute.')
    expect(friendlyAuthError('Error sending confirmation email')).toBe('We couldn’t send the email just now. Please try again in a minute.')
    expect(friendlyAuthError('Email rate limit exceeded', 'over_email_send_rate_limit')).toBe('We’ve sent a lot of emails just now. Please try again in a few minutes.')
    expect(friendlyAuthError('Invalid login credentials')).toBe('That email and password don’t match. Try again?')
    expect(friendlyAuthError('Failed to fetch')).toBe('We couldn’t reach our servers. Check your connection.')
    expect(friendlyAuthError('something odd')).toBe('Something went wrong. Please try again.')
  })
})
