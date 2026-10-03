'use client'
import { Card } from '@/components/app/ui'
import type { ShoppingListResult } from '@/lib/ai/schemas/shoppingList'
import { AddAllButton } from '../AddAllButton'
import { ApplyControls } from '../ApplyControls'

const LABEL = { food: 'Food', decorations: 'Decorations', activities: 'Activities', favors: 'Party favors', other: 'Other' } as const

export function ShoppingListResultView({ r, generationId, partyId }: { r: ShoppingListResult; generationId: string; partyId: string }) {
  if (!r.items.length) return <p className="text-sm text-muted-foreground">Nothing to buy yet — add activities, a theme or an AI plan first.</p>
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AddAllButton generationId={generationId} target="shopping_list" itemIds={r.items.filter((i) => !i.onList).map((i) => i.id)} partyId={partyId} label="Add all to list" />
      </div>
      {r.groups.map((g) => (
        <div key={g.category}>
          <p className="mb-2 text-sm font-semibold">{LABEL[g.category]} <span className="text-muted-foreground">({g.count})</span></p>
          <Card className="divide-y divide-border">
            {r.items.filter((i) => i.category === g.category).map((i) => (
              <div key={i.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.item}</span>
                  <span className="block text-xs text-muted-foreground">{[i.qty, i.estimatedCost ? `~$${i.estimatedCost}` : null, `from ${i.sources.join(', ')}`].filter(Boolean).join(' · ')}</span>
                </span>
                {i.onList ? <span className="shrink-0 text-xs font-semibold text-success">On your list</span> : <ApplyControls generationId={generationId} target="shopping_list" itemId={i.id} label={i.item} partyId={partyId} />}
              </div>
            ))}
          </Card>
        </div>
      ))}
      {r.estimatedTotal ? <p className="text-sm font-semibold">Estimated total: ${r.estimatedTotal} (estimate)</p> : null}
    </div>
  )
}
