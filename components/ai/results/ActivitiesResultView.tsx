'use client'
import { Card } from '@/components/app/ui'
import type { ActivitiesResult } from '@/lib/ai/schemas/activities'
import { ApplyControls } from '../ApplyControls'

export function ActivitiesResultView({ r, generationId, partyId }: { r: ActivitiesResult; generationId: string; partyId: string }) {
  return (
    <div className="space-y-3">
      {r.activities.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.durationMin} min · {a.estimatedCost ? `~$${a.estimatedCost}` : 'Free'} · {a.difficulty}{a.ageSuitability ? ` · ${a.ageSuitability}` : ''}</p>
            </div>
            <ApplyControls generationId={generationId} target="activities" itemId={a.id} label={a.name} partyId={partyId} />
          </div>
          {a.whyItFits ? <p className="mt-2 text-sm">{a.whyItFits}</p> : null}
          {a.materials.length ? <p className="mt-2 text-xs text-muted-foreground">Materials: {a.materials.join(', ')}</p> : null}
          {a.setup ? <p className="mt-1 text-xs text-muted-foreground">Setup: {a.setup}</p> : null}
          {a.instructions.length ? <ol className="mt-2 list-inside list-decimal space-y-0.5 text-sm">{a.instructions.map((s) => <li key={s}>{s}</li>)}</ol> : null}
          {a.cleanup ? <p className="mt-1 text-xs text-muted-foreground">Cleanup: {a.cleanup}</p> : null}
        </Card>
      ))}
      {r.assumptions.length ? <p className="text-xs text-muted-foreground">{r.assumptions.join(' ')}</p> : null}
    </div>
  )
}
