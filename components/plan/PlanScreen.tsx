'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Cake, CalendarDays, ChevronRight, ClipboardCheck, DollarSign, MapPin, Palette, Pencil, Send, Users } from 'lucide-react'
import { useParty } from '@/components/app/PartyProvider'
import { Card, EmptyState, LinkButton, ProgressRing, Section, Skeleton } from '@/components/app/ui'
import { VenuePhoto } from '@/components/discover/VenuePhoto'
import { usePartySummary } from '@/lib/data/summary'
import { guestTotals } from '@/lib/data/guests'
import { countdownLabel } from '@/lib/planning/progress'
import { INTERESTS } from '@/lib/discovery/taxonomy'
import { settingFromVenueType } from '@/lib/discovery/party-context'
import { track } from '@/lib/analytics/client'
import { PartyEditSheet } from './PartyEditSheet'
import { PlanWithAICard } from '@/components/ai/PlanWithAICard'

function Row({ href, icon: Icon, title, value, done }: { href: string; icon: typeof Cake; title: string; value: React.ReactNode; done?: boolean }) {
  return (
    <Link href={href} className="tap flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-muted">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-success/15 text-success' : 'bg-secondary text-primary'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted-foreground">{title}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function PlanScreen() {
  const params = useSearchParams()
  const { party, isLoading } = useParty()
  const summary = usePartySummary(party)
  const [editOpen, setEditOpen] = useState(false)
  const focus = params?.get('edit')

  useEffect(() => {
    if (focus) setEditOpen(true)
  }, [focus])

  useEffect(() => {
    if (summary && summary.progress === 100) track('party_completed', { days: summary.days })
  }, [summary?.progress]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 pt-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!party || !summary) {
    return <EmptyState icon="🎈" title="No party yet" body="Answer nine quick questions and we’ll build your plan." action={<LinkButton href="/start" block size="lg">Plan a party</LinkButton>} />
  }

  const child = party.child_name.split(' ')[0]
  const totals = guestTotals(summary.guests)
  const budget = party.budget != null ? Number(party.budget) : null
  const setting = settingFromVenueType(party.venue_type)
  const interests = (party.interests ?? []).map((i) => INTERESTS.find((x) => x.id === i)).filter(Boolean)

  return (
    <div className="pb-4">
      <div className="flex items-start justify-between gap-3 px-4 pt-5">
        <div>
          <p className="text-sm font-semibold text-primary">{child} turns {party.child_age}</p>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">
            {summary.days >= 0 ? `${child}’s party is ${summary.days === 0 ? 'today!' : summary.days === 1 ? 'tomorrow' : `${summary.days} days away`}` : `${child}’s party`}
          </h1>
        </div>
        <button type="button" onClick={() => setEditOpen(true)} aria-label="Edit party details" className="tap mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <Pencil className="h-5 w-5" />
        </button>
      </div>

      <PlanWithAICard party={party} className="px-4 pt-4" />

      <div className="px-4 pt-4">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={summary.progress} size={76} stroke={8} className="shrink-0 text-primary">
            <span className="text-lg font-bold">{summary.progress}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{summary.progress}% complete · Next</p>
            <p className="truncate text-lg font-semibold">{summary.next.title}</p>
            <Link href={summary.next.href} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {summary.next.cta} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>

      <Section title="The party" className="pt-5">
        <Card className="divide-y divide-border overflow-hidden">
          <button type="button" onClick={() => setEditOpen(true)} className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted-foreground">Date · {countdownLabel(summary.days)}</span>
              <span className="block font-semibold">{new Date(`${party.party_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </span>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          {summary.chosenVenue ? (
            <Link href={`/venue/${encodeURIComponent(summary.chosenVenue.placeId)}`} className="tap flex items-center gap-3 px-4 py-3 active:bg-muted">
              <VenuePhoto photo={summary.chosenVenue.photo} categories={summary.chosenVenue.categories} alt={summary.chosenVenue.name} sizes="thumb" className="h-10 w-10 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted-foreground">Venue</span>
                <span className="block truncate font-semibold">{summary.chosenVenue.name}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ) : (
            <Row href={summary.saved.length ? '/discover/saved' : '/discover'} icon={MapPin} title="Venue" value={summary.saved.length ? `Choose from ${summary.saved.length} saved` : 'Find a venue'} />
          )}
          <Row href="/plan/theme" icon={Palette} title="Theme" value={summary.theme ? `${summary.theme.emoji} ${summary.theme.name}` : 'Pick a theme'} done={!!summary.theme} />
          <Row href="/guests" icon={Users} title="Guests" value={summary.guests.length ? `${totals.confirmed} confirmed · ${totals.pending} waiting` : `Add guests (planning for ${party.guest_count ?? '—'})`} done={totals.confirmed > 0} />
          <Row href="/plan/invite" icon={Send} title="Invitation" value={summary.invitation?.share_count ? `Shared ${summary.invitation.share_count}×` : summary.invitation ? 'Ready to share' : 'Create invitation'} done={!!summary.invitation?.share_count} />
          <Row href="/plan/checklist" icon={ClipboardCheck} title="Checklist" value={`${summary.input.checklistDone} of ${summary.input.checklistTotal} done`} done={summary.input.checklistTotal > 0 && summary.input.checklistDone === summary.input.checklistTotal} />
        </Card>
      </Section>

      <Section title="Details">
        <Card className="space-y-3 p-4 text-[15px]">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" /> {[party.city, party.state].filter(Boolean).join(', ') || 'ZIP'} {party.zip_code} · within {party.search_radius_miles ?? 20} mi
          </p>
          <p className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            {budget != null ? `$${budget.toLocaleString('en-US')} budget · about $${Math.round(budget / Math.max(1, party.guest_count ?? 1))}/guest` : 'Budget not set'}
          </p>
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> {party.guest_count ?? '—'} guests · {setting === 'either' ? 'indoor or outdoor' : setting}
          </p>
          {interests.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {interests.map((i) => (
                <span key={i!.id} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  {i!.emoji} {i!.label}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      </Section>

      <PartyEditSheet party={party} open={editOpen} onOpenChange={setEditOpen} focus={focus} />
    </div>
  )
}
