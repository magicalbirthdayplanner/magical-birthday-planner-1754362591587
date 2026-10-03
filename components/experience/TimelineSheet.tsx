'use client'
/** The party-day timeline (single source of truth): ordered steps with times; activity steps follow their activity. */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, Chip } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { addActivityToTimeline, addTimelineStep, moveTimelineStep, removeTimelineStep, setTimelineMinutes, type Experience } from '@/lib/data/experience'
import { computeTimeline, formatMinutes, TIMELINE_KINDS, type TimelineKind } from '@/lib/experience/model'
import { act } from './apply'

export const KIND_EMOJI: Record<TimelineKind, string> = { arrival: '👋', welcome: '🎤', activity: '🎲', food: '🍕', cake: '🎂', gifts: '🎁', closing: '👋', other: '•' }
const KIND_LABEL: Record<TimelineKind, string> = { arrival: 'Arrival', welcome: 'Welcome', activity: 'Activity', food: 'Food', cake: 'Cake', gifts: 'Gifts', closing: 'Goodbye', other: 'Other' }

export function timelineOf(data: Experience, startTime: string | null) {
  const minutes = new Map(data.activities.map((a) => [a.id, a.duration_min]))
  return computeTimeline(data.timeline.map((t) => ({ ...t, kind: t.kind as TimelineKind })), (id) => minutes.get(id) ?? null, startTime)
}

export function TimelineSheet({ partyId, data, startTime, partyMinutes, open, onOpenChange }: { partyId: string; data: Experience; startTime: string | null; partyMinutes: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = useState<TimelineKind>('food')
  const [label, setLabel] = useState('')
  const [mins, setMins] = useState('')
  const t = timelineOf(data, startTime)
  const notOn = data.activities.filter((a) => a.status === 'planned' && !data.timeline.some((x) => x.activity_id === a.id))
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Party timeline" description={`${formatMinutes(t.totalMinutes)} planned${partyMinutes ? ` · party is ${formatMinutes(partyMinutes)}` : ''}${startTime ? '' : ' · set a start time on the invitation to see clock times'}`}>
      <div className="space-y-4 pb-2">
        {partyMinutes && t.totalMinutes > partyMinutes ? <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">That’s {t.totalMinutes - partyMinutes} min longer than the party — shorten a step or remove one.</p> : null}
        {t.rows.length ? (
          <Card className="divide-y divide-border">
            {t.rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2 py-2 pl-4 pr-1" data-testid="timeline-row">
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-primary">{r.clock}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-medium leading-snug"><span aria-hidden>{KIND_EMOJI[r.kind]}</span> {r.label}</span>
                  {r.activity_id ? (
                    <span className="block text-xs text-muted-foreground">{r.minutes} min · from the activity</span>
                  ) : (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input inputMode="numeric" aria-label={`Minutes for ${r.label}`} className="h-8 w-12 rounded-lg border border-input bg-card px-1 text-center text-base text-foreground" defaultValue={r.minutes} onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== r.minutes) void act(partyId, () => setTimelineMinutes(r.id, v)) }} />
                      min
                    </label>
                  )}
                </span>
                <button type="button" aria-label={`Move ${r.label} earlier`} disabled={i === 0} onClick={() => act(partyId, () => moveTimelineStep(data.timeline, r.id, -1))} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label={`Move ${r.label} later`} disabled={i === t.rows.length - 1} onClick={() => act(partyId, () => moveTimelineStep(data.timeline, r.id, 1))} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label={`Remove ${r.label}`} onClick={() => act(partyId, () => removeTimelineStep(r.id))} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </Card>
        ) : <p className="text-sm text-muted-foreground">Nothing scheduled yet. Add your activities and the moments around them.</p>}
        {notOn.length ? (
          <section className="space-y-2">
            <h3 className="text-base font-bold">Add your activities</h3>
            <div className="flex flex-wrap gap-2">
              {notOn.map((a) => <Chip key={a.id} onClick={() => act(partyId, () => addActivityToTimeline(a, data.timeline), 'Added to your timeline.')}>+ {a.name}</Chip>)}
            </div>
          </section>
        ) : null}
        <section className="space-y-2">
          <h3 className="text-base font-bold">Add a moment</h3>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind">
            {TIMELINE_KINDS.filter((k) => k !== 'activity').map((k) => <Chip key={k} role="radio" aria-checked={kind === k} active={kind === k} onClick={() => { setKind(k); if (!label) setLabel(KIND_LABEL[k]) }}>{KIND_EMOJI[k]} {KIND_LABEL[k]}</Chip>)}
          </div>
          <div className="flex items-end gap-2">
            <TextField className="min-w-0 flex-1" label="What happens" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pizza and juice" />
            <TextField className="w-24 shrink-0" label="Minutes" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </div>
          <AppButton block variant="secondary" disabled={!label.trim()} onClick={async () => { await act(partyId, () => addTimelineStep(partyId, data.timeline, kind, label.trim(), mins ? Number(mins) : null), 'Added to your timeline.'); setLabel(''); setMins('') }}>Add to timeline</AppButton>
        </section>
      </div>
    </BottomSheet>
  )
}
