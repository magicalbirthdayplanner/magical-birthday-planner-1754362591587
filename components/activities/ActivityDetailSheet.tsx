'use client'
/**
 * One party activity: overview, supplies (→ shopping list), prep (→ checklist), how to run it, what to say, and
 * "Make it yours" (AI revisions the parent previews and explicitly accepts). Everything here is an explicit action.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Check, Clock, Copy, MapPin, Pencil, PiggyBank, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { AIError, AIProgress } from '@/components/ai/AIProgress'
import { useAIGenerate } from '@/components/ai/useAI'
import type { ActivityStudioResult } from '@/lib/ai/features/activityStudio.types'
import { addActivityToTimeline, addCostToBudget, addPrepToChecklist, addSuppliesToShopping, removeActivity, setActivityStatus, type Activity, type Experience } from '@/lib/data/experience'
import { costRange, guestDrift, parseSupply, type ActivityEdit } from '@/lib/experience/model'
import { fromDetail, fromRow } from '@/lib/experience/view'
import { act, applySuggestion } from '@/components/experience/apply'
import { ActivitySections } from './ActivitySections'

const MAKE_IT: [ActivityEdit, string][] = [['cheaper', 'Make it cheaper'], ['exciting', 'More exciting'], ['easier', 'Make it easier'], ['shorter', 'Shorter'], ['longer', 'Longer'], ['indoor', 'Make it indoor'], ['outdoor', 'Make it outdoor'], ['less_messy', 'Less messy'], ['younger', 'For younger kids'], ['older', 'For older kids']]
const DISCOVER_CHIP: Record<string, string> = { craft: 'art', performance: 'art', active: 'sports', game: 'play', treasure_hunt: 'play', calm: 'museums', food: 'vendors', other: 'recommended' }

export function ActivityDetailSheet({ partyId, partyDate, activity, experience, facts, aiEditing, open, onOpenChange, onEdit, onIntro, onUsed }: {
  partyId: string
  partyDate: string
  activity: Activity | null
  experience: Experience
  facts: { guests: number | null; theme: string | null }
  /** activity_studio enabled + allowed for this plan */
  aiEditing: boolean
  open: boolean
  onOpenChange: (o: boolean) => void
  onEdit: (a: Activity) => void
  onIntro?: (a: Activity) => void
  onUsed: () => void
}) {
  const gen = useAIGenerate<ActivityStudioResult>('/api/ai/activity')
  const [ask, setAsk] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (!activity) return null
  const a = activity
  const v = fromRow(a)
  const onTimeline = experience.timeline.some((t) => t.activity_id === a.id)
  const onList = new Set(experience.linked.shopping.get(a.id) ?? [])
  const supplyOnList = (m: string) => onList.has(parseSupply(m).item.toLowerCase())
  const inBudget = experience.linked.budget.has(a.id)
  const prepAdded = experience.linked.tasks.has(a.id)
  const drift = guestDrift(a.designed_for_guests, facts.guests)
  const themeMoved = !!facts.theme && a.designed_for_theme !== facts.theme
  const revise = async (edit: ActivityEdit | null, notes?: string) => {
    await gen.run({ partyId, mode: 'edit', activityId: a.id, ...(edit ? { edit } : {}), ...(notes ? { notes } : {}), regenerate: true })
    onUsed()
  }
  const s = gen.state
  const close = (o: boolean) => {
    if (!o) {
      gen.cancel()
      gen.reset()
      setConfirmRemove(false)
    }
    onOpenChange(o)
  }
  return (
    <BottomSheet open={open} onOpenChange={close} title={`${v.emoji} ${a.name}`} description={a.status === 'planned' ? `In your party · ${a.origin === 'user' || a.user_edited ? 'your version' : 'created with ✨'}` : 'Saved idea — not in your party yet'}>
      <div className="space-y-5 pb-2">
        {s.phase === 'done' ? (
          <div className="space-y-4" aria-live="polite">
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm"><span className="font-semibold">✨ Suggested change: </span>{s.result.whatChanged || 'A revised version of your activity.'} Your activity stays as it is unless you choose this version.</p>
            <p className="font-display text-xl font-bold"><span aria-hidden>{s.result.activity.emoji}</span> {s.result.activity.name}</p>
            <ActivitySections v={fromDetail(s.result.activity)} />
            <div className="grid grid-cols-2 gap-2">
              <AppButton block onClick={async () => { if (await applySuggestion(partyId, { generationId: (s as { generationId: string }).generationId, itemId: 'act-1', target: 'activity_update' })) gen.reset() }}>Use this version</AppButton>
              <AppButton block variant="outline" onClick={gen.reset}>Keep mine</AppButton>
            </div>
          </div>
        ) : s.phase === 'loading' ? (
          <AIProgress steps={['✨ Personalising your activity…', 'Keeping what makes it fun…']} onCancel={gen.cancel} />
        ) : (
          <>
            {drift && aiEditing ? (
              <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>Designed for {a.designed_for_guests} guests — you now have {facts.guests}.</span>
                <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={() => revise('guests')}>✨ Adjust it</AppButton>
              </Card>
            ) : null}
            {themeMoved && aiEditing ? (
              <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>{a.designed_for_theme ? `Made for your ${a.designed_for_theme} theme.` : 'Made before you chose a theme.'}</span>
                <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={() => revise('theme')}>✨ Update for {facts.theme}</AppButton>
              </Card>
            ) : null}
            {s.phase === 'error' ? <AIError message={s.code === 'provider_error' || s.code === 'invalid_response' || s.code === 'timeout' ? 'We couldn’t create that right now. Your party plan is safe.' : s.message} upgradeTo={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? 'plus' : null} /> : null}

            <div className="grid grid-cols-2 gap-2">
              {a.status === 'planned' ? (
                <AppButton block variant="secondary" onClick={() => act(partyId, () => setActivityStatus(a.id, 'idea'), 'Moved to your ideas.')}><Check className="h-4 w-4" /> In your party</AppButton>
              ) : (
                <AppButton block onClick={() => act(partyId, () => setActivityStatus(a.id, 'planned'), 'Added to your party.')}>Add to party</AppButton>
              )}
              <AppButton block variant="outline" disabled={onTimeline || a.status !== 'planned'} onClick={() => act(partyId, () => addActivityToTimeline(a, experience.timeline), 'Added to your timeline.')}>
                {onTimeline ? <><Clock className="h-4 w-4" /> On timeline</> : 'Add to timeline'}
              </AppButton>
            </div>

            <ActivitySections
              v={v}
              actions={{
                supplies: v.materials.length && !v.materials.every(supplyOnList) ? (
                  <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={() => act(partyId, () => addSuppliesToShopping(a, v.materials), (n) => (n ? `Added ${n} supplies to your shopping list.` : 'Those are already on your list.'))}>Add all to shopping</AppButton>
                ) : v.materials.length ? <span className="text-sm font-semibold text-success">✓ On your list</span> : null,
                supply: (m) => (supplyOnList(m) ? <span className="shrink-0 text-xs font-semibold text-success">✓ On list</span> : (
                  <button type="button" className="tap shrink-0 rounded-full px-3 text-sm font-semibold text-primary min-h-[44px]" onClick={() => act(partyId, () => addSuppliesToShopping(a, [m]), (n) => (n ? 'Added to your shopping list.' : 'Already on your list.'))} aria-label={`Add ${m} to the shopping list`}>Add</button>
                )),
                prep: v.prep.length ? (prepAdded ? <span className="text-sm font-semibold text-success">✓ On your checklist</span> : (
                  <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={() => act(partyId, () => addPrepToChecklist(a, partyDate, v.prep), (n) => `Added ${n} prep task${n === 1 ? '' : 's'} to your checklist.`)}>Add to checklist</AppButton>
                )) : null,
                script: (
                  <div className="flex gap-2">
                    <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={async () => { try { await navigator.clipboard.writeText(v.script); toast.success('Copied.') } catch { toast('Select the text to copy it.') } }}><Copy className="h-4 w-4" /> Copy</AppButton>
                    {onIntro ? <AppButton size="sm" variant="outline" className="min-h-[44px]" onClick={() => onIntro(a)}>✨ Longer intro</AppButton> : null}
                  </div>
                ),
              }}
            />

            <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span className="min-w-0"><span className="block font-semibold">Estimated cost: {costRange(a.estimated_cost)}</span><span className="block text-xs text-muted-foreground">Adds a planned estimate to your budget. Actual spending stays yours to enter.</span></span>
              <AppButton size="sm" variant={inBudget ? 'ghost' : 'secondary'} className="min-h-[44px]" onClick={() => act(partyId, () => addCostToBudget(a), (r) => (r === 'updated' ? 'Budget estimate updated.' : 'Added to your budget.'))}>
                <PiggyBank className="h-4 w-4" /> {inBudget ? 'Update estimate' : 'Add to budget'}
              </AppButton>
            </Card>

            {aiEditing ? (
              <section className="space-y-3">
                <h3 className="text-base font-bold">✨ Make it yours</h3>
                <div className="flex flex-wrap gap-2">
                  {MAKE_IT.map(([k, label]) => (
                    <button key={k} type="button" onClick={() => revise(k)} className="tap min-h-[44px] rounded-full border border-border bg-card px-3.5 text-sm font-semibold active:bg-muted">{label}</button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <TextField className="min-w-0 flex-1" label="Ask for a change" placeholder="“Can you make this work without buying anything?”" value={ask} maxLength={500} onChange={(e) => setAsk(e.target.value)} />
                  <AppButton className="h-14 shrink-0" disabled={ask.trim().length < 3} onClick={() => revise(null, ask.trim())}>Ask</AppButton>
                </div>
                <p className="text-xs text-muted-foreground">You’ll see the new version first — yours only changes if you choose it.</p>
              </section>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <AppButton block variant="outline" onClick={() => onEdit(a)}><Pencil className="h-4 w-4" /> Edit</AppButton>
              <Link href={`/discover?chip=${DISCOVER_CHIP[a.category] ?? 'recommended'}`} className="tap inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-[15px] font-semibold active:bg-muted"><MapPin className="h-4 w-4" /> Places nearby</Link>
            </div>
            {confirmRemove ? (
              <Card className="space-y-3 p-4 text-sm">
                <p>Remove “{a.name}”? Its timeline slot, unfinished prep tasks and budget estimate go too. Supplies stay on your shopping list, and anything you’ve already spent stays in your budget.</p>
                <div className="grid grid-cols-2 gap-2">
                  <AppButton block variant="danger" onClick={async () => { const r = await act(partyId, () => removeActivity(a.id), 'Activity removed.'); if (r !== undefined) close(false) }}>Remove</AppButton>
                  <AppButton block variant="outline" onClick={() => setConfirmRemove(false)}>Keep it</AppButton>
                </div>
              </Card>
            ) : (
              <AppButton block variant="ghost" onClick={() => setConfirmRemove(true)}><Trash2 className="h-4 w-4" /> Remove activity</AppButton>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
