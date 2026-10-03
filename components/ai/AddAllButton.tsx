'use client'
/** "Add all" for one section of an AI result: one bulk request; items already on the party are skipped, never overwritten. */
import { useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { AppButton } from '@/components/app/ui'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { useApplied } from './applied'

type BulkTarget = 'checklist' | 'activities' | 'shopping_list' | 'budget' | 'timeline' | 'food' | 'host'
const WHERE: Record<BulkTarget, [string, string]> = {
  checklist: ['task', 'your checklist'],
  activities: ['activity', 'your activities'],
  shopping_list: ['item', 'your shopping list'],
  budget: ['budget line', 'your budget'],
  timeline: ['step', 'your timeline'],
  food: ['dish', 'your menu'],
  host: ['message', 'your party'],
}

export function AddAllButton({ generationId, target, itemIds, partyId, label, className }: { generationId: string; target: BulkTarget; itemIds: string[]; partyId: string; label: string; className?: string }) {
  const applied = useApplied()
  const { mutate } = useSWRConfig()
  const [busy, setBusy] = useState(false)
  const pending = itemIds.filter((id) => !applied.has(target, id))
  if (!pending.length) return null
  const run = async () => {
    setBusy(true)
    try {
      const r = await apiFetch<{ added: number; skipped: number }>('/api/ai/apply', { method: 'POST', body: JSON.stringify({ generationId, target, itemIds: pending }) })
      applied.mark(target, pending)
      const [noun, where] = WHERE[target]
      toast.success(r.added ? `Added ${r.added} ${noun}${r.added === 1 ? '' : 's'} to ${where}${r.skipped ? ` (${r.skipped} already there)` : ''}` : `Those are already in ${where}`)
      void mutate(['checklist', partyId])
      void mutate((k) => Array.isArray(k) && (k[0] === 'ai-party-items' || k[0] === 'parties' || k[0] === 'experience'))
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AppButton variant="secondary" size="sm" className={className ?? 'min-h-[44px]'} loading={busy} onClick={run}>
      {label}
    </AppButton>
  )
}
