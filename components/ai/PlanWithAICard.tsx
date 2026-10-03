'use client'
/**
 * "Plan My Party" entry point (Home + top of Plan) and the planner sheet: a few sentences + optional fields
 * pre-filled from the party → progress → plan with per-item and per-section actions. Reopening shows the party's
 * last plan (no new generation). Shown only when the server says the feature is enabled; locked/limit states are
 * calm and link to the existing pricing page.
 */
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, Chip } from '@/components/app/ui'
import { TextArea, TextField } from '@/components/app/fields'
import type { Tables } from '@/lib/db/browser'
import type { PartyPlanResult } from '@/lib/ai/schemas/partyPlanner'
import { AIError, AIProgress } from './AIProgress'
import { PlanResultView } from './PlanResultView'
import { ApplyControls } from './ApplyControls'
import { AddAllButton } from './AddAllButton'
import { AppliedProvider } from './applied'
import { lastGeneration } from '@/lib/data/partyPlanItems'
import { useAICapabilities, useAIGenerate } from './useAI'

type Party = Tables<'parties'>

export function PlanWithAICard({ party, className }: { party: Party; className?: string }) {
  const caps = useAICapabilities(party.id)
  const cap = caps.get('party_planner')
  const [open, setOpen] = useState(false)
  if (!cap?.enabled) return null
  const locked = !cap.allowed || cap.remaining === 0
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen(true)} className="tap block w-full text-left" data-testid="plan-with-ai">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-hero text-xl text-white" aria-hidden>
            ✨
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Plan My Party</span>
            <span className="block text-sm text-muted-foreground">
              {locked ? (cap.allowed ? 'See your plan — you’ve used this party’s AI suggestions' : 'Included in paid plans') : 'Tell us about the birthday. We’ll help you plan it — theme, activities, food, budget and a shopping list.'}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Card>
      </button>
      <PlannerSheet party={party} open={open} onOpenChange={setOpen} remaining={cap.remaining} onUsed={() => caps.mutate()} />
    </div>
  )
}

function PlannerSheet({ party, open, onOpenChange, remaining, onUsed }: { party: Party; open: boolean; onOpenChange: (o: boolean) => void; remaining: number | null; onUsed: () => void }) {
  const gen = useAIGenerate<PartyPlanResult>('/api/ai/party-planner')
  const [notes, setNotes] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [d, setD] = useState({
    childAge: party.child_age ? String(party.child_age) : '',
    guestCount: party.guest_count ? String(party.guest_count) : '',
    budget: party.budget != null ? String(Number(party.budget)) : '',
    setting: (party.venue_type === 'indoor' || party.venue_type === 'outdoor' ? party.venue_type : 'either') as 'indoor' | 'outdoor' | 'either',
    interests: (party.interests ?? []).join(', '),
    theme: '',
    food: '',
  })
  // Reopening shows the last plan for this party instead of spending another suggestion.
  useEffect(() => {
    if (!open || gen.state.phase !== 'idle') return
    let cancelled = false
    void lastGeneration<PartyPlanResult>(party.id, 'party_planner').then((last) => {
      if (last && !cancelled) gen.restore(last)
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, party.id])
  const create = async () => {
    const n = (s: string) => (s.trim() && Number.isFinite(Number(s)) ? Number(s) : undefined)
    const overrides: Record<string, unknown> = {
      childAge: n(d.childAge), guestCount: n(d.guestCount), budget: n(d.budget), setting: d.setting,
      interests: d.interests.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8),
      theme: d.theme.trim() || undefined, food: d.food.trim() || undefined,
    }
    Object.keys(overrides).forEach((k) => overrides[k] === undefined && delete overrides[k])
    await gen.run({ partyId: party.id, notes: notes.trim() || undefined, overrides })
    onUsed()
  }
  const s = gen.state
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) gen.cancel(); onOpenChange(o) }} title="Plan My Party" description={s.phase === 'done' ? 'Add what you like — nothing changes until you tap Add.' : 'Tell us about the birthday. We already know the party details — add anything else that matters.'}>
      {s.phase === 'loading' ? (
        <AIProgress onCancel={gen.cancel} />
      ) : s.phase === 'done' ? (
        <AppliedProvider key={s.generationId} initial={s.appliedKeys}>
          {s.restoredAt ? <p className="px-4 pb-1 text-xs text-muted-foreground">Your plan from {new Date(s.restoredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p> : null}
          <PlanResultView
            plan={s.result}
            nextSteps
            action={(target, itemId, label) => <ApplyControls generationId={s.generationId} target={target} itemId={itemId} label={label} partyId={party.id} />}
            bulk={(target, itemIds, label) => <AddAllButton generationId={s.generationId} target={target} itemIds={itemIds} partyId={party.id} label={label} />}
          />
          <div className="flex gap-2 pb-2">
            <AppButton variant="outline" block onClick={gen.reset} disabled={remaining === 0}>
              Make a new plan
            </AppButton>
          </div>
          {s.remaining != null ? <p className="pb-2 text-center text-xs text-muted-foreground">{s.remaining} AI suggestions left for this party</p> : remaining != null ? <p className="pb-2 text-center text-xs text-muted-foreground">A new plan uses one of your {remaining} remaining AI suggestions.</p> : null}
        </AppliedProvider>
      ) : (
        <div className="space-y-4 pb-2">
          <TextArea label="Tell us about the birthday" hideLabel placeholder="My daughter is turning 7, loves art, and we’re expecting 12 kids…" rows={4} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="-mt-2 text-xs text-muted-foreground">Please avoid full names, addresses or phone numbers.</p>
          <button type="button" className="tap inline-flex min-h-[44px] items-center text-sm font-semibold text-primary" aria-expanded={showDetails} onClick={() => setShowDetails((x) => !x)}>
            {showDetails ? 'Hide details' : 'Details (optional)'}
          </button>
          {showDetails ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <TextField label="Age" inputMode="numeric" value={d.childAge} onChange={(e) => setD({ ...d, childAge: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                <TextField label="Guests" inputMode="numeric" value={d.guestCount} onChange={(e) => setD({ ...d, guestCount: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
                <TextField label="Budget $" inputMode="numeric" value={d.budget} onChange={(e) => setD({ ...d, budget: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) })} />
              </div>
              <div className="flex gap-2" role="radiogroup" aria-label="Indoor or outdoor">
                {(['indoor', 'outdoor', 'either'] as const).map((v) => (
                  <Chip key={v} role="radio" aria-checked={d.setting === v} active={d.setting === v} onClick={() => setD({ ...d, setting: v })} className="capitalize">
                    {v}
                  </Chip>
                ))}
              </div>
              <TextField label="Interests" placeholder="art, animals" value={d.interests} maxLength={200} onChange={(e) => setD({ ...d, interests: e.target.value })} />
              <TextField label="Theme idea (optional)" value={d.theme} maxLength={60} onChange={(e) => setD({ ...d, theme: e.target.value })} />
              <TextField label="Food preferences (optional)" placeholder="e.g. nut-free, vegetarian options" value={d.food} maxLength={120} onChange={(e) => setD({ ...d, food: e.target.value })} />
            </div>
          ) : null}
          {s.phase === 'error' ? <AIError message={s.message} onRetry={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? undefined : create} upgradeTo={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? 'starter' : null} /> : null}
          <AppButton block size="lg" variant="magic" onClick={create} disabled={remaining === 0}>
            ✨ Plan my party
          </AppButton>
          {remaining != null ? <p className="text-center text-xs text-muted-foreground">{remaining} AI suggestions left for this party</p> : null}
        </div>
      )}
    </BottomSheet>
  )
}
