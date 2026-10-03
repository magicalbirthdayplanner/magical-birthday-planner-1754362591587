'use client'
/**
 * Plan → "Your party plan": the activities, shopping list and budget lines the parent added from AI suggestions.
 * Renders nothing until something has been added. Budget keeps estimates (AI or edited) apart from what the
 * parent actually spent; only the parent ever enters "spent".
 */
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Copy, Mic, PiggyBank, Puzzle, ShoppingBasket, Trash2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/app/BottomSheet'
import { Card, Section } from '@/components/app/ui'
import { friendlyError } from '@/lib/data/api'
import { listPlanItems, removeActivity, removeBudgetLine, removeShoppingItem, setActualSpend, setShoppingDone, usePlanItems, type BudgetLine, type PartyPlanItems } from '@/lib/data/partyPlanItems'
import { cn } from '@/lib/utils'
import { EXPERIENCE_ENABLED } from '@/lib/experience/flags'
import { addFoodToShopping, removeFoodItem, useExperience, type Experience } from '@/lib/data/experience'
import { formatMinutes } from '@/lib/experience/model'
import { TimelineSheet, timelineOf } from '@/components/experience/TimelineSheet'
import { act as actExp } from '@/components/experience/apply'

const $ = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`
const CATEGORY = { food: 'Food', decorations: 'Decorations', activities: 'Activities', favors: 'Party favors', other: 'Other' } as Record<string, string>

type Open = null | 'activities' | 'shopping' | 'budget' | 'timeline' | 'menu' | 'host'

export function PartyPlanSection({ partyId, budget, startTime = null, partyMinutes = null }: { partyId: string; budget: number | null; startTime?: string | null; partyMinutes?: number | null }) {
  const { data, mutate } = usePlanItems(partyId)
  const exp = useExperience(EXPERIENCE_ENABLED ? partyId : null)
  const [open, setOpen] = useState<Open>(null)
  if (!data) return null
  const { activities, shopping, budget: lines } = data
  const x: Experience | null = exp.data ?? null
  const hasExperience = !!x && (x.timeline.length > 0 || x.food.length > 0 || x.host.length > 0 || activities.length > 0)
  if (!activities.length && !shopping.length && !lines.length && !hasExperience) return null
  const tl = x ? timelineOf(x, startTime) : null

  const bought = shopping.filter((s) => s.done).length
  const planned = lines.reduce((s, l) => s + Number(l.amount), 0)
  const spent = lines.reduce((s, l) => s + Number(l.actual_amount ?? 0), 0)
  /** Optimistic where it matters (checkboxes must flip instantly); rolls back and explains on failure. */
  const act = async (fn: () => Promise<void>, optimistic?: (d: PartyPlanItems) => PartyPlanItems) => {
    try {
      await mutate(async () => {
        await fn()
        return listPlanItems(partyId)
      }, optimistic ? { optimisticData: (cur) => optimistic(cur ?? data), rollbackOnError: true } : undefined)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const row = (key: Exclude<Open, null>, Icon: typeof Puzzle, title: string, value: string) => (
    <button key={key} type="button" onClick={() => setOpen(key)} className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted" data-testid={`party-plan-${key}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted-foreground">{title}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  )

  return (
    <Section title="Your party plan">
      <Card className="divide-y divide-border overflow-hidden">
        {activities.length ? (EXPERIENCE_ENABLED ? (
          <Link href="/activities" className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-3 active:bg-muted" data-testid="party-plan-activities">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Puzzle className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm text-muted-foreground">Activities</span><span className="block truncate font-semibold">{activities.length} planned · {formatMinutes(activities.reduce((s, a) => s + (a.duration_min ?? 0), 0))}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ) : row('activities', Puzzle, 'Activities', `${activities.length} planned · ${activities.reduce((s, a) => s + (a.duration_min ?? 0), 0)} min`)) : null}
        {x && (x.timeline.length || activities.length) ? row('timeline', Clock, 'Timeline', x.timeline.length ? `${x.timeline.length} steps · ${formatMinutes(tl!.totalMinutes)}${partyMinutes ? ` of ${formatMinutes(partyMinutes)}` : ''}` : 'Plan the party day') : null}
        {x?.food.length ? row('menu', UtensilsCrossed, 'Menu', `${x.food.length} item${x.food.length === 1 ? '' : 's'}`) : null}
        {x?.host.length ? row('host', Mic, 'What to say', `${x.host.length} saved`) : null}
        {shopping.length ? row('shopping', ShoppingBasket, 'Shopping list', `${bought} of ${shopping.length} bought`) : null}
        {lines.length ? row('budget', PiggyBank, 'Budget', `${$(planned)} planned${spent ? ` · ${$(spent)} spent` : ''}${budget != null ? ` of ${$(budget)}` : ''}`) : null}
      </Card>

      <BottomSheet open={open === 'activities'} onOpenChange={(o) => !o && setOpen(null)} title="Activities" description="Added from your AI suggestions.">
        <div className="space-y-3 pb-2">
          {activities.map((a) => {
            const d = (a.details ?? {}) as { instructions?: string[]; setup?: string; setting?: string }
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.duration_min ? `${a.duration_min} min` : null, a.estimated_cost != null ? (Number(a.estimated_cost) ? `~${$(Number(a.estimated_cost))} (estimate)` : 'Free') : null, d.setting && d.setting !== 'either' ? d.setting : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => act(() => removeActivity(a.id))} className="tap -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {a.description ? <p className="mt-2 text-sm">{a.description}</p> : null}
                {a.materials.length ? <p className="mt-2 text-xs text-muted-foreground">Materials: {a.materials.join(', ')}</p> : null}
                {d.setup ? <p className="mt-1 text-xs text-muted-foreground">Setup: {d.setup}</p> : null}
                {d.instructions?.length ? <ol className="mt-2 list-inside list-decimal space-y-0.5 text-sm">{d.instructions.map((x) => <li key={x}>{x}</li>)}</ol> : null}
              </Card>
            )
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={open === 'shopping'} onOpenChange={(o) => !o && setOpen(null)} title="Shopping list" description={`${bought} of ${shopping.length} bought. Prices are estimates.`}>
        <div className="space-y-4 pb-2">
          {Object.keys(CATEGORY).filter((c) => shopping.some((s) => s.category === c)).map((c) => (
            <div key={c}>
              <p className="mb-2 text-sm font-semibold">{CATEGORY[c]}</p>
              <Card className="divide-y divide-border">
                {shopping.filter((s) => s.category === c).map((s) => (
                  <div key={s.id} className="flex min-h-[56px] items-center gap-2 pl-1 pr-1">
                    <label className="tap flex min-h-[48px] min-w-0 flex-1 cursor-pointer items-center gap-3 px-3">
                      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={s.done} onChange={(e) => { const done = e.target.checked; void act(() => setShoppingDone(s.id, done), (d) => ({ ...d, shopping: d.shopping.map((x) => (x.id === s.id ? { ...x, done } : x)) })) }} />
                      <span className="min-w-0">
                        <span className={cn('block text-sm font-medium', s.done && 'text-muted-foreground line-through')}>{s.item}</span>
                        <span className="block text-xs text-muted-foreground">{[s.qty, s.estimated_cost ? `~${$(Number(s.estimated_cost))}` : null].filter(Boolean).join(' · ')}</span>
                      </span>
                    </label>
                    <button type="button" aria-label={`Remove ${s.item}`} onClick={() => act(() => removeShoppingItem(s.id))} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          ))}
          <p className="text-sm font-semibold">Estimated total: {$(shopping.reduce((t, s) => t + Number(s.estimated_cost ?? 0), 0))}</p>
        </div>
      </BottomSheet>

      <BottomSheet open={open === 'budget'} onOpenChange={(o) => !o && setOpen(null)} title="Budget" description="Planned amounts are estimates. Enter what you actually spend as you go.">
        <div className="space-y-3 pb-2">
          <Card className="grid grid-cols-3 gap-2 p-4 text-center text-sm">
            <div><p className="text-xs text-muted-foreground">Your budget</p><p className="font-semibold">{budget != null ? $(budget) : '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Planned (est.)</p><p className={cn('font-semibold', budget != null && planned > budget && 'text-destructive')}>{$(planned)}</p></div>
            <div><p className="text-xs text-muted-foreground">Spent</p><p className={cn('font-semibold', budget != null && spent > budget && 'text-destructive')}>{$(spent)}</p></div>
          </Card>
          <Card className="divide-y divide-border">
            {lines.map((l) => <BudgetRow key={l.id} line={l} onSpent={(v) => act(() => setActualSpend(l.id, v))} onRemove={() => act(() => removeBudgetLine(l.id))} />)}
          </Card>
        </div>
      </BottomSheet>

      {x ? <TimelineSheet partyId={partyId} data={x} startTime={startTime} partyMinutes={partyMinutes} open={open === 'timeline'} onOpenChange={(o) => !o && setOpen(null)} /> : null}

      {x ? (
        <BottomSheet open={open === 'menu'} onOpenChange={(o) => !o && setOpen(null)} title="Menu" description="Quantities are estimates. Please check allergies with each family.">
          <Card className="mb-2 divide-y divide-border">
            {x.food.map((f) => (
              <div key={f.id} className="flex items-center gap-2 py-2 pl-4 pr-1">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">{[f.quantity != null ? `${Number(f.quantity)} ${f.unit ?? ''}`.trim() : null, f.estimated_cost ? `~${$(Number(f.estimated_cost))}` : null, ...(f.dietary_tags ?? [])].filter(Boolean).join(' · ')}{f.designed_for_guests ? ` · for ${f.designed_for_guests} guests` : ''}</span>
                </span>
                <button type="button" className="tap min-h-[44px] shrink-0 rounded-full px-3 text-sm font-semibold text-primary" onClick={() => actExp(partyId, () => addFoodToShopping(f), (r) => (r ? 'Added to your shopping list.' : 'Already on your list.'))}>To list</button>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => actExp(partyId, () => removeFoodItem(f.id))} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </Card>
        </BottomSheet>
      ) : null}

      {x ? (
        <BottomSheet open={open === 'host'} onOpenChange={(o) => !o && setOpen(null)} title="What to say" description="Saved to your party. Nothing is sent for you.">
          <div className="space-y-3 pb-2">
            {x.host.map((h) => (
              <Card key={h.id} className="space-y-2 p-4">
                <p className="text-sm font-semibold text-primary">{h.title || h.kind.replace(/_/g, ' ')}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed">{h.body}</p>
                <button type="button" className="tap inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary" onClick={async () => { try { await navigator.clipboard.writeText(h.body); toast.success('Copied.') } catch { toast('Select the text to copy it.') } }}><Copy className="h-4 w-4" /> Copy</button>
              </Card>
            ))}
          </div>
        </BottomSheet>
      ) : null}
    </Section>
  )
}

function BudgetRow({ line, onSpent, onRemove }: { line: BudgetLine; onSpent: (v: number | null) => void; onRemove: () => void }) {
  const [value, setValue] = useState(line.actual_amount != null ? String(Number(line.actual_amount)) : '')
  const commit = () => {
    const t = value.trim()
    const v = t === '' ? null : Number(t)
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100000)) return
    if (v !== (line.actual_amount != null ? Number(line.actual_amount) : null)) onSpent(v)
  }
  return (
    <div className="flex items-center gap-2 py-2 pl-4 pr-1">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.category}{line.label ? ` · ${line.label}` : ''}</p>
        <p className="text-xs text-muted-foreground">Planned {$(Number(line.amount))}{line.source_generation_id ? ' · AI estimate' : ''}</p>
      </div>
      <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <span>Spent $</span>
        <input
          inputMode="decimal"
          aria-label={`Actually spent on ${line.category}`}
          className="h-11 w-20 rounded-xl border border-input bg-card px-2 text-right text-base text-foreground outline-none focus:border-primary"
          value={value}
          placeholder="—"
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </label>
      <button type="button" aria-label={`Remove ${line.category}`} onClick={onRemove} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
