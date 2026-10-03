'use client'
import { Card, Chip } from '@/components/app/ui'
import type { TimelineResult } from '@/lib/ai/schemas/timeline'
import { ApplyControls } from '../ApplyControls'

const ADJUST = [['relaxed', 'Make it more relaxed'], ['more_games', 'Add more games'], ['less_prep', 'Reduce preparation']] as const
const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '')

export function TimelineResultView({ r, generationId, partyId, rerun }: { r: TimelineResult; generationId: string; partyId: string; rerun: (extra: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <Card className="divide-y divide-border">
        {r.entries.map((e) => (
          <div key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
            <span className="w-12 shrink-0 font-semibold tabular-nums text-primary">{e.time}</span>
            <span>{e.label}{e.notes ? <span className="block text-xs text-muted-foreground">{e.notes}</span> : null}</span>
          </div>
        ))}
      </Card>
      <div className="flex flex-wrap gap-2" aria-label="Adjust the timeline">
        {ADJUST.map(([k, label]) => <Chip key={k} onClick={() => rerun({ adjust: k })}>{label}</Chip>)}
      </div>
      {r.prepTasks.length ? (
        <>
          <p className="text-sm font-semibold">Before the party</p>
          <Card className="divide-y divide-border">
            {r.prepTasks.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{p.dueDate ? `By ${fmt(p.dueDate)}` : ''}{p.late ? ' · do this now' : ''}</p></div>
                <ApplyControls generationId={generationId} target="checklist" itemId={p.id} label={p.title} partyId={partyId} />
              </div>
            ))}
          </Card>
        </>
      ) : null}
      {r.assumptions.length ? <p className="text-xs text-muted-foreground">{r.assumptions.join(' ')}</p> : null}
    </div>
  )
}
