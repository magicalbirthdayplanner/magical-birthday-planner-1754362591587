'use client'
import { Card } from '@/components/app/ui'
import type { ChecklistResult } from '@/lib/ai/schemas/checklist'
import { AddAllButton } from '../AddAllButton'
import { ApplyControls } from '../ApplyControls'

const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Any time')

export function ChecklistResultView({ r, generationId, partyId }: { r: ChecklistResult; generationId: string; partyId: string }) {
  if (!r.tasks.length) return <p className="text-sm text-muted-foreground">Your checklist already covers everything we’d suggest. 🎉</p>
  return (
    <div className="space-y-3">
      {r.skipped ? <p className="text-xs text-muted-foreground">Skipped {r.skipped} suggestion{r.skipped === 1 ? '' : 's'} you already have covered.</p> : null}
      <Card className="divide-y divide-border">
        {r.tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              {t.notes ? <p className="text-sm text-muted-foreground">{t.notes}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Due {fmt(t.dueDate)} · {t.priority} priority · {t.effort}
                {t.late ? <span className="ml-1 rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">Do this now</span> : null}
              </p>
            </div>
            <ApplyControls generationId={generationId} target="checklist" itemId={t.id} label={t.title} partyId={partyId} />
          </div>
        ))}
      </Card>
      {r.assumptions.length ? <p className="text-xs text-muted-foreground">{r.assumptions.join(' ')}</p> : null}
      <AddAllButton generationId={generationId} target="checklist" itemIds={r.tasks.map((t) => t.id)} partyId={partyId} label="Add all to checklist" className="h-12 w-full" />
    </div>
  )
}
