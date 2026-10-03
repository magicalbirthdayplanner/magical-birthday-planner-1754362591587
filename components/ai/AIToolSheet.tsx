'use client'
/**
 * Generic sheet for one contextual AI action. Opening it shows the party's last result for that feature when there
 * is one (no new generation); otherwise it asks an optional question (`ask`) or starts right away. Then progress
 * (cancel) → result renderer (with applied state) → regenerate.
 */
import { type ReactNode, useEffect, useState } from 'react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton } from '@/components/app/ui'
import { TextArea } from '@/components/app/fields'
import { lastGeneration } from '@/lib/data/partyPlanItems'
import type { AIFeature } from '@/lib/ai/types'
import { AIError, AIProgress } from './AIProgress'
import { AppliedProvider } from './applied'
import { useAIGenerate } from './useAI'

export interface AskConfig { label: string; placeholder: string; cta: string }

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function AIToolSheet<R>({ open, onOpenChange, title, description, path, body, steps, render, onUsed, feature, restore = false, ask }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  path: string
  body: Record<string, unknown>
  steps?: string[]
  render: (result: R, generationId: string, rerun: (extra: Record<string, unknown>) => void) => ReactNode
  onUsed?: () => void
  /** With `restore`, reopening shows this feature's last result for the party instead of generating again. */
  feature?: AIFeature
  restore?: boolean
  /** Optional free-text question shown before generating. */
  ask?: AskConfig
}) {
  const gen = useAIGenerate<R>(path)
  const [asking, setAsking] = useState(false)
  const [notes, setNotes] = useState('')
  const run = async (extra: Record<string, unknown> = {}) => {
    setAsking(false)
    await gen.run({ ...body, ...(ask && notes.trim() ? { notes: notes.trim() } : {}), ...extra })
    onUsed?.()
  }
  const again = () => {
    if (ask) {
      gen.reset()
      setAsking(true)
    } else void run({ regenerate: true })
  }
  useEffect(() => {
    if (!open || gen.state.phase !== 'idle' || asking) return
    let cancelled = false
    void (async () => {
      const last = restore && feature && typeof body.partyId === 'string' ? await lastGeneration<R>(body.partyId, feature).catch(() => null) : null
      if (cancelled) return
      if (last) gen.restore(last)
      else if (ask) setAsking(true)
      else void run()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const s = gen.state
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) gen.cancel(); onOpenChange(o) }} title={title} description={s.phase === 'done' ? 'Nothing changes until you tap Add.' : description}>
      {asking && s.phase !== 'loading' ? (
        <div className="space-y-3 pb-2">
          <TextArea label={ask!.label} placeholder={ask!.placeholder} rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="-mt-1 text-xs text-muted-foreground">Optional. We already know the party details. Please avoid full names, addresses or phone numbers.</p>
          {s.phase === 'error' ? <AIError message={s.message} upgradeTo={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? 'starter' : null} /> : null}
          <AppButton block size="lg" variant="magic" onClick={() => run({ regenerate: true })}>
            {ask!.cta}
          </AppButton>
        </div>
      ) : s.phase === 'loading' || s.phase === 'idle' ? (
        <AIProgress steps={steps} onCancel={() => { gen.cancel(); onOpenChange(false) }} />
      ) : null}
      {s.phase === 'error' && !asking ? (
        <AIError message={s.message} onRetry={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? undefined : () => run()} upgradeTo={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? 'starter' : null} />
      ) : null}
      {s.phase === 'done' ? (
        <AppliedProvider key={s.generationId} initial={s.appliedKeys}>
          <div className="space-y-4 pb-2" aria-live="polite">
            {s.restoredAt ? <p className="text-xs text-muted-foreground">Your ideas from {when(s.restoredAt)} — getting new ones uses one AI suggestion.</p> : null}
            {render(s.result, s.generationId, (extra) => void run({ regenerate: true, ...extra }))}
            <AppButton variant="outline" block onClick={again}>
              {ask ? 'Ask for new ideas' : 'Regenerate'}
            </AppButton>
            {s.remaining != null ? <p className="text-center text-xs text-muted-foreground">{s.remaining} AI suggestions left for this party</p> : null}
          </div>
        </AppliedProvider>
      ) : null}
    </BottomSheet>
  )
}
