'use client'

/** Minimal parent sign-in for Magical Santa: email → 6-digit code, never leaves the page. Creates the account if new. */
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { EMAIL_CODE_LENGTH, friendlyAuthError, isValidEmail, normalizeCode } from '@/lib/auth/email-code'
import { track } from '@/lib/analytics/client'
import { SantaButton } from './ui'

export function SantaSignIn({ next, onSignedIn, title = 'Where should we send your receipt?', subtitle = 'We’ll email you a 6-digit code — no password needed.' }: {
  next: string
  onSignedIn: () => void
  title?: string
  subtitle?: string
}) {
  const { sendEmailCode, verifyEmailCode } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!isValidEmail(email)) return setError('Please enter a valid email address.')
    setBusy(true)
    setError(null)
    const { error: e } = await sendEmailCode(email.trim(), { create: true, next })
    setBusy(false)
    if (e) return setError(friendlyAuthError(e.message ?? '', e.code))
    setSent(true)
  }

  const verify = async (value = code) => {
    if (value.length !== EMAIL_CODE_LENGTH) return
    setBusy(true)
    setError(null)
    const { error: e } = await verifyEmailCode(email.trim(), value)
    setBusy(false)
    if (e) return setError(friendlyAuthError(e.message ?? '', e.code))
    track('santa_signin_completed')
    onSignedIn()
  }

  return (
    <div>
      <h2 className="text-[22px] font-extrabold leading-tight">{sent ? 'Check your email' : title}</h2>
      <p className="mt-1 text-[15px] text-[#2b1d14]/65">{sent ? <>We sent a code to <b>{email}</b>.</> : subtitle}</p>
      {!sent ? (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void send() }}>
          <label className="block">
            <span className="sr-only">Email address</span>
            <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 w-full rounded-2xl border-2 border-[#2b1d14]/12 bg-white px-4 text-[17px] outline-none focus:border-[#c8202e]" />
          </label>
          <SantaButton type="submit" loading={busy}>Email me a code</SantaButton>
        </form>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void verify() }}>
          <label className="block">
            <span className="sr-only">6-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                const v = normalizeCode(e.target.value)
                setCode(v)
                if (v.length === EMAIL_CODE_LENGTH) void verify(v)
              }}
              className="h-16 w-full rounded-2xl border-2 border-[#2b1d14]/12 bg-white text-center text-[28px] font-extrabold tracking-[0.4em] outline-none focus:border-[#c8202e]"
            />
          </label>
          <SantaButton type="submit" loading={busy} disabled={code.length !== EMAIL_CODE_LENGTH}>
            <MailCheck className="h-5 w-5" /> Continue
          </SantaButton>
          <button type="button" onClick={() => { setSent(false); setCode('') }} className="w-full py-2 text-sm font-bold text-[#2b1d14]/60">Use a different email</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-[15px] font-semibold text-[#c8202e]">{error}</p>}
    </div>
  )
}
