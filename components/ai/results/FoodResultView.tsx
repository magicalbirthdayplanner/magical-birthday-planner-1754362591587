'use client'
import { Card } from '@/components/app/ui'
import type { FoodResult } from '@/lib/ai/schemas/food'
import { AddAllButton } from '../AddAllButton'
import { ApplyControls } from '../ApplyControls'

const LABEL: Record<string, string> = { main: 'Mains', snack: 'Snacks', dessert: 'Desserts', cake: 'Cake', drink: 'Drinks', other: 'Other' }
const money = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`

export function FoodResultView({ r, generationId, partyId }: { r: FoodResult; generationId: string; partyId: string }) {
  const who = r.kids != null ? `${r.kids} kids and ${r.adults} adults` : r.guests ? `${r.guests} guests` : null
  return (
    <div className="space-y-3">
      {who ? <p className="text-sm font-semibold text-primary">Quantities for {who}</p> : null}
      <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground" role="note">{r.allergyNote}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Menu</p>
        <AddAllButton generationId={generationId} target="food" itemIds={r.items.map((d) => d.id)} partyId={partyId} label="Add all to menu" />
      </div>
      <Card className="divide-y divide-border">
        {Object.keys(LABEL).filter((c) => r.items.some((d) => d.category === c)).flatMap((c) =>
          r.items.filter((d) => d.category === c).map((d) => (
            <div key={d.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[LABEL[d.category], `${d.quantity} ${d.unit}`.trim(), d.estimated_cost ? `~${money(d.estimated_cost)} (estimate)` : null, ...d.dietary_tags].filter(Boolean).join(' · ')}
                </p>
                {d.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{d.notes}</p> : null}
              </div>
              <ApplyControls generationId={generationId} target="food" itemId={d.id} label={d.name} partyId={partyId} />
            </div>
          )),
        )}
      </Card>
      {r.shoppingList.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Food shopping list</p>
          <AddAllButton generationId={generationId} target="shopping_list" itemIds={r.shoppingList.map((s) => s.id)} partyId={partyId} label="Add all to list" />
        </div>
      ) : null}
      {r.shoppingList.length ? (
        <Card className="divide-y divide-border">
          {r.shoppingList.map((s) => (
            <div key={s.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1"><span className="block font-medium">{s.item}</span><span className="block text-xs text-muted-foreground">{[s.qty, s.estimatedCost ? `~${money(s.estimatedCost)}` : null].filter(Boolean).join(' · ')}</span></span>
              <ApplyControls generationId={generationId} target="shopping_list" itemId={s.id} label={s.item} partyId={partyId} />
            </div>
          ))}
        </Card>
      ) : null}
      {r.budget.length ? (
        <Card className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0"><span className="block font-semibold">Estimated food cost: {money(r.estimatedTotal)}</span><span className="block text-xs text-muted-foreground">Adds a planned “Food & drinks” line. What you actually spend stays yours to enter.</span></span>
          <ApplyControls generationId={generationId} target="budget" itemId={r.budget[0].id} label="Food & drinks" partyId={partyId} />
        </Card>
      ) : null}
      {r.prepTimeline.length ? <Card className="divide-y divide-border">{r.prepTimeline.map((p) => <div key={p.when + p.task} className="flex gap-3 px-4 py-2.5 text-sm"><span className="w-28 shrink-0 font-semibold text-primary">{p.when}</span><span>{p.task}</span></div>)}</Card> : null}
      {r.tips.length ? <ul className="list-inside list-disc text-sm text-muted-foreground">{r.tips.map((t) => <li key={t}>{t}</li>)}</ul> : null}
    </div>
  )
}
