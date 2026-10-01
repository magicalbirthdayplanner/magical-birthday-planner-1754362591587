'use client'
import { useState } from 'react'
import type { ClientPhoto } from '@/lib/discovery/client-venue'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import { cn } from '@/lib/utils'

/** Venue photo with a tasteful fallback (no photo ≠ fake photo) and the required author attribution. */
export function VenuePhoto({ photo, categories, alt, className, sizes = 'card', priority }: { photo: ClientPhoto | null; categories: string[]; alt: string; className?: string; sizes?: 'card' | 'hero' | 'thumb'; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  const cat = primaryCategory(categories)
  if (!photo || failed) {
    return (
      <div className={cn('relative flex items-center justify-center bg-gradient-to-br from-secondary via-accent to-secondary', className)} role="img" aria-label={`${alt} (no photo available)`}>
        <span className={cn(sizes === 'thumb' ? 'text-2xl' : 'text-5xl', 'opacity-80')} aria-hidden>
          {cat?.emoji ?? '🎉'}
        </span>
        {sizes !== 'thumb' ? <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground">No photo yet</span> : null}
      </div>
    )
  }
  const credit = photo.attributions[0]?.displayName
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied Google photo; next/image optimization is disabled in this project */}
      <img
        src={photo.url}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {credit && sizes !== 'thumb' ? (
        <span className="pointer-events-none absolute bottom-1.5 right-2 max-w-[60%] truncate rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/90">
          Photo: {credit}
        </span>
      ) : null}
    </div>
  )
}
