'use client'
/**
 * Launch waitlist form (pre-launch mode only). Email required, first name optional; no account, no password.
 * First-touch campaign attribution (utm_*, source/ref, referrer host) is captured on landing and sent along.
 * Every form on the page switches to the success state together once one of them succeeds.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AppButton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { attributionFrom, type Attribution } from '@/lib/waitlist'
import { cn } from '@/lib/utils'

const JOINED_KEY = 'mbp.waitlist.joined'
const ATTR_KEY = 'mbp.waitlist.attr'
const JOINED_EVENT = 'mbp:waitlist-joined'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Remember where this visit came from (first touch in this tab). */
export function captureAttribution(): Attribution {
  try {
    const saved = sessionStorage.getItem(ATTR_KEY)
    if (saved) return JSON.parse(saved) as Attribution
    const attr = attributionFrom(window.location.search, document.referrer)
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr))
    return attr
  } catch {
    return {}
  }
}

type Phase = 'idle' | 'sending' | 'done'

export function WaitlistForm({ placement, className, tone = 'light' }: { placement: 'hero' | 'footer'; className?: string; tone?: 'light' | 'dark' }) {
  const uid = useId()
  const [phase, setPhase] = useState<Phase>('idle')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [website, setWebsite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(JOINED_KEY)) setPhase('done')
    } catch {
      /* storage blocked: the form simply shows */
    }
    const onJoined = () => setPhase('done')
    window.addEventListener(JOINED_EVENT, onJoined)
    return () => window.removeEventListener(JOINED_EVENT, onJoined)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (phase === 'sending') return
    const value = email.trim()
    if (!EMAIL.test(value)) {
      setError('Please enter a valid email address.')
      emailRef.current?.focus()
      return
    }
    setError(null)
    setPhase('sending')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, firstName: firstName.trim() || undefined, website: website || undefined, form: placement, ...captureAttribution() }),
      })
      if (res.ok) {
        try {
          localStorage.setItem(JOINED_KEY, '1')
        } catch {
          /* ignore */
        }
        setPhase('done')
        window.dispatchEvent(new Event(JOINED_EVENT))
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      setError(res.status === 400 || res.status === 429 ? (body?.error?.message ?? 'Please check your email address.') : 'We couldn’t add you just now. Please try again.')
      if (res.status === 400) emailRef.current?.focus()
    } catch {
      setError('We couldn’t reach the waitlist. Check your connection and try again.')
    }
    setPhase('idle')
  }

  const dark = tone === 'dark'
  if (phase === 'done') {
    return (
      <div role="status" aria-live="polite" data-testid={`waitlist-success-${placement}`} className={cn('rounded-3xl p-5 text-center', dark ? 'bg-white/10 text-white' : 'bg-secondary/60', className)}>
        <p className="font-display text-2xl font-extrabold">You’re on the list! 🎂</p>
        <p className={cn('mt-1.5 text-base leading-relaxed', dark ? 'text-white/90' : 'text-muted-foreground')}>
          We’ll let you know when Magical Birthday Planner opens on October 13.
        </p>
        <button
          type="button"
          className={cn('tap mt-2 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold underline underline-offset-4', dark ? 'text-white/90' : 'text-primary')}
          onClick={() => {
            try {
              localStorage.removeItem(JOINED_KEY)
            } catch {
              /* ignore */
            }
            setEmail('')
            setFirstName('')
            setPhase('idle')
          }}
        >
          Add another email
        </button>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={submit} className={cn('space-y-3', className)} data-testid={`waitlist-form-${placement}`} aria-label="Join the waitlist">
      <TextField
        id={`${uid}-email`}
        label="Parent email"
        type="email"
        inputMode="email"
        enterKeyHint="go"
        ref={emailRef}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        required
        maxLength={254}
        value={email}
        error={error}
        onChange={(e) => {
          setEmail(e.target.value)
          if (error) setError(null)
        }}
        className={dark ? '[&_label]:text-white [&_[role=alert]]:font-semibold [&_[role=alert]]:text-white' : undefined}
      />
      <TextField
        id={`${uid}-name`}
        label="First name (optional)"
        autoComplete="given-name"
        enterKeyHint="go"
        maxLength={60}
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        className={dark ? '[&_label]:text-white [&_[role=alert]]:font-semibold [&_[role=alert]]:text-white' : undefined}
      />
      {/* Honeypot: invisible to people and screen readers; bots that fill it are ignored by the server. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <AppButton type="submit" size="lg" variant={dark ? 'secondary' : 'primary'} block loading={phase === 'sending'} data-testid={`waitlist-submit-${placement}`}>
        Join the waitlist
      </AppButton>
      <p className={cn('text-center text-sm leading-snug', dark ? 'text-white/75' : 'text-muted-foreground')}>
        No account or password — just your email. We’ll only use it for launch news.{' '}
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
      </p>
    </form>
  )
}
