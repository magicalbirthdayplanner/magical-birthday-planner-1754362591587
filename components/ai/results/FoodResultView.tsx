'use client'
import { Card } from '@/components/app/ui'
import type { FoodResult } from '@/lib/ai/schemas/food'
import { ApplyControls } from '../ApplyControls'

export function FoodResultView({ r, generationId, partyId }: { r: FoodResult; generationId: string; partyId: string }) {
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground" role="note">{r.allergyNote}</p>
      <Card className="space-y-2 p-4 text-sm">
        {(['main', 'snacks', 'dessert', 'drinks'] as const).map((k) =>
          r.menu[k].length ? (
            <p key={k}>
              <span className="font-semibold capitalize">{k}: </span>
              {r.menu[k].map((d) => (d.qty ? `${d.name} (${d.qty})` : d.name)).join(', ')}
            </p>
          ) : null,
        )}
      </Card>
      {r.shoppingList.length ? (
        <Card className="divide-y divide-border">
          {r.shoppingList.map((s) => (
            <div key={s.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1"><span className="block font-medium">{s.item}</span><span className="block text-xs text-muted-foreground">{[s.qty, s.estimatedCost ? `~$${s.estimatedCost}` : null].filter(Boolean).join(' · ')}</span></span>
              <ApplyControls generationId={generationId} target="shopping_list" itemId={s.id} label={s.item} partyId={partyId} />
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 text-sm font-semibold"><span>Estimated food cost</span><span>${r.estimatedTotal}</span></div>
        </Card>
      ) : null}
      {r.prepTimeline.length ? <Card className="divide-y divide-border">{r.prepTimeline.map((p) => <div key={p.when + p.task} className="flex gap-3 px-4 py-2.5 text-sm"><span className="w-28 shrink-0 font-semibold text-primary">{p.when}</span><span>{p.task}</span></div>)}</Card> : null}
      {r.tips.length ? <ul className="list-inside list-disc text-sm text-muted-foreground">{r.tips.map((t) => <li key={t}>{t}</li>)}</ul> : null}
    </div>
  )
}
