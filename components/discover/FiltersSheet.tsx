'use client'
import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Chip } from '@/components/app/ui'
import { DEFAULT_FILTERS, type PartySizeBand, type VenueFilters } from '@/lib/discovery/filters'
import { RADIUS_OPTIONS } from '@/lib/discovery/config'
import { AGE_BANDS, INTERESTS, type AgeBandId, type InterestId } from '@/lib/discovery/taxonomy'

const PARTY_SIZES: { id: PartySizeBand; label: string }[] = [
  { id: 'lt10', label: 'Under 10' },
  { id: '10-20', label: '10–20' },
  { id: '20-40', label: '20–40' },
  { id: '40+', label: '40+' },
]

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-border/60 py-4 last:border-0">
      <legend className="mb-3 text-base font-semibold">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </fieldset>
  )
}

const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

export function FiltersSheet({
  open,
  onOpenChange,
  filters,
  radius,
  onApply,
  resultCount,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  filters: VenueFilters
  radius: number
  onApply: (f: VenueFilters, radius: number) => void
  resultCount: (f: VenueFilters) => number
}) {
  const [f, setF] = useState(filters)
  const [r, setR] = useState(radius)
  useEffect(() => {
    if (open) {
      setF(filters)
      setR(radius)
    }
  }, [open, filters, radius])

  const count = resultCount(f)
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      footer={
        <div className="flex gap-3">
          <AppButton
            variant="ghost"
            onClick={() => {
              setF(DEFAULT_FILTERS)
              setR(20)
            }}
          >
            Reset
          </AppButton>
          <AppButton block onClick={() => onApply(f, r)}>
            {r !== radius ? 'Search again' : `Show ${count} place${count === 1 ? '' : 's'}`}
          </AppButton>
        </div>
      }
    >
      <Group title="Distance">
        {RADIUS_OPTIONS.map((m) => (
          <Chip key={m} active={r === m} onClick={() => setR(m)}>
            {m} miles
          </Chip>
        ))}
      </Group>
      <Group title="Venue type">
        {(['indoor', 'outdoor'] as const).map((s) => (
          <Chip key={s} active={f.setting === s} onClick={() => setF({ ...f, setting: f.setting === s ? 'any' : s })}>
            {s === 'indoor' ? '🏠 Indoor' : '🌳 Outdoor'}
          </Chip>
        ))}
      </Group>
      <Group title="Rating">
        {([4, 4.5] as const).map((x) => (
          <Chip key={x} active={f.minRating === x} onClick={() => setF({ ...f, minRating: f.minRating === x ? 0 : x })}>
            ★ {x}+
          </Chip>
        ))}
      </Group>
      <Group title="Price" hint="Places without published prices are hidden while a price filter is on.">
        {[1, 2, 3, 4].map((p) => (
          <Chip key={p} active={f.prices.includes(p)} onClick={() => setF({ ...f, prices: toggle(f.prices, p) })} aria-label={`Price level ${p} of 4`}>
            {'$'.repeat(p)}
          </Chip>
        ))}
      </Group>
      <Group title="Age">
        {AGE_BANDS.map((a) => (
          <Chip key={a.id} active={f.ages.includes(a.id)} onClick={() => setF({ ...f, ages: toggle<AgeBandId>(f.ages, a.id) })}>
            {a.label}
          </Chip>
        ))}
      </Group>
      <Group title="Party size" hint="Most places don’t publish capacity — call to confirm. Places Google marks as not good for groups are hidden for 10+.">
        {PARTY_SIZES.map((p) => (
          <Chip key={p.id} active={f.partySize === p.id} onClick={() => setF({ ...f, partySize: f.partySize === p.id ? null : p.id })}>
            {p.label}
          </Chip>
        ))}
      </Group>
      <Group title="Interest">
        {INTERESTS.map((i) => (
          <Chip key={i.id} active={f.interests.includes(i.id)} onClick={() => setF({ ...f, interests: toggle<InterestId>(f.interests, i.id) })}>
            <span aria-hidden>{i.emoji}</span> {i.label}
          </Chip>
        ))}
      </Group>
    </BottomSheet>
  )
}
