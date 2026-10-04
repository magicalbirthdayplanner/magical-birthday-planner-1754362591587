'use client'
/** "✨ Create an activity": the parent describes it, the party facts fill in the rest; Add to party / Save as idea / Try another. */
import { useState } from 'react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton } from '@/components/app/ui'
import { TextArea } from '@/components/app/fields'
import { AIError, AIProgress } from '@/components/ai/AIProgress'
import { useAIGenerate } from '@/components/ai/useAI'
import type { ActivityStudioResult } from '@/lib/ai/features/activityStudio.types'
import { fromDetail } from '@/lib/experience/view'
import { ActivitySections } from './ActivitySections'
import { applySuggestion } from '@/components/experience/apply'

export const CREATING_STEPS = ['✨ Creating something special for your party…', 'Matching it to your guests and theme…', 'Writing the steps and what to say…']

export function ActivityCreatorSheet({ partyId, open, onOpenChange, basedOn, onUsed }: { partyId: string; open: boolean; onOpenChange: (o: boolean) => void; basedOn: string; onUsed: () => void }) {
  const gen = useAIGenerate<ActivityStudioResult>('/api/ai/activity')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState<null | 'planned' | 'idea'>(null)
  const run = async () => {
    setDone(null)
    await gen.run({ partyId, mode: 'create', notes: notes.trim() || undefined, regenerate: true })
    onUsed()
  }
  const add = async (status: 'planned' | 'idea') => {
    if (gen.state.phase !== 'done') return
    if (await applySuggestion(partyId, { generationId: gen.state.generationId, itemId: 'act-1', target: 'activities', edits: { status } })) setDone(status)
  }
  const s = gen.state
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) gen.cancel(); onOpenChange(o) }} title="Create an activity" description={s.phase === 'done' ? `${basedOn} Nothing changes until you tap Add to party.` : `${basedOn} No need to repeat any of it.`}>
      {s.phase === 'loading' ? (
        <AIProgress steps={CREATING_STEPS} onCancel={gen.cancel} />
      ) : s.phase === 'done' ? (
        <div className="space-y-4 pb-2" aria-live="polite">
          <p className="font-display text-2xl font-extrabold leading-tight"><span aria-hidden>{s.result.activity.emoji}</span> {s.result.activity.name}</p>
          <ActivitySections v={fromDetail(s.result.activity)} />
          {done ? (
            <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success" role="status">✓ {done === 'planned' ? 'Added to your party' : 'Saved to your ideas'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <AppButton block onClick={() => add('planned')}>Add to party</AppButton>
              <AppButton block variant="outline" onClick={() => add('idea')}>Save as idea</AppButton>
            </div>
          )}
          <AppButton block variant="ghost" onClick={run}>✨ Try another</AppButton>
          {s.remaining != null ? <p className="text-center text-xs text-muted-foreground">{s.remaining} AI suggestions left for this party</p> : null}
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <TextArea label="What do you have in mind?" placeholder="“I want a fun space game for 15 kids that takes about 20 minutes and doesn’t make a mess.”" rows={4} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="-mt-1 text-xs text-muted-foreground">Leave it blank and we’ll pick something that fits. Please avoid full names, addresses or phone numbers.</p>
          {s.phase === 'error' ? <AIError message={s.code === 'provider_error' || s.code === 'invalid_response' || s.code === 'timeout' ? 'We couldn’t create that right now. Your party plan is safe.' : s.message} onRetry={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? undefined : run} upgradeTo={s.code === 'forbidden_plan' || s.code === 'limit_reached' ? s.upgradeTo ?? null : null} /> : null}
          <AppButton block size="lg" variant="magic" onClick={run}>✨ Create it</AppButton>
        </div>
      )}
    </BottomSheet>
  )
}
