'use client'
/** Apply/undo an AI suggestion item (the server reads the item from its stored copy) and refresh party data. */
import { mutate } from 'swr'
import { toast } from 'sonner'
import { apiFetch, friendlyError } from '@/lib/data/api'

const refresh = (partyId: string) => {
  void mutate(['checklist', partyId])
  void mutate((k) => Array.isArray(k) && (k[0] === 'experience' || k[0] === 'ai-party-items' || k[0] === 'parties'))
}

export async function applySuggestion(partyId: string, body: { generationId: string; itemId: string; target: string; edits?: Record<string, unknown> }): Promise<boolean> {
  try {
    const r = await apiFetch<{ status: string; message: string; undo?: boolean }>('/api/ai/apply', { method: 'POST', body: JSON.stringify(body) })
    refresh(partyId)
    if (r.status === 'applied') {
      toast.success(r.message, r.undo ? { action: { label: 'Undo', onClick: () => void undoSuggestion(partyId, body) } } : undefined)
      return true
    }
    toast(r.message)
    return r.status === 'already' || r.status === 'duplicate'
  } catch (e) {
    toast.error(friendlyError(e))
    return false
  }
}

export async function undoSuggestion(partyId: string, body: { generationId: string; itemId: string; target: string }) {
  try {
    await apiFetch('/api/ai/apply', { method: 'DELETE', body: JSON.stringify({ generationId: body.generationId, itemId: body.itemId, target: body.target }) })
    refresh(partyId)
    toast('Undone.')
  } catch (e) {
    toast.error(friendlyError(e))
  }
}

/** Run a parent action that writes party data; refresh and explain failures kindly. */
export async function act(partyId: string, fn: () => Promise<unknown>, success?: string | ((r: unknown) => string | null)) {
  try {
    const r = await fn()
    refresh(partyId)
    const msg = typeof success === 'function' ? success(r) : success
    if (msg) toast.success(msg)
    return r
  } catch (e) {
    toast.error(e instanceof Error && /already|couldn/.test(e.message) ? e.message : friendlyError(e))
    return undefined
  }
}
