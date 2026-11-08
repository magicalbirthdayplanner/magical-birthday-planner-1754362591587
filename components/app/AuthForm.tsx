'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ensureProfile } from '@/lib/data/parties'
import { track } from '@/lib/analytics/client'
import { db } from '@/lib/db/browser'
import { AppButton, IconButton, PageHeader } from './ui'
import { GoogleIcon, TextField } from './fields'
import { safeNext } from '@/lib/security/redirect'
import { authFailed } from '@/lib/observability/auth'
import { isInAppBrowser } from '@/lib/analytics/attribution'
import { EMAIL_CODE_LENGTH, RESEND_AFTER_SECONDS, friendlyAuthError, isValidEmail, normalizeCode, retryAfterSeconds } from '@/lib/auth/email-code'

export { safeNext }

type AuthError = { message?: string; code?: string } | null | undefined
const errorText = (e: AuthError) => friendlyAuthError(e?.message ?? '', e?.code)

/**
 * Sign up / sign in. Default: email → a 6-digit code by email → signed in, without leaving the page (no password, no
 * link to tap — the link in the same email still works as a fallback, e.g. opened in another browser). Google sits on
 * top except inside the Facebook / Instagram in-app browsers, where Google refuses to sign in. Accounts that already
 * have a password can still use it ("Sign in with a password instead").
 */
export function AuthForm({ mode, onDone, compact, next: nextProp, signupData }: { mode: 'signin' | 'signup'; onDone?: () => void; compact?: boolean; next?: string; signupData?: Record<string, unknown> }) {
  const { signIn, sendEmailCode, verifyEmailCode, signInWithGoogle } = useAuth()
  useEffect(() => {
    if (mode === 'signup') track('signup_started')
  }, [mode])
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(nextProp ?? params?.get('next') ?? null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  // Code step: the address the code went to, the digits typed so far, and the resend countdown.
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [resent, setResent] = useState(false)
  const verifying = useRef(false)
  // Google refuses sign-in inside the Facebook / Instagram in-app browsers (where ad clicks open): email only there.
  const [inApp, setInApp] = useState(false)
  useEffect(() => setInApp(isInAppBrowser(navigator.userAgent)), [])
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // Pre-existing (password) users switch to the password form from sign-in; the sign-up form never asks for one.
  const passwordMode = mode === 'signin' && usePassword

  async function finish() {
    const { data } = await db.auth.getUser()
    if (data.user) await ensureProfile(data.user).catch(() => undefined)
    if (onDone) onDone()
    else router.replace(next)
  }

  async function requestCode(to: string) {
    const { error } = await sendEmailCode(to, { create: mode === 'signup', displayName: name.trim() || undefined, next, data: signupData })
    if (error) {
      setError(errorText(error))
      const wait = retryAfterSeconds(error.message ?? '')
      if (wait !== null) setResendIn(wait)
      return false
    }
    track('email_code_sent', { mode })
    setResendIn(RESEND_AFTER_SECONDS)
    return true
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const to = email.trim()
    if (!isValidEmail(to)) return setError('Please enter a valid email.')
    setBusy(true)
    try {
      if (passwordMode) {
        if (!password) return setError('Please enter your password.')
        const { error } = await signIn(to, password)
        if (error) return setError(errorText(error))
        track('sign_in', { method: 'password' })
        await finish()
        return
      }
      if (await requestCode(to)) {
        setCode('')
        setResent(false)
        setSentTo(to)
      }
    } finally {
      setBusy(false)
    }
  }

  async function verify(value: string) {
    if (!sentTo || verifying.current) return
    setError(null)
    if (value.length !== EMAIL_CODE_LENGTH) return setError(`Enter the ${EMAIL_CODE_LENGTH}-digit code from the email.`)
    verifying.current = true
    setBusy(true)
    try {
      const { error, isNewAccount } = await verifyEmailCode(sentTo, value)
      if (error) {
        setCode('')
        return setError(errorText(error))
      }
      if (isNewAccount) {
        track('sign_up', { method: 'email_code' })
        track('signup_completed', { method: 'email_code' })
      } else {
        track('sign_in', { method: 'email_code' })
      }
      await finish()
    } finally {
      verifying.current = false
      setBusy(false)
    }
  }

  async function resend() {
    if (!sentTo || resendIn > 0) return
    setError(null)
    setBusy(true)
    try {
      if (await requestCode(sentTo)) setResent(true)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    const { error } = await signInWithGoogle(next)
    if (error) setError(errorText(error))
  }

  const alert = error ? (
    <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </p>
  ) : null

  if (sentTo) {
    return (
      <div className={compact ? '' : 'px-4'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void verify(code)
          }}
          noValidate
          className="space-y-4"
          data-testid="email-code-step"
        >
          <div className="flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p>
              We emailed a {EMAIL_CODE_LENGTH}-digit code to <strong className="break-all text-foreground">{sentTo}</strong>. Type it below — it’s valid for 1 hour.
            </p>
          </div>
          <TextField
            label={`${EMAIL_CODE_LENGTH}-digit code`}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            autoFocus
            value={code}
            onChange={(e) => {
              const v = normalizeCode(e.target.value)
              setCode(v)
              // Typed or pasted the whole code: check it straight away.
              if (v.length === EMAIL_CODE_LENGTH) void verify(v)
            }}
            placeholder={'•'.repeat(EMAIL_CODE_LENGTH)}
            style={{ letterSpacing: '0.35em', fontSize: 22, textAlign: 'center' }}
          />
          {alert}
          {resent && !error ? (
            <p role="status" className="text-sm text-muted-foreground">
              New code sent. Use the newest email — older codes stop working.
            </p>
          ) : null}
          <AppButton type="submit" size="lg" block loading={busy}>
            {mode === 'signup' ? 'Verify and continue' : 'Sign in'}
          </AppButton>
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            <p>
              Didn’t get it? Check your spam folder, or{' '}
              {resendIn > 0 ? (
                <span>send a new code in {resendIn}s</span>
              ) : (
                <button type="button" className="inline-flex min-h-[44px] items-center font-semibold text-primary" onClick={resend}>
                  send a new code
                </button>
              )}
              .
            </p>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center font-semibold text-primary"
              onClick={() => {
                setSentTo(null)
                setCode('')
                setError(null)
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'px-4'}>
      {inApp ? null : (
        <>
          <AppButton type="button" variant="outline" size="lg" block onClick={google} className="font-medium">
            <GoogleIcon /> Continue with Google
          </AppButton>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={submitEmail} noValidate className="space-y-4">
        {mode === 'signup' ? (
          <TextField label="Your first name" name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
        ) : null}
        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          hint={passwordMode ? undefined : `We’ll email you a ${EMAIL_CODE_LENGTH}-digit code — no password needed.`}
          required
        />
        {passwordMode ? (
          <>
            <TextField
              label="Password"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              trailing={
                <IconButton label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </IconButton>
              }
            />
            <div className="-mt-1 text-right">
              <button
                type="button"
                className="-my-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary"
                onClick={async () => {
                  setError(null)
                  if (!isValidEmail(email)) return setError('Enter your email above, then tap “Forgot password?”.')
                  // Supabase Auth sends the reset email; we never reveal whether the account exists.
                  await db.auth
                    .resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
                    .then(({ error }) => error && authFailed('password_reset', error))
                    .catch((err) => authFailed('password_reset', err))
                  setResetSent(true)
                }}
              >
                Forgot password?
              </button>
            </div>
          </>
        ) : null}
        {resetSent ? (
          <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            If an account exists for that email, we’ve sent a link to reset your password.
          </p>
        ) : null}
        {alert}
        <AppButton type="submit" size="lg" block loading={busy}>
          {passwordMode ? 'Sign in' : 'Email me a code'}
        </AppButton>
        {mode === 'signin' ? (
          <p className="text-center">
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary"
              onClick={() => {
                setUsePassword((p) => !p)
                setError(null)
                setResetSent(false)
              }}
            >
              {passwordMode ? 'Email me a code instead' : 'Sign in with a password instead'}
            </button>
          </p>
        ) : null}
      </form>
      {!compact ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <Link className="font-semibold text-primary" href={`/join?next=${encodeURIComponent(next)}`}>
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link className="font-semibold text-primary" href={`/login?next=${encodeURIComponent(next)}`}>
                Sign in
              </Link>
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}

export function AuthScreen({ mode }: { mode: 'signin' | 'signup' }) {
  const params = useSearchParams()
  const expired = params?.get('expired') === '1'
  const callbackFailed = params?.get('error') === 'callback'
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-magic pb-safe pt-safe">
      <PageHeader
        back="/home"
        title={mode === 'signin' ? 'Welcome back' : 'Create your account'}
        subtitle={mode === 'signin' ? 'Pick up right where you left off.' : 'Save your party and plan from any device.'}
      />
      {expired ? (
        <p role="status" className="mx-4 mb-4 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Your session expired. Please sign in again.
        </p>
      ) : null}
      {callbackFailed ? (
        <p role="alert" className="mx-4 mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Sign-in didn’t complete. Please try again.
        </p>
      ) : null}
      <AuthForm mode={mode} />
      <p className="px-6 pb-8 pt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  )
}
