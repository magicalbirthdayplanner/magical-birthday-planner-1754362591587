'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, GitCompare, Heart, Share2, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useParty } from '@/components/app/PartyProvider'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, EmptyState, ErrorState, LinkButton, PageHeader, Skeleton, Stars, priceLabel } from '@/components/app/ui'
import { useChosenVenue } from '@/lib/data/hooks'
import { chooseVenue, updateSavedVenueNotes, type SavedVenue } from '@/lib/data/venues'
import { completeTaskByKey } from '@/lib/data/checklist'
import { friendlyError } from '@/lib/data/api'
import { formatMiles, haversineMiles } from '@/lib/geo/distance'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import { VenuePhoto } from './VenuePhoto'
import { useSaveVenue } from './useSaveVenue'

function NotesField({ item }: { item: SavedVenue }) {
  const [value, setValue] = useState(item.notes ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  useEffect(() => setValue(item.notes ?? ''), [item.notes])
  async function save() {
    if ((item.notes ?? '') === value || item.id.startsWith('tmp-')) return
    setState('saving')
    try {
      await updateSavedVenueNotes(item.id, value)
      setState('saved')
      setTimeout(() => setState('idle'), 1500)
    } catch (e) {
      setState('idle')
      toast.error(friendlyError(e, 'Couldn’t save your note.'))
    }
  }
  return (
    <div className="mt-3">
      <label className="sr-only" htmlFor={`note-${item.id}`}>
        Private note for {item.venue?.name}
      </label>
      <textarea
        id={`note-${item.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        maxLength={2000}
        rows={2}
        placeholder="Add a private note (e.g. “Ask about the Saturday package”)"
        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
      <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Only you can see notes.'}
      </p>
    </div>
  )
}

function CompareSheet({ open, onOpenChange, venues, center }: { open: boolean; onOpenChange: (o: boolean) => void; venues: ClientVenue[]; center: { lat: number; lng: number } | null }) {
  const rows: [string, (v: ClientVenue) => React.ReactNode][] = [
    ['Type', (v) => primaryCategory(v.categories)?.label ?? '—'],
    ['Rating', (v) => (v.rating != null ? `★ ${v.rating.toFixed(1)}` : '—')],
    ['Reviews', (v) => (v.reviewCount != null ? v.reviewCount.toLocaleString('en-US') : '—')],
    ['Distance', (v) => (center ? formatMiles(haversineMiles(center, v)) : '—')],
    ['Price', (v) => priceLabel(v.priceLevel) ?? 'Not listed'],
    ['Setting', (v) => (v.setting === 'indoor' ? 'Indoor' : v.setting === 'outdoor' ? 'Outdoor' : '—')],
    ['Phone', (v) => (v.phone ? <a className="text-primary" href={`tel:${v.phone}`}>{v.phone}</a> : '—')],
    ['Website', (v) => (v.website ? <a className="text-primary" href={v.website} target="_blank" rel="noopener noreferrer">Visit</a> : '—')],
  ]
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Compare" description="Swipe sideways to see every place.">
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <table className="w-max border-separate border-spacing-x-3 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-20 bg-background" />
              {venues.map((v) => (
                <th key={v.placeId} scope="col" className="w-40 pb-3 text-left align-top">
                  <VenuePhoto photo={v.photo} categories={v.categories} alt={v.name} sizes="thumb" className="mb-2 aspect-[4/3] w-40 rounded-xl" />
                  <span className="line-clamp-2 font-semibold">{v.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <th scope="row" className="sticky left-0 z-10 bg-background py-2 pr-2 text-left font-medium text-muted-foreground">
                  {label}
                </th>
                {venues.map((v) => (
                  <td key={v.placeId} className="border-t border-border py-2">
                    {get(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Phone and website appear once you’ve opened a place.</p>
    </BottomSheet>
  )
}

export function SavedScreen() {
  const { user } = useAuth()
  const { party } = useParty()
  const { saved, toggle } = useSaveVenue()
  const chosen = useChosenVenue(party?.id)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const loading = !!party && saved.length === 0 && chosen.isLoading

  const center = party?.latitude != null && party.longitude != null ? { lat: party.latitude, lng: party.longitude } : null
  const items = saved.filter((s) => s.venue)

  async function makeVenue(v: ClientVenue) {
    if (!party || !user) return
    setBusy(v.placeId)
    try {
      await chooseVenue(party.id, user.id, v.placeId)
      await completeTaskByKey(party.id, 'choose-venue').catch(() => undefined)
      track('venue_added_to_party', { from: 'saved' })
      toast.success(`${v.name} is your party venue 🎉`)
      await chosen.mutate()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  async function shareList() {
    const text = items.map((s, i) => `${i + 1}. ${s.venue!.name}${s.venue!.address ? ` — ${s.venue!.address}` : ''}`).join('\n')
    const title = `${party?.child_name.split(' ')[0] ?? 'Our'}’s party shortlist`
    try {
      if (navigator.share) await navigator.share({ title, text: `${title}\n${text}` })
      else {
        await navigator.clipboard.writeText(`${title}\n${text}`)
        toast.success('Shortlist copied')
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <div>
      <PageHeader
        back="/discover"
        title="Saved places"
        subtitle={party ? `${party.child_name.split(' ')[0]}’s shortlist · ${items.length} place${items.length === 1 ? '' : 's'}` : undefined}
        action={
          items.length ? (
            <button type="button" onClick={shareList} aria-label="Share shortlist" className="tap flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
              <Share2 className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />
      {loading ? (
        <div className="space-y-3 px-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !party ? (
        <ErrorState title="No party yet" message="Create a party to start saving places." />
      ) : items.length === 0 ? (
        <EmptyState icon={<Heart className="h-7 w-7" />} title="No saved places yet" body="Tap the heart on any place to add it to your shortlist." action={<LinkButton href="/discover" block>Discover places</LinkButton>} />
      ) : (
        <ul className="space-y-4 px-4">
          {items.map((s) => {
            const v = s.venue!
            const isChosen = chosen.data?.placeId === v.placeId
            const comparing = compareIds.includes(v.placeId)
            return (
              <li key={s.id}>
                <Card className={cn('p-3', isChosen && 'ring-2 ring-primary')}>
                  <div className="flex gap-3">
                    <Link href={`/venue/${encodeURIComponent(v.placeId)}`} className="shrink-0">
                      <VenuePhoto photo={v.photo} categories={v.categories} alt={v.name} sizes="thumb" className="h-24 w-24 rounded-xl" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      {isChosen ? (
                        <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Party venue
                        </p>
                      ) : null}
                      <Link href={`/venue/${encodeURIComponent(v.placeId)}`} className="line-clamp-2 font-semibold leading-snug">
                        {v.name}
                      </Link>
                      <div className="mt-1 text-sm text-muted-foreground">
                        <Stars rating={v.rating} count={v.reviewCount} />
                        {center ? <span> · {formatMiles(haversineMiles(center, v))}</span> : null}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{v.shortAddress ?? v.address ?? ''}</p>
                    </div>
                  </div>
                  <NotesField item={s} />
                  <div className="mt-1 flex items-center gap-2">
                    {!isChosen ? (
                      <AppButton size="sm" loading={busy === v.placeId} onClick={() => makeVenue(v)} className="flex-1">
                        Add to party
                      </AppButton>
                    ) : (
                      <span className="flex-1" />
                    )}
                    <button
                      type="button"
                      aria-pressed={comparing}
                      onClick={() => setCompareIds((ids) => (comparing ? ids.filter((x) => x !== v.placeId) : [...ids, v.placeId].slice(-4)))}
                      className={cn('tap inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium', comparing ? 'border-primary bg-secondary text-secondary-foreground' : 'border-border')}
                    >
                      <GitCompare className="h-4 w-4" /> Compare
                    </button>
                    <button type="button" aria-label={`Remove ${v.name}`} onClick={() => toggle(v)} className="tap inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {compareIds.length >= 2 ? (
        <div className="fixed inset-x-0 bottom-above-nav z-30 mx-auto max-w-xl px-4">
          <AppButton block size="lg" onClick={() => setCompareOpen(true)} className="shadow-xl">
            <GitCompare className="h-5 w-5" /> Compare {compareIds.length} places
          </AppButton>
        </div>
      ) : null}
      <CompareSheet open={compareOpen} onOpenChange={setCompareOpen} venues={items.filter((s) => compareIds.includes(s.place_id)).map((s) => s.venue!)} center={center} />
    </div>
  )
}
