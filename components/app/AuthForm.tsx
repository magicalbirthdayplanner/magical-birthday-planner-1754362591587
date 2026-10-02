'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ensureProfile } from '@/lib/data/parties'
import { track } from '@/lib/analytics/client'
import { db } from '@/lib/db/browser'
import { AppButton, IconButton, PageHeader } from './ui'
import { GoogleIcon, TextField } from './fields'
import { safeNext } from '@/lib/security/redirect'

export { safeNext }

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Try again?'
  if (/already registered|already exists/i.test(message)) return 'You already have an account — sign in instead.'
  if (/password.*(at least|short|weak)/i.test(message)) return 'Use at least 8 characters for your password.'
  if (/email.*not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox.'
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.'
  if (/fetch|network/i.test(message)) return 'We couldn’t reach our servers. Check your connection.'
  return 'Something went wrong. Please try again.'
}

export function AuthForm({ mode, onDone, compact, next: nextProp }: { mode: 'signin' | 'signup'; onDone?: () => void; compact?: boolean; next?: string }) {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(nextProp ?? params?.get('next') ?? null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function finish() {
    const { data } = await db.auth.getUser()
    if (data.user) await ensureProfile(data.user).catch(() => undefined)
    if (onDone) onDone()
    else router.replace(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Please enter a valid email.')
    if (password.length < (mode === 'signup' ? 8 : 1)) return setError(mode === 'signup' ? 'Use at least 8 characters for your password.' : 'Please enter your password.')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password)
        if (error) return setError(friendlyAuthError(error.message ?? ''))
        track('sign_in', { method: 'password' })
        await finish()
      } else {
        const { error } = await signUp(email.trim(), password, name.trim() || undefined)
        if (error) return setError(friendlyAuthError(error.message ?? ''))
        track('sign_up', { method: 'password' })
        const { data } = await db.auth.getSession()
        if (data.session) await finish()
        else setCheckEmail(true)
      }
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    const { error } = await signInWithGoogle(next)
    if (error) setError(friendlyAuthError(error.message ?? ''))
  }

  if (checkEmail) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
          <MailCheck className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Check your inbox</h2>
        <p className="mt-2 text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Open it on this phone to continue planning.
        </p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="mt-6 inline-block font-semibold text-primary">
          I’ve confirmed — sign in
        </Link>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'px-4'}>
      <AppButton type="button" variant="outline" size="lg" block onClick={google} className="font-medium">
        <GoogleIcon /> Continue with Google
      </AppButton>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} noValidate className="space-y-4">
        {mode === 'signup' ? (
          <TextField label="Your first name" name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
        ) : null}
        <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <TextField
          label="Password"
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          required
          trailing={
            <IconButton label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </IconButton>
          }
        />
        {mode === 'signin' ? (
          <div className="-mt-1 text-right">
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={async () => {
                setError(null)
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter your email above, then tap “Forgot password?”.')
                // Supabase Auth sends the reset email; we never reveal whether the account exists.
                await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }).catch(() => undefined)
                setResetSent(true)
              }}
            >
              Forgot password?
            </button>
          </div>
        ) : null}
        {resetSent ? (
          <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            If an account exists for that email, we’ve sent a link to reset your password.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AppButton type="submit" size="lg" block loading={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </AppButton>
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
      <AuthForm mode={mode} />
      <p className="px-6 pb-8 pt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  )
}
