'use client'
import Link from 'next/link'
import { Heart, MapPin } from 'lucide-react'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { formatMiles } from '@/lib/geo/distance'
import { Card, Skeleton, Stars, priceLabel } from '@/components/app/ui'
import { cn } from '@/lib/utils'
import { VenuePhoto } from './VenuePhoto'

export function VenueCard({ venue, saved, onToggleSave, priority, compact }: { venue: ClientVenue; saved: boolean; onToggleSave: (v: ClientVenue) => void; priority?: boolean; compact?: boolean }) {
  const href = `/venue/${encodeURIComponent(venue.placeId)}`
  const distance = formatMiles(venue.distanceMiles)
  const price = priceLabel(venue.priceLevel)
  const [categoryTag, ...otherTags] = venue.tags
  return (
    <Card className="overflow-hidden" data-testid="venue-card">
      <div className="relative">
        {/* Decorative duplicate of the title link: hidden from assistive tech and tab order. */}
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <VenuePhoto photo={venue.photo} categories={venue.categories} alt={venue.name} className={compact ? 'aspect-[2/1]' : 'aspect-[16/10]'} priority={priority} />
        </Link>
        {categoryTag ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">{categoryTag}</span>
        ) : null}
        <button
          type="button"
          onClick={() => onToggleSave(venue)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${venue.name} from saved` : `Save ${venue.name}`}
          className="tap absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm transition active:scale-90"
        >
          <Heart className={cn('h-5 w-5', saved ? 'fill-coral text-coral' : 'text-foreground')} />
        </button>
      </div>
      <div className="p-4">
        <Link href={href} className="block">
          <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug">{venue.name}</h3>
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Stars rating={venue.rating} count={venue.reviewCount} />
          {distance ? <span aria-label={`${distance} away`}>· {distance}</span> : null}
          {price ? <span>· {price}</span> : null}
        </div>
        {venue.shortAddress || venue.address ? (
          <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{venue.shortAddress ?? venue.address}</span>
          </p>
        ) : null}
        {otherTags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {otherTags.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {!compact ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onToggleSave(venue)}
              aria-pressed={saved}
              className={cn('tap inline-flex h-11 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold transition active:scale-[0.98]', saved ? 'border-coral/40 bg-coral/10 text-[hsl(12_70%_42%)]' : 'border-border bg-card')}
            >
              <Heart className={cn('h-4 w-4', saved && 'fill-current')} /> {saved ? 'Saved' : 'Save'}
            </button>
            <Link href={href} className="tap inline-flex h-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98]">
              View
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export function VenueCardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-hidden>
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </div>
    </Card>
  )
}
