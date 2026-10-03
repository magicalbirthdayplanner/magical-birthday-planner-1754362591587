'use client'
import { Card } from '@/components/app/ui'
import type { BudgetResult } from '@/lib/ai/schemas/budget'
import { ApplyControls } from '../ApplyControls'

const $ = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`

export function BudgetResultView({ r, generationId, partyId }: { r: BudgetResult; generationId: string; partyId: string }) {
  return (
    <div className="space-y-3">
      <Card className="grid grid-cols-3 gap-2 p-4 text-center text-sm">
        <div><p className="text-xs text-muted-foreground">Planned now</p><p className="font-semibold">{$(r.currentTotal)}</p></div>
        <div><p className="text-xs text-muted-foreground">After changes</p><p className="font-semibold">{$(r.projectedTotal)}</p></div>
        <div><p className="text-xs text-muted-foreground">Budget</p><p className={`font-semibold ${r.overBy ? 'text-destructive' : 'text-success'}`}>{r.target != null ? $(r.target) : '—'}</p></div>
      </Card>
      {r.overBy ? <p className="text-sm text-destructive">Still about {$(r.overBy)} over budget — consider the trade-offs below.</p> : null}
      <Card className="divide-y divide-border">
        {r.suggestions.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.category}: {$(s.newAmount)}</p>
              <p className="text-sm">{s.change}</p>
              <p className="text-xs text-muted-foreground">{s.currentAmount ? (s.savings >= 0 ? `Saves ${$(s.savings)}` : `Adds ${$(-s.savings)}`) : 'New line'}{s.reason ? ` · ${s.reason}` : ''}</p>
            </div>
            <ApplyControls generationId={generationId} target="budget" itemId={s.id} label={s.category} partyId={partyId} />
          </div>
        ))}
      </Card>
      {r.missing.length ? (
        <>
          <p className="text-sm font-semibold">You may be missing</p>
          <Card className="divide-y divide-border">
            {r.missing.map((m) => (
              <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.category}: {$(m.amount)}</p>
                  {m.note ? <p className="text-xs text-muted-foreground">{m.note}</p> : null}
                </div>
                <ApplyControls generationId={generationId} target="budget" itemId={m.id} label={m.category} partyId={partyId} />
              </div>
            ))}
          </Card>
        </>
      ) : null}
      {r.tradeoffs.length ? <ul className="list-inside list-disc text-sm text-muted-foreground">{r.tradeoffs.map((t) => <li key={t}>{t}</li>)}</ul> : null}
      <p className="text-xs text-muted-foreground">Estimates only — prices vary by store and area. Using a suggestion changes the planned amount for that line; what you’ve actually spent is never changed.</p>
    </div>
  )
}
