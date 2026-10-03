'use client'
/** /plan/checklist: "Build my checklist" (checklist feature). Hidden unless enabled; locked state links to pricing. */
import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import type { ChecklistResult } from '@/lib/ai/schemas/checklist'
import { AIToolSheet } from './AIToolSheet'
import { ChecklistResultView } from './results/ChecklistResultView'
import { useAICapabilities } from './useAI'

export function ChecklistAIButton({ partyId }: { partyId: string }) {
  const caps = useAICapabilities(partyId)
  const cap = caps.get('checklist')
  const [open, setOpen] = useState(false)
  if (!cap?.enabled) return null
  if (!cap.allowed)
    return (
      <a href={`/pricing?upgrade=${(cap.upgradeTo ?? 'starter').toLowerCase()}`} className="tap mx-4 mt-3 flex min-h-[48px] items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-secondary/50 px-4 text-sm font-semibold text-primary">
        <ListChecks className="h-4 w-4" /> ✨ What am I forgetting? — included with Starter
      </a>
    )
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="tap mx-4 mt-3 flex min-h-[48px] w-[calc(100%-2rem)] items-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-primary" data-testid="ai-build-checklist">
        <ListChecks className="h-4 w-4" /> ✨ What am I forgetting?
      </button>
      {open ? <AIToolSheet<ChecklistResult>
        open
        onOpenChange={(o) => !o && setOpen(false)}
        title="Your AI checklist"
        path="/api/ai/checklist"
        body={{ partyId }}
        feature="checklist"
        restore
        steps={['Looking at what’s already done…', 'Working back from the party date…', 'Putting your list together…']}
        onUsed={() => caps.mutate()}
        render={(r, gid) => <ChecklistResultView r={r} generationId={gid} partyId={partyId} />}
      /> : null}
    </>
  )
}
