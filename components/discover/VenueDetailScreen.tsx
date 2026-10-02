'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, ChevronDown, ChevronLeft, Clock, ExternalLink, Globe, Heart, MapPin, Navigation, Phone, Share2, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useParty } from '@/components/app/PartyProvider'
import { AppButton, ErrorState, Skeleton, Stars, priceLabel } from '@/components/app/ui'
import { useChosenVenue, useVenueDetails } from '@/lib/data/hooks'
import { chooseVenue, clearChosenVenue } from '@/lib/data/venues'
import { completeTaskByKey } from '@/lib/data/checklist'
import { ApiError, friendlyError } from '@/lib/data/api'
import { formatMiles } from '@/lib/geo/distance'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import { isLegacyGeoapifyPlaceId } from '@/lib/discovery/legacy'
import { VenuePhoto } from './VenuePhoto'
import { useSaveVenue } from './useSaveVenue'
import { useSWRConfig } from 'swr'

function directionsUrl(v: { name: string; address: string | null; placeId: string; lat: number; lng: number }) {
  const q = new URLSearchParams({ api: '1', destination: v.address ?? `${v.lat},${v.lng}` })
  // Only Google place ids mean anything to Google Maps.
  if (!isLegacyGeoapifyPlaceId(v.placeId)) q.set('destination_place_id', v.placeId)
  return `https://www.google.com/maps/dir/?${q.toString()}`
}

export function VenueDetailScreen({ placeId }: { placeId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const { party } = useParty()
  const { mutate } = useSWRConfig()
  const { data, error, isLoading, mutate: reload } = useVenueDetails(placeId, party?.id)
  const chosen = useChosenVenue(party?.id)
  const { savedIds, toggle } = useSaveVenue()
  const [hoursOpen, setHoursOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const venue = data?.venue

  useEffect(() => {
    if (venue) track('venue_viewed', { category: primaryCategory(venue.categories)?.id ?? 'unknown', hasPhoto: !!venue.photo })
  }, [venue?.placeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => (window.history.length > 1 ? router.back() : router.push('/discover'))
  const isChosen = chosen.data?.placeId === placeId

  async function addToParty() {
    if (!party || !user || !venue) return
    setAdding(true)
    try {
      if (isChosen) {
        await clearChosenVenue(party.id)
        toast('Removed as your party venue')
      } else {
        await chooseVenue(party.id, user.id, venue.placeId)
        await completeTaskByKey(party.id, 'choose-venue').catch(() => undefined)
        track('venue_added_to_party', { category: primaryCategory(venue.categories)?.id ?? 'unknown' })
        toast.success(`${venue.name} is now ${party.child_name.split(' ')[0]}’s party venue 🎉`)
        if (!savedIds.has(venue.placeId)) void toggle(venue)
      }
      await Promise.all([chosen.mutate(), mutate(['checklist', party.id])])
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setAdding(false)
    }
  }

  async function share() {
    if (!venue) return
    const url = venue.googleMapsUrl ?? directionsUrl(venue)
    const text = `${venue.name}${venue.address ? ` — ${venue.address}` : ''}`
    try {
      if (navigator.share) await navigator.share({ title: venue.name, text, url })
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        toast.success('Link copied')
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  if (error) {
    const err = error as ApiError
    return (
      <div className="mx-auto min-h-dvh max-w-xl pt-safe">
        <button type="button" onClick={back} aria-label="Back" className="tap m-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <ErrorState offline={err.isNetwork} title={err.status === 404 ? 'We couldn’t find that place' : 'Couldn’t load this place'} message={err.message} onRetry={err.status === 404 ? undefined : () => reload()} />
      </div>
    )
  }

  if (isLoading || !venue) {
    return (
      <div className="mx-auto max-w-xl" aria-busy="true">
        <Skeleton className="aspect-[4/3] w-full rounded-none" />
        <div className="space-y-3 p-5">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  const saved = savedIds.has(venue.placeId)
  const cat = primaryCategory(venue.categories)
  const distance = formatMiles(venue.distanceMiles)
  const price = priceLabel(venue.priceLevel)
  const today = new Date().getDay() // 0 = Sunday; Google lists Monday first
  // Google gives 7 Monday-first lines; OpenStreetMap hours are ranges ("Mon–Fri: …"), so no single "today" line.
  const todayHours = venue.openingHours?.weekdayDescriptions.length === 7 ? venue.openingHours.weekdayDescriptions[(today + 6) % 7] : undefined

  const actions = [
    { icon: Navigation, label: 'Directions', href: directionsUrl(venue), external: true },
    venue.phone ? { icon: Phone, label: 'Call', href: `tel:${venue.phone.replace(/[^\d+]/g, '')}` } : null,
    venue.website ? { icon: Globe, label: 'Website', href: venue.website, external: true } : null,
  ].filter(Boolean) as { icon: typeof Phone; label: string; href: string; external?: boolean }[]

  return (
    <div className="mx-auto max-w-xl pb-safe">
      {/* hero */}
      <div className="relative">
        {venue.photos.length > 1 ? (
          <div className="no-scrollbar relative flex snap-x snap-mandatory overflow-x-auto" aria-label="Photos">
            {venue.photos.map((p, i) => (
              <VenuePhoto key={p.url} photo={p} categories={venue.categories} alt={`${venue.name} photo ${i + 1}`} sizes="hero" priority={i === 0} className="aspect-[4/3] w-full shrink-0 snap-center" />
            ))}
          </div>
        ) : (
          <VenuePhoto photo={venue.photo} categories={venue.categories} alt={venue.name} sizes="hero" priority className="aspect-[4/3] w-full" />
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 pt-[calc(env(safe-area-inset-top)+12px)]">
          <button type="button" onClick={back} aria-label="Back" className="tap flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={share} aria-label="Share" className="tap flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow">
              <Share2 className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => toggle(venue)} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow">
              <Heart className={cn('h-5 w-5', saved && 'fill-coral text-coral')} />
            </button>
          </div>
        </div>
        {venue.photos.length > 1 ? <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">{venue.photos.length} photos · swipe</span> : null}
      </div>

      <div className="px-5 pt-5">
        {cat ? (
          <p className="text-sm font-semibold text-primary">
            {cat.emoji} {cat.label}
            {venue.setting && venue.setting !== 'either' ? ` · ${venue.setting === 'indoor' ? 'Indoor' : 'Outdoor'}` : ''}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight tracking-tight">{venue.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted-foreground">
          <Stars rating={venue.rating} count={venue.reviewCount} />
          {distance ? <span>· {distance} away</span> : null}
          {price ? <span>· {price}</span> : null}
        </div>
        {venue.businessStatus === 'CLOSED_TEMPORARILY' ? <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">Temporarily closed according to Google</p> : null}
        {venue.address ? (
          <p className="mt-3 flex items-start gap-2 text-[15px]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {venue.address}
          </p>
        ) : null}

        {/* quick actions */}
        <div className={cn('mt-5 grid gap-2', actions.length === 3 ? 'grid-cols-4' : actions.length === 2 ? 'grid-cols-3' : 'grid-cols-2')}>
          {actions.map(({ icon: Icon, label, href, external }) => (
            <a key={label} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="tap flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-sm font-medium active:bg-muted">
              <Icon className="h-5 w-5 text-primary" /> {label}
            </a>
          ))}
          <button type="button" onClick={share} className="tap flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-sm font-medium active:bg-muted">
            <Share2 className="h-5 w-5 text-primary" /> Share
          </button>
        </div>

        {/* why recommended */}
        {venue.reasons.length ? (
          <section className="mt-6 rounded-3xl bg-secondary p-5">
            <h2 className="flex items-center gap-2 font-semibold text-secondary-foreground">
              <Sparkles className="h-5 w-5" /> Why we recommend it
            </h2>
            <ul className="mt-3 space-y-2">
              {venue.reasons.map((r) => (
                <li key={r.text} className="flex items-start gap-2 text-[15px]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {r.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {venue.tags.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {venue.tags.map((t) => (
              <span key={t} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {venue.editorialSummary ? (
          <section className="mt-6">
            <h2 className="font-semibold">About</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{venue.editorialSummary}</p>
            <p className="mt-1 text-xs text-muted-foreground">Summary from Google</p>
          </section>
        ) : null}

        {/* hours */}
        <section className="mt-6">
          <h2 className="font-semibold">Hours</h2>
          {venue.openingHours ? (
            <div className="mt-2 rounded-2xl border border-border bg-card">
              <button type="button" onClick={() => setHoursOpen((o) => !o)} aria-expanded={hoursOpen} className="tap flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span className="flex items-center gap-2 text-[15px]">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {venue.openingHours.openNow != null ? <strong className={venue.openingHours.openNow ? 'text-success' : 'text-destructive'}>{venue.openingHours.openNow ? 'Open now' : 'Closed now'}</strong> : null}
                  <span className="text-muted-foreground">{todayHours?.replace(/^\w+:\s*/, '') ?? ''}</span>
                </span>
                <ChevronDown className={cn('h-5 w-5 transition', hoursOpen && 'rotate-180')} />
              </button>
              {hoursOpen ? (
                <ul className="border-t border-border px-4 py-3 text-sm">
                  {venue.openingHours.weekdayDescriptions.map((d) => (
                    <li key={d} className="flex justify-between py-1">
                      <span>{d.split(': ')[0]}</span>
                      <span className="text-muted-foreground">{d.split(': ').slice(1).join(': ')}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Hours not listed — call ahead to check.</p>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm">
          {venue.phone ? <p>📞 <a className="font-medium text-primary" href={`tel:${venue.phone.replace(/[^\d+]/g, '')}`}>{venue.phone}</a></p> : <p className="text-muted-foreground">No phone number listed.</p>}
          {venue.website ? (
            <p className="truncate">
              🌐{' '}
              <a className="font-medium text-primary" href={venue.website} target="_blank" rel="noopener noreferrer">
                {venue.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </p>
          ) : (
            <p className="text-muted-foreground">No website listed.</p>
          )}
          {venue.googleMapsUrl ? (
            <a className="inline-flex items-center gap-1 font-medium text-primary" href={venue.googleMapsUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          {isLegacyGeoapifyPlaceId(venue.placeId) ? (
            <>
              Place data ©{' '}
              <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                OpenStreetMap contributors
              </a>{' '}
              via Geoapify
            </>
          ) : (
            'Details from Google Maps'
          )}
          {data?.stale ? ' (may be out of date)' : ''}. Party packages, capacity and pricing vary — confirm with the venue.
        </p>
      </div>

      {/* sticky actions */}
      <div aria-hidden className="h-28" />
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-border/60 bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="flex gap-3">
          <AppButton variant="outline" size="lg" onClick={() => toggle(venue)} aria-pressed={saved} className="w-[38%]">
            <Heart className={cn('h-5 w-5', saved && 'fill-coral text-coral')} /> {saved ? 'Saved' : 'Save'}
          </AppButton>
          <AppButton size="lg" block loading={adding} variant={isChosen ? 'secondary' : 'primary'} onClick={addToParty} disabled={!party}>
            {isChosen ? (
              <>
                <CheckCircle2 className="h-5 w-5" /> Party venue
              </>
            ) : (
              'Add to party'
            )}
          </AppButton>
        </div>
      </div>
    </div>
  )
}
