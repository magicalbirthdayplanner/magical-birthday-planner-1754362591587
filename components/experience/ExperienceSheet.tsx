'use client'
/**
 * ✨ Create My Party Experience: one description → separate sections (theme, activities, timeline, food, shopping,
 * host lines, checklist, budget). Each section has its own Add / Use button; nothing changes the party until tapped.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, Section } from '@/components/app/ui'
import { TextArea } from '@/components/app/fields'
import { AIError, AIProgress } from '@/components/ai/AIProgress'
import { AddAllButton } from '@/components/ai/AddAllButton'
import { ApplyControls } from '@/components/ai/ApplyControls'
import { AppliedProvider } from '@/components/ai/applied'
import { useAIGenerate } from '@/components/ai/useAI'
import type { ExperienceResult } from '@/lib/ai/features/partyExperience.types'
import { lastGeneration } from '@/lib/data/partyPlanItems'
import { costRange, formatMinutes, type TimelineKind } from '@/lib/experience/model'
import { KIND_EMOJI } from './TimelineSheet'

const STEPS = ['✨ Creating something special for your party…', 'Choosing a theme and activities…', 'Planning the day, the food and the shopping…', 'Writing what to say…']
const money = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`

function Block({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Section title={title} action={action}>
      {sub ? <p className="-mt-2 mb-2 text-xs text-muted-foreground">{sub}</p> : null}
      {children}
    </Section>
  )
}

export function ExperienceSheet({ partyId, open, onOpenChange, onUsed }: { partyId: string; open: boolean; onOpenChange: (o: boolean) => void; onUsed: () => void }) {
  const gen = useAIGenerate<ExperienceResult>('/api/ai/party-experience')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!open || gen.state.phase !== 'idle') return
    let cancelled = false
    void lastGeneration<ExperienceResult>(partyId, 'party_experience').then((last) => { if (last && !cancelled) gen.restore(last) }).catch(() => undefined)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, partyId])
  const run = async () => {
    await gen.run({ partyId, notes: notes.trim() || undefined, regenerate: true })
    onUsed()
  }
  const s = gen.state
  const p = (target: string, id: string, label: string) => <ApplyControls generationId={(s as { generationId: string }).generationId} target={target} itemId={id} label={label} partyId={partyId} />
  const all = (target: 'activities' | 'timeline' | 'food' | 'shopping_list' | 'host' | 'checklist' | 'budget', ids: string[], label = 'Add all') => <AddAllButton generationId={(s as { generationId: string }).generationId} target={target} itemIds={ids} partyId={partyId} label={label} />
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) gen.cancel(); onOpenChange(o) }} title="Create my party experience" description={s.phase === 'done' ? 'Pick what you like — each part is added only when you tap it.' : 'Describe the birthday you want. We already know your party details.'}>
      {s.phase === 'loading' ? (
        <AIProgress steps={STEPS} onCancel={gen.cancel} />
      ) : s.phase === 'done' ? (
        <AppliedProvider key={s.generationId} initial={s.appliedKeys}>
          <div className="space-y-1 pb-2" aria-live="polite">
            {s.restoredAt ? <p className="px-4 text-xs text-muted-foreground">Your experience from {new Date(s.restoredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p> : null}
            <div className="mx-4 rounded-3xl bg-secondary p-5"><p className="text-sm font-semibold text-secondary-foreground">Your party experience</p><p className="mt-1 text-[15px] leading-relaxed">{s.result.summary}</p></div>

            <Block title="Theme">
              <Card className="p-4">
                <p className="font-display text-xl font-bold">{s.result.theme.emoji} {s.result.theme.name}</p>
                {s.result.theme.description ? <p className="mt-1 text-sm text-muted-foreground">{s.result.theme.description}</p> : null}
                {s.result.theme.decorations.length ? <p className="mt-2 text-sm"><span className="font-semibold">Decorations: </span>{s.result.theme.decorations.join(', ')}</p> : null}
                <div className="mt-3 flex justify-end">{p('theme', 'theme', s.result.theme.name)}</div>
              </Card>
            </Block>

            <Block title="Activities" sub="Added activities appear on the Activities tab with full details you can personalise." action={all('activities', s.result.activities.map((a) => a.id))}>
              <div className="space-y-2">
                {s.result.activities.map((a) => (
                  <Card key={a.id} className="p-4">
                    <p className="font-bold">{a.emoji} {a.name}</p>
                    <p className="text-xs text-muted-foreground">{formatMinutes(a.duration_minutes)} · {a.indoor_outdoor} · {costRange(a.estimated_cost)}</p>
                    <p className="mt-1 text-sm">{a.description}</p>
                    <div className="mt-2 flex justify-end">{p('activities', a.id, a.name)}</div>
                  </Card>
                ))}
              </div>
            </Block>

            {s.result.timeline.length ? (
              <Block title="Timeline" sub="Add your activities first — matching steps then follow their activity’s length." action={all('timeline', s.result.timeline.map((t) => t.id), 'Add timeline')}>
                <Card className="divide-y divide-border">
                  {s.result.timeline.map((t) => <div key={t.id} className="flex gap-3 px-4 py-2.5 text-sm"><span className="w-12 shrink-0 font-semibold tabular-nums text-primary">+{Math.floor(t.minute / 60)}:{String(t.minute % 60).padStart(2, '0')}</span><span className="min-w-0 flex-1">{KIND_EMOJI[t.kind as TimelineKind]} {t.label}</span><span className="text-xs text-muted-foreground">{t.duration} min</span></div>)}
                </Card>
              </Block>
            ) : null}

            {s.result.food.length ? (
              <Block title="Food" sub="Quantities are estimates for your guest count. Please check allergies with each family." action={all('food', s.result.food.map((f) => f.id), 'Add to plan')}>
                <Card className="divide-y divide-border">
                  {s.result.food.map((f) => <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm"><span className="min-w-0"><span className="block font-medium">{f.name}</span><span className="block text-xs text-muted-foreground">{[`${f.quantity} ${f.unit}`.trim(), f.estimated_cost ? `~${money(f.estimated_cost)}` : null, ...f.dietary_tags].filter(Boolean).join(' · ')}</span></span>{p('food', f.id, f.name)}</div>)}
                </Card>
              </Block>
            ) : null}

            {s.result.shopping.length ? (
              <Block title="Shopping" action={all('shopping_list', s.result.shopping.map((x) => x.id))}>
                <Card className="divide-y divide-border">
                  {s.result.shopping.map((x) => <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm"><span className="min-w-0"><span className="block font-medium">{x.item}</span><span className="block text-xs text-muted-foreground">{[x.qty, x.estimatedCost ? `~${money(x.estimatedCost)}` : null].filter(Boolean).join(' · ')}</span></span>{p('shopping_list', x.id, x.item)}</div>)}
                </Card>
              </Block>
            ) : null}

            {s.result.host.length ? (
              <Block title="What to say" action={all('host', s.result.host.map((h) => h.id), 'Save all')}>
                <div className="space-y-2">
                  {s.result.host.map((h) => <Card key={h.id} className="p-4"><p className="text-sm font-semibold text-primary">{h.title}</p><p className="mt-1 text-sm italic">“{h.body}”</p><div className="mt-2 flex justify-end">{p('host', h.id, h.title)}</div></Card>)}
                </div>
              </Block>
            ) : null}

            {s.result.checklist.length ? (
              <Block title="Checklist" action={all('checklist', s.result.checklist.map((c) => c.id))}>
                <Card className="divide-y divide-border">
                  {s.result.checklist.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm"><span className="min-w-0"><span className="block font-medium">{c.title}</span>{c.dueDate ? <span className="block text-xs text-muted-foreground">By {new Date(`${c.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{c.late ? ' · do this now' : ''}</span> : null}</span>{p('checklist', c.id, c.title)}</div>)}
                </Card>
              </Block>
            ) : null}

            {s.result.budget.lines.length ? (
              <Block title="Budget (estimates)" sub="Planned amounts only — what you actually spend is yours to enter." action={all('budget', s.result.budget.lines.map((l) => l.id), 'Use all')}>
                <Card className="divide-y divide-border">
                  {s.result.budget.lines.map((l) => <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm"><span className="flex-1">{l.category}</span><span className="font-semibold tabular-nums">{money(l.amount)}</span>{p('budget', l.id, l.category)}</div>)}
                  <div className="flex justify-between px-4 py-3 text-sm font-bold"><span>Total</span><span className={s.result.budget.overBy ? 'text-destructive' : ''}>{money(s.result.budget.total)}</span></div>
                </Card>
              </Block>
            ) : null}
            {s.result.assumptions.length ? <p className="px-4 text-xs text-muted-foreground">{s.result.assumptions.join(' ')}</p> : null}
            <div className="px-4 pt-2"><AppButton block variant="outline" onClick={gen.reset}>Describe it differently</AppButton></div>
          </div>
        </AppliedProvider>
      ) : (
        <div className="space-y-3 pb-2">
          <TextArea label="Tell us about the birthday" hideLabel placeholder="“My daughter is turning 7. She loves space and painting, but I don’t want a typical space party. 15 kids, 2 hours, $200, at home.”" rows={5} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="-mt-1 text-xs text-muted-foreground">Please avoid full names, addresses or phone numbers. Takes about 30–50 seconds.</p>
          {s.phase === 'error' ? <AIError message={s.code === 'provider_error' || s.code === 'invalid_response' || s.code === 'timeout' ? 'We couldn’t create that right now. Your party plan is safe.' : s.message} onRetry={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? undefined : run} upgradeTo={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? 'plus' : null} /> : null}
          <AppButton block size="lg" variant="magic" onClick={run}>✨ Create my party experience</AppButton>
        </div>
      )}
    </BottomSheet>
  )
}
