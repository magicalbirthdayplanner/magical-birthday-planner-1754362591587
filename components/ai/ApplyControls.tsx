'use client'
/**
 * Per-item Apply / Edit / Dismiss controls for AI suggestions. Sends only ids (+ optional edits); the server loads
 * the item from the stored generation. Shows "Added" afterwards with Undo in the toast. ≥44 px targets.
 */
import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { AppButton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { useApplied } from './applied'

type Target = 'checklist' | 'activities' | 'shopping_list' | 'theme' | 'budget'
const LABEL: Record<Target, string> = { checklist: 'Add to checklist', activities: 'Add to activities', shopping_list: 'Add to list', theme: 'Use this theme', budget: 'Add to budget' }

export function ApplyControls({ generationId, target, itemId, label, partyId }: { generationId: string; target: string; itemId: string; label: string; partyId: string }) {
  const t = target as Target
  const { mutate } = useSWRConfig()
  const applied = useApplied()
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'dismissed'>('idle')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(label)
  const [amount, setAmount] = useState('')

  const refresh = () => {
    void mutate(['checklist', partyId])
    void mutate((k) => Array.isArray(k) && (k[0] === 'party' || k[0] === 'parties' || k[0] === 'ai-party-items'))
  }
  const apply = async () => {
    setState('busy')
    try {
      const edits: Record<string, unknown> = {}
      if (editing && title.trim() && title.trim() !== label) edits.title = title.trim()
      if (editing && t === 'budget' && amount.trim() && Number.isFinite(Number(amount))) edits.amount = Number(amount)
      const r = await apiFetch<{ status: string; message: string; undo?: boolean }>('/api/ai/apply', { method: 'POST', body: JSON.stringify({ generationId, itemId, target, ...(Object.keys(edits).length ? { edits } : {}) }) })
      setState('added')
      applied.mark(t, [itemId])
      setEditing(false)
      refresh()
      if (r.status === 'applied') {
        toast.success(r.message, {
          action: r.undo
            ? {
                label: 'Undo',
                onClick: async () => {
                  try {
                    await apiFetch('/api/ai/apply', { method: 'DELETE', body: JSON.stringify({ generationId, itemId, target }) })
                    setState('idle')
                    applied.unmark(t, itemId)
                    refresh()
                  } catch (e) {
                    toast.error(friendlyError(e))
                  }
                },
              }
            : undefined,
        })
      } else toast(r.message)
    } catch (e) {
      setState('idle')
      toast.error(friendlyError(e))
    }
  }

  if (state === 'dismissed') return null
  if (state === 'added' || (state === 'idle' && applied.has(t, itemId)))
    return (
      <span className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-semibold text-success" role="status">
        <Check className="h-4 w-4" /> Added
      </span>
    )
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {editing ? (
        <div className="w-56 space-y-2">
          <TextField label={t === 'budget' ? 'Category' : 'Name'} value={title} maxLength={t === 'checklist' ? 200 : 120} onChange={(e) => setTitle(e.target.value)} />
          {t === 'budget' ? <TextField label="Amount $" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))} /> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        <AppButton size="sm" className="min-h-[44px]" variant={t === 'theme' ? 'primary' : 'secondary'} loading={state === 'busy'} onClick={apply} aria-label={`${LABEL[t]}: ${label}`}>
          {LABEL[t]}
        </AppButton>
        {t !== 'theme' ? (
          <button type="button" onClick={() => setEditing((x) => !x)} aria-label={editing ? 'Stop editing' : `Edit before adding: ${label}`} aria-pressed={editing} className="tap flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
            <Pencil className="h-4 w-4" />
          </button>
        ) : null}
        <button type="button" onClick={() => setState('dismissed')} aria-label={`Dismiss: ${label}`} className="tap flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
