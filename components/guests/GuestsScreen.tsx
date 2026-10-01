'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Search, Send, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useParty } from '@/components/app/PartyProvider'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, Chip, EmptyState, ErrorState, IconButton, LinkButton, PageHeader, Skeleton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { useGuests } from '@/lib/data/hooks'
import { addGuest, deleteGuest, guestTotals, updateGuest, validateGuest, type Guest, type GuestInput, type RsvpStatus } from '@/lib/data/guests'
import { friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'CONFIRMED' | 'waiting' | 'DECLINED' | 'not_invited'

const RSVP: Record<RsvpStatus, { label: string; cls: string }> = {
  CONFIRMED: { label: 'Going', cls: 'bg-success/15 text-success' },
  DECLINED: { label: 'Can’t go', cls: 'bg-destructive/10 text-destructive' },
  MAYBE: { label: 'Maybe', cls: 'bg-gold/20 text-[hsl(40_80%_30%)]' },
  PENDING: { label: 'Waiting', cls: 'bg-muted text-muted-foreground' },
}

function Counter({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <IconButton label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} className="border border-border">
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

function GuestForm({ initial, onSubmit, submitLabel, busy, onDelete, guest }: { initial: GuestInput & { rsvp?: RsvpStatus; invited?: boolean }; onSubmit: (v: GuestInput & { rsvp?: RsvpStatus; invited?: boolean }) => void; submitLabel: string; busy: boolean; onDelete?: () => void; guest?: Guest }) {
  const [v, setV] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      id="guest-form"
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault()
        const err = validateGuest(v)
        if (err) return setError(err)
        onSubmit(v)
      }}
    >
      <TextField label="Name" autoFocus={!guest} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. The Patel family" maxLength={80} error={error} />
      <div className="grid grid-cols-1 gap-3">
        <TextField label="Email (optional)" type="email" inputMode="email" autoCapitalize="none" value={v.email ?? ''} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <TextField label="Phone (optional)" type="tel" inputMode="tel" value={v.phone ?? ''} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </div>
      <Counter label="Kids" value={v.childCount ?? 1} onChange={(n) => setV({ ...v, childCount: n })} />
      <Counter label="Adults" value={v.adultCount ?? 1} onChange={(n) => setV({ ...v, adultCount: n })} />
      {guest ? (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">RSVP</legend>
            <div className="flex flex-wrap gap-2">
              {(['CONFIRMED', 'MAYBE', 'DECLINED', 'PENDING'] as RsvpStatus[]).map((s) => (
                <Chip key={s} active={v.rsvp === s} onClick={() => setV({ ...v, rsvp: s })}>
                  {RSVP[s].label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-[48px] items-center justify-between rounded-2xl border border-border bg-card px-4">
            <span className="font-medium">Invitation sent</span>
            <input type="checkbox" checked={!!v.invited} onChange={(e) => setV({ ...v, invited: e.target.checked })} className="h-6 w-6 accent-[hsl(258_56%_45%)]" />
          </label>
        </>
      ) : null}
      <TextField label="Notes (optional)" value={v.notes ?? ''} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Allergies, siblings…" />
      <AppButton type="submit" block size="lg" loading={busy}>
        {submitLabel}
      </AppButton>
      {onDelete ? (
        <AppButton type="button" variant="ghost" block onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" /> Remove guest
        </AppButton>
      ) : null}
    </form>
  )
}

export function GuestsScreen() {
  const { user } = useAuth()
  const { party } = useParty()
  const { data, error, isLoading, mutate } = useGuests(party?.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Guest | null>(null)
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const guests = useMemo(() => data ?? [], [data])
  const totals = guestTotals(guests)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return guests.filter((g) => {
      if (q && !`${g.name} ${g.email ?? ''}`.toLowerCase().includes(q)) return false
      if (filter === 'all') return true
      if (filter === 'waiting') return g.rsvp_status === 'PENDING' || g.rsvp_status === 'MAYBE'
      if (filter === 'not_invited') return g.invite_status === 'NOT_SENT'
      return g.rsvp_status === filter
    })
  }, [guests, query, filter])

  if (!party) return <EmptyState icon="👥" title="No party yet" action={<LinkButton href="/start" block>Plan a party</LinkButton>} />

  async function add(v: GuestInput) {
    if (!user) return
    setBusy(true)
    try {
      const g = await addGuest(party!.id, user.id, v)
      await mutate([...guests, g], { revalidate: false })
      track('guest_added', { kids: v.childCount ?? 0, adults: v.adultCount ?? 0 })
      toast.success(`${g.name} added`)
      setFormKey((k) => k + 1) // fresh form for "add another"
    } catch (e) {
      toast.error(friendlyError(e, 'Couldn’t add that guest.'))
    } finally {
      setBusy(false)
    }
  }

  async function save(g: Guest, v: GuestInput & { rsvp?: RsvpStatus; invited?: boolean }) {
    setBusy(true)
    try {
      const wasInvited = g.invite_status !== 'NOT_SENT'
      await updateGuest(g.id, {
        name: v.name.trim(),
        email: v.email?.trim() || null,
        phone: v.phone?.trim() || null,
        adult_count: v.adultCount ?? 1,
        child_count: v.childCount ?? 0,
        notes: v.notes?.trim() || null,
        rsvp_status: v.rsvp ?? g.rsvp_status,
        invite_status: v.invited ? (wasInvited ? g.invite_status : 'SENT') : 'NOT_SENT',
        invited_at: v.invited ? g.invited_at ?? new Date().toISOString() : null,
      })
      await mutate()
      setEditing(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(g: Guest) {
    setEditing(null)
    try {
      await mutate(async () => {
        await deleteGuest(g.id)
        return guests.filter((x) => x.id !== g.id)
      }, { optimisticData: guests.filter((x) => x.id !== g.id), rollbackOnError: true, revalidate: false })
      toast(`${g.name} removed`)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const filters: [Filter, string, number][] = [
    ['all', 'All', guests.length],
    ['CONFIRMED', 'Going', totals.confirmed],
    ['waiting', 'Waiting', totals.pending + totals.maybe],
    ['DECLINED', 'Can’t go', totals.declined],
    ['not_invited', 'Not invited', guests.filter((g) => g.invite_status === 'NOT_SENT').length],
  ]

  return (
    <div className="pb-4">
      <PageHeader
        title="Guests"
        subtitle={guests.length ? `${totals.confirmed} going · ${totals.confirmedKids} kids, ${totals.confirmedHeads - totals.confirmedKids} adults` : `Planning for ${party.guest_count ?? '—'} guests`}
        action={
          <button type="button" onClick={() => setAdding(true)} aria-label="Add guest" className="tap flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserPlus className="h-5 w-5" />
          </button>
        }
      />

      {isLoading && !data ? (
        <div className="space-y-2 px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={friendlyError(error)} onRetry={() => mutate()} />
      ) : guests.length === 0 ? (
        <EmptyState
          icon="💌"
          title="No guests yet"
          body="Add families yourself, or share your invite link and let RSVPs fill your list."
          action={
            <div className="space-y-3">
              <AppButton block size="lg" onClick={() => setAdding(true)}>
                <UserPlus className="h-5 w-5" /> Add a guest
              </AppButton>
              <LinkButton href="/plan/invite" variant="outline" block>
                <Send className="h-4 w-4" /> Share invite link
              </LinkButton>
            </div>
          }
        />
      ) : (
        <>
          <div className="px-4">
            <label className="relative block">
              <span className="sr-only">Search guests</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests" className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
            </label>
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="toolbar" aria-label="Filter guests">
            {filters.map(([id, label, n]) => (
              <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
                {label} <span className="opacity-70">{n}</span>
              </Chip>
            ))}
          </div>
          <Card className="mx-4 mt-3 overflow-hidden">
            <ul className="divide-y divide-border" aria-label="Guest list">
              {shown.map((g) => {
                const r = RSVP[(g.rsvp_status as RsvpStatus) ?? 'PENDING'] ?? RSVP.PENDING
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => setEditing(g)} className="tap flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground" aria-hidden>
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{g.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {g.child_count ?? 0} kid{g.child_count === 1 ? '' : 's'} · {g.adult_count ?? 0} adult{g.adult_count === 1 ? '' : 's'}
                          {g.source === 'rsvp_link' ? ' · via link' : g.invite_status === 'NOT_SENT' ? ' · not invited' : ''}
                        </span>
                      </span>
                      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', r.cls)}>{r.label}</span>
                    </button>
                  </li>
                )
              })}
              {shown.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">No guests match.</li> : null}
            </ul>
          </Card>
          <div className="px-4 pt-4">
            <Link href="/plan/invite" className="tap flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-secondary/50 p-4 text-sm font-semibold text-primary">
              <Send className="h-4 w-4" /> Share your invite link to collect RSVPs
            </Link>
          </div>
        </>
      )}

      <BottomSheet open={adding} onOpenChange={setAdding} title="Add a guest" description="Add another right after — the form resets.">
        <GuestForm key={formKey} initial={{ name: '', email: '', phone: '', adultCount: 1, childCount: 1 }} submitLabel="Add guest" busy={busy} onSubmit={add} />
      </BottomSheet>
      <BottomSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit guest">
        {editing ? (
          <GuestForm
            key={editing.id}
            guest={editing}
            initial={{ name: editing.name, email: editing.email, phone: editing.phone, adultCount: editing.adult_count ?? 1, childCount: editing.child_count ?? 0, notes: editing.notes, rsvp: (editing.rsvp_status as RsvpStatus) ?? 'PENDING', invited: editing.invite_status !== 'NOT_SENT' }}
            submitLabel="Save"
            busy={busy}
            onSubmit={(v) => save(editing, v)}
            onDelete={() => remove(editing)}
          />
        ) : null}
      </BottomSheet>
    </div>
  )
}
