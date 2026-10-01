'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, CalendarHeart, Check, ChevronRight, Heart, MapPin, Sparkles, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useParty } from '@/components/app/PartyProvider'
import { Card, LinkButton, ProgressRing, Section, Skeleton, Stars } from '@/components/app/ui'
import { VenuePhoto } from '@/components/discover/VenuePhoto'
import { Logo } from '@/components/app/Logo'
import { useDiscovery } from '@/lib/data/hooks'
import { usePartySummary } from '@/lib/data/summary'
import { guestTotals } from '@/lib/data/guests'
import { setTaskDone } from '@/lib/data/checklist'
import { countdownLabel, greeting } from '@/lib/planning/progress'
import { formatMiles } from '@/lib/geo/distance'
import { clampRadius } from '@/lib/discovery/config'
import { track } from '@/lib/analytics/client'
import { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils'

function Welcome() {
  return (
    <div className="bg-magic px-5 pb-10 pt-6">
      <div className="mbp-rise">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Local party discovery
        </p>
        <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.08] tracking-tight text-balance">Plan your child’s birthday in minutes.</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
          No more hours of searching. Tell us about your child and your ZIP code — we’ll find party venues, cake shops and ideas near you.
        </p>
        <div className="mt-6 space-y-3">
          <LinkButton href="/start" size="lg" variant="magic" block>
            Plan a party <ArrowRight className="h-5 w-5" />
          </LinkButton>
          <LinkButton href="/login" size="lg" variant="outline" block>
            I already have an account
          </LinkButton>
        </div>
      </div>
      <ul className="mt-10 space-y-3">
        {[
          ['📍', 'Places near you, automatically', 'Venues, parks, studios and bakeries matched to your ZIP code.'],
          ['🎨', 'Matched to your child', 'Art lover? Sports star? We rank places by what they’re into.'],
          ['✅', 'A plan that keeps you on track', 'Countdown checklist, guest list and an invite you can text.'],
        ].map(([emoji, title, body]) => (
          <li key={title}>
            <Card className="flex gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-2xl" aria-hidden>
                {emoji}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{body}</span>
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NoParty({ name }: { name: string }) {
  return (
    <div className="bg-magic px-5 pb-10 pt-8">
      <p className="text-muted-foreground">{greeting(new Date().getHours())}{name ? `, ${name}` : ''} 👋</p>
      <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight tracking-tight">Let’s plan your first party.</h1>
      <p className="mt-3 text-muted-foreground">Nine quick questions, then we’ll find party places near you.</p>
      <LinkButton href="/start" size="lg" variant="magic" block className="mt-6">
        Plan a party <ArrowRight className="h-5 w-5" />
      </LinkButton>
    </div>
  )
}

export function HomeScreen() {
  const { user, loading } = useAuth()
  const { party, parties, isLoading } = useParty()
  const summary = usePartySummary(party)
  const discovery = useDiscovery(party?.id, clampRadius(party?.search_radius_miles ?? 20))
  const { mutate } = useSWRConfig()
  const [hour, setHour] = useState(12)
  useEffect(() => setHour(new Date().getHours()), [])

  if (loading || (user && isLoading)) {
    return (
      <div className="space-y-4 px-4 pt-6">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (!user) return <Welcome />
  const firstName = (user.user_metadata?.display_name || user.user_metadata?.full_name || '').toString().split(' ')[0]
  if (!party || !summary) return <NoParty name={firstName} />

  const child = party.child_name.split(' ')[0]
  const recommended = (discovery.data?.venues ?? []).slice(0, 8)
  const totals = guestTotals(summary.guests)
  const past = summary.days < 0

  async function toggleTask(id: string, done: boolean) {
    await setTaskDone(id, done)
    if (done) track('checklist_completed', { from: 'home' })
    await mutate(['checklist', party!.id])
  }

  return (
    <div className="pb-4">
      <div className="px-4 pt-5">
        <p className="text-muted-foreground">
          {greeting(hour)}
          {firstName ? `, ${firstName}` : ''} 👋
        </p>
        {parties.length > 1 ? (
          <Link href="/more#parties" className="text-xs font-semibold text-primary">
            Switch party ({parties.length})
          </Link>
        ) : null}
      </div>

      {/* countdown hero */}
      <div className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-[28px] bg-hero p-5 text-white shadow-xl shadow-primary/25">
          <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-[hsl(40_92%_70%/0.25)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/85">{past ? `${child}’s party was` : `${child}’s birthday is in`}</p>
              <p className="mt-1 font-display text-[44px] font-semibold leading-none tracking-tight" data-testid="countdown">
                {past ? 'Done 🎉' : countdownLabel(summary.days).toUpperCase()}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
                <CalendarHeart className="h-4 w-4" />
                {new Date(`${party.party_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <ProgressRing value={summary.progress} size={84} stroke={8} className="shrink-0 text-white">
              <span className="text-center leading-tight">
                <span className="block text-xl font-bold">{summary.progress}%</span>
                <span className="block text-[10px] uppercase tracking-wide text-white/80">done</span>
              </span>
            </ProgressRing>
          </div>
          <div className="relative mt-5 rounded-2xl bg-white/15 p-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-white/75">Next step</p>
            <p className="mt-0.5 text-lg font-semibold">{summary.next.title}</p>
          </div>
          <Link href={summary.next.href} className="tap relative mt-4 flex h-14 items-center justify-center gap-2 rounded-full bg-white text-base font-semibold text-primary shadow-lg active:scale-[0.98]">
            Continue planning <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* recommended venues */}
      {!summary.chosenVenue ? (
        <Section title="Recommended for you" action={<Link href="/discover" className="text-sm font-semibold text-primary">See all</Link>} className="pt-6">
          {discovery.isLoading && !discovery.data ? (
            <div className="flex gap-3">
              <Skeleton className="h-52 w-60 shrink-0" />
              <Skeleton className="h-52 w-60 shrink-0" />
            </div>
          ) : recommended.length ? (
            <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {recommended.map((v) => (
                <Link key={v.placeId} href={`/venue/${encodeURIComponent(v.placeId)}`} className="w-60 shrink-0 snap-start">
                  <Card className="overflow-hidden">
                    <VenuePhoto photo={v.photo} categories={v.categories} alt={v.name} className="aspect-[3/2]" />
                    <div className="p-3">
                      <p className="truncate font-semibold">{v.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        <Stars rating={v.rating} count={v.reviewCount} /> {v.distanceMiles != null ? `· ${formatMiles(v.distanceMiles)}` : ''}
                      </p>
                      {v.reasons[0] ? <p className="mt-1 truncate text-xs font-medium text-primary">{v.reasons[0].text}</p> : null}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">
              <Link href="/discover" className="font-semibold text-primary">Find party places near {party.zip_code}</Link>
            </Card>
          )}
        </Section>
      ) : (
        <Section title="Your venue" className="pt-6">
          <Link href={`/venue/${encodeURIComponent(summary.chosenVenue.placeId)}`}>
            <Card className="flex gap-3 p-3">
              <VenuePhoto photo={summary.chosenVenue.photo} categories={summary.chosenVenue.categories} alt={summary.chosenVenue.name} sizes="thumb" className="h-20 w-20 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                  <Check className="h-3.5 w-3.5" /> Booked for the party
                </p>
                <p className="truncate font-semibold">{summary.chosenVenue.name}</p>
                <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {summary.chosenVenue.shortAddress ?? summary.chosenVenue.address}
                </p>
              </div>
            </Card>
          </Link>
        </Section>
      )}

      {/* saved + guests */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <Link href="/discover/saved">
          <Card className="h-full p-4">
            <Heart className="h-6 w-6 text-coral" />
            <p className="mt-3 text-2xl font-semibold">{summary.saved.length}</p>
            <p className="text-sm text-muted-foreground">Saved places</p>
          </Card>
        </Link>
        <Link href="/guests">
          <Card className="h-full p-4">
            <Users className="h-6 w-6 text-primary" />
            <p className="mt-3 text-2xl font-semibold">
              {totals.confirmed}
              <span className="text-base font-medium text-muted-foreground"> / {Math.max(totals.invited, party.guest_count ?? 0)}</span>
            </p>
            <p className="text-sm text-muted-foreground">Guests confirmed</p>
          </Card>
        </Link>
      </div>

      {/* theme */}
      <Section title="Theme" action={<Link href="/plan/theme" className="text-sm font-semibold text-primary">{summary.theme ? 'Change' : 'Browse'}</Link>} className="pt-5">
        {summary.theme ? (
          <Link href="/plan/theme">
            <div className={cn('flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white', summary.theme.color)}>
              <span className="text-5xl drop-shadow" aria-hidden>
                {summary.theme.emoji}
              </span>
              <span>
                <span className="block text-lg font-semibold drop-shadow">{summary.theme.name}</span>
                {summary.theme.description ? <span className="line-clamp-2 block text-sm text-white/90">{summary.theme.description}</span> : null}
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/plan/theme">
            <Card className="flex items-center justify-between p-4">
              <span>
                <span className="block font-semibold">Pick a theme</span>
                <span className="block text-sm text-muted-foreground">Ideas matched to {child}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          </Link>
        )}
      </Section>

      {/* checklist */}
      <Section title="Up next" action={<Link href="/plan/checklist" className="text-sm font-semibold text-primary">Checklist</Link>} className="pt-3">
        {summary.loading && !summary.tasks.length ? (
          <Skeleton className="h-36 w-full" />
        ) : summary.openTasks.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Everything’s done. Enjoy the party! 🎉</Card>
        ) : (
          <Card className="divide-y divide-border">
            {summary.openTasks.slice(0, 3).map((t) => (
              <label key={t.id} className="tap flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-3">
                <input type="checkbox" className="h-6 w-6 shrink-0 rounded-md accent-[hsl(258_56%_45%)]" onChange={(e) => toggleTask(t.id, e.target.checked)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.title}</span>
                  {t.due_date ? <span className="block text-xs text-muted-foreground">Due {new Date(`${t.due_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span> : null}
                </span>
              </label>
            ))}
          </Card>
        )}
      </Section>

      <div className="flex justify-center px-4 pt-4">
        <Logo className="opacity-30" />
      </div>
    </div>
  )
}
