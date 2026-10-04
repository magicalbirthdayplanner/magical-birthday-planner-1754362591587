'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { CalendarPlus, Minus, PartyPopper, Plus } from 'lucide-react'
import { AppButton, Chip, ErrorState, IconButton, Skeleton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { Logo } from '@/components/app/Logo'
import { forgetRsvpRespondent, getPublicInvitation, lastRsvpName, submitRsvp, type PublicInvitation } from '@/lib/data/invitations'
import { InvitationCard } from './InvitationCard'
import { track } from '@/lib/analytics/client'

function icsFor(inv: PublicInvitation): string {
  const d = inv.party_date.replace(/-/g, '')
  const t = (x: string | null, fallback: string) => (x ?? fallback).slice(0, 5).replace(':', '') + '00'
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Magical Birthday Planner//EN',
    'BEGIN:VEVENT',
    `UID:${d}-${Math.random().toString(36).slice(2)}@magical-birthday-planner.invalid`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${d}T${t(inv.start_time, '14:00')}`,
    `DTEND:${d}T${t(inv.end_time, '16:00')}`,
    `SUMMARY:${esc(inv.headline || `${inv.child_name}’s birthday party`)}`,
    inv.location_text ? `LOCATION:${esc(inv.location_text)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <IconButton label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(0, value - 1))} className="border border-border">
          <Minus className="h-4 w-4" />
        </IconButton>
        <output className="w-6 text-center text-lg font-semibold tabular-nums">{value}</output>
        <IconButton label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(20, value + 1))} className="border border-border">
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}

/** Public RSVP page. Uses token-scoped RPCs only — no access to the host's data. */
export function PublicInviteScreen({ token }: { token: string }) {
  const { data, error, isLoading, mutate } = useSWR(['invite', token], () => getPublicInvitation(token), { revalidateOnFocus: false })
  const [status, setStatus] = useState<'CONFIRMED' | 'MAYBE' | 'DECLINED' | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [kids, setKids] = useState(1)
  const [adults, setAdults] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Someone already answered from this device: submitting again updates THAT answer (one invitee, one RSVP).
  const [answeredAs, setAnsweredAs] = useState<string | null>(null)
  useEffect(() => setAnsweredAs(lastRsvpName(token)), [token])

  function startRsvp(s: 'CONFIRMED' | 'MAYBE' | 'DECLINED') {
    if (!status) track('rsvp_started')
    setStatus(s)
  }

  function someoneElse() {
    forgetRsvpRespondent(token)
    setAnsweredAs(null)
    setName('')
    setEmail('')
    setNote('')
    setStatus(null)
    setDone(false)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <Skeleton className="h-[420px] w-full rounded-[32px]" />
      </div>
    )
  }
  if (error) return <ErrorState message="We couldn’t load this invitation. Check your connection and try again." onRetry={() => mutate()} />
  if (!data) return <ErrorState title="Invitation not found" message="This link may have been turned off by the host. Ask them for a new one." />

  const first = data.child_name

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!status) return setFormError('Let the host know if you can make it.')
    if (!name.trim()) return setFormError('Please add your name.')
    setBusy(true)
    try {
      await submitRsvp(token, { name: name.trim(), email: email.trim() || undefined, status, adults: status === 'DECLINED' ? 0 : adults, children: status === 'DECLINED' ? 0 : kids, note: note.trim() || undefined })
      setAnsweredAs(name.trim())
      track('rsvp_completed', { status })
      setDone(true)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function addToCalendar() {
    const blob = new Blob([icsFor(data!)], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'birthday-party.ics'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-magic px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+16px)]">
      <InvitationCard
        inv={{ childName: data.child_name, childAge: data.child_age, partyDate: data.party_date, startTime: data.start_time, endTime: data.end_time, locationText: data.location_text, headline: data.headline, message: data.message, hostName: data.host_name, rsvpBy: data.rsvp_by, design: data.design }}
      />
      <AppButton variant="outline" block className="mt-4" onClick={addToCalendar}>
        <CalendarPlus className="h-4 w-4" /> Add to calendar
      </AppButton>

      {done ? (
        <div className="mbp-rise mt-6 rounded-3xl bg-card p-6 text-center shadow-sm" role="status">
          <PartyPopper className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-extrabold">{status === 'DECLINED' ? 'Thanks for letting us know' : 'You’re on the list!'}</h2>
          <p className="mt-1 text-muted-foreground">{status === 'DECLINED' ? `We’ll miss you at ${first}’s party.` : `${first} can’t wait to celebrate with you.`}</p>
          <div className="mt-4 flex flex-col items-center gap-1">
            <button type="button" className="tap min-h-[44px] text-sm font-semibold text-primary" onClick={() => setDone(false)}>
              Change my RSVP
            </button>
            <button type="button" className="tap min-h-[44px] text-sm text-muted-foreground underline" onClick={someoneElse}>
              RSVP for someone else
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-sm" noValidate>
          <h2 className="font-display text-2xl font-extrabold">Can you make it?</h2>
          {answeredAs ? (
            <p className="rounded-xl bg-secondary px-4 py-3 text-sm" data-testid="rsvp-answered-as">
              You already replied as <strong>{answeredAs}</strong> — sending again updates that reply.{' '}
              <button type="button" className="font-semibold text-primary underline" onClick={someoneElse}>
                Not {answeredAs}?
              </button>
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="RSVP">
            {(
              [
                ['CONFIRMED', 'Yes! 🎉'],
                ['MAYBE', 'Maybe'],
                ['DECLINED', 'Can’t go'],
              ] as const
            ).map(([s, label]) => (
              <Chip key={s} role="radio" aria-checked={status === s} active={status === s} onClick={() => startRsvp(s)} className="h-12 justify-center">
                {label}
              </Chip>
            ))}
          </div>
          <TextField label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. The Garcia family" />
          <TextField label="Email (optional)" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} hint="Only shared with the host." />
          {status !== 'DECLINED' ? (
            <>
              <Counter label="Kids" value={kids} onChange={setKids} />
              <Counter label="Adults" value={adults} onChange={setAdults} />
            </>
          ) : null}
          <TextField label="Note for the host (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Allergies, questions…" />
          {formError ? (
            <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <AppButton type="submit" block size="lg" loading={busy}>
            Send RSVP
          </AppButton>
        </form>
      )}
      <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
        <Logo className="opacity-60" />
        Planning a party? <a href="/start" className="font-semibold text-primary">Try Magical Birthday Planner</a>
      </div>
    </div>
  )
}
