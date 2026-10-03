'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db/browser'
import { AppButton, PageHeader } from './ui'
import { TextField } from './fields'
import { authFailed } from '@/lib/observability/auth'

/** Landing page for Supabase's password-recovery link (session arrives in the URL). */
export function ResetPasswordScreen() {
  const router = useRouter()
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady('ok')
    })
    db.auth.getSession().then(({ data }) => setReady((r) => (data.session ? 'ok' : r)))
    const t = setTimeout(() => setReady((r) => (r === 'checking' ? 'invalid' : r)), 4000)
    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    const { error: err } = await db.auth.updateUser({ password })
    setBusy(false)
    if (err) {
      authFailed('password_update', err)
      return setError('That link has expired. Request a new one from the sign-in screen.')
    }
    router.replace('/home')
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-magic pt-safe">
      <PageHeader back="/login" title="Choose a new password" />
      {ready === 'invalid' ? (
        <p className="mx-4 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">This reset link is invalid or has expired. Request a new one from the sign-in screen.</p>
      ) : (
        <form onSubmit={save} className="space-y-4 px-4">
          <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
          {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          <AppButton type="submit" size="lg" block loading={busy} disabled={ready !== 'ok'}>
            Save password
          </AppButton>
        </form>
      )}
    </div>
  )
}
