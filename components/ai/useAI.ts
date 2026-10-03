'use client'
/** Client helpers for AI features: capabilities (display only — the server enforces) and an abortable generate call. */
import { useCallback, useRef, useState } from 'react'
import useSWR from 'swr'
import { apiFetch, ApiError } from '@/lib/data/api'
import type { AIFeature, FeatureCapability } from '@/lib/ai/types'

export interface Capabilities { enabled: boolean; tier: string; superAdmin: boolean; used: number; features: FeatureCapability[] }

export function useAICapabilities(partyId: string | null | undefined) {
  const swr = useSWR(partyId ? ['ai-capabilities', partyId] : null, () => apiFetch<Capabilities>(`/api/ai/capabilities?partyId=${partyId}`), { revalidateOnFocus: false, shouldRetryOnError: false })
  const get = (f: AIFeature) => swr.data?.features.find((x) => x.feature === f) ?? null
  return { ...swr, get }
}

export type GenState<R> = { phase: 'idle' } | { phase: 'loading' } | { phase: 'done'; generationId: string; result: R; remaining: number | null; appliedKeys?: string[]; restoredAt?: string } | { phase: 'error'; code: string; message: string; upgradeTo?: string | null }

export function useAIGenerate<R>(path: string) {
  const [state, setState] = useState<GenState<R>>({ phase: 'idle' })
  const ctrl = useRef<AbortController | null>(null)
  const run = useCallback(async (body: Record<string, unknown>) => {
    ctrl.current?.abort()
    const ac = new AbortController()
    ctrl.current = ac
    setState({ phase: 'loading' })
    try {
      const r = await apiFetch<{ generationId: string; result: R; remaining: number | null }>(path, { method: 'POST', body: JSON.stringify(body), signal: ac.signal })
      if (!ac.signal.aborted) setState({ phase: 'done', ...r })
    } catch (e) {
      if (ac.signal.aborted) return setState({ phase: 'idle' })
      const err = e instanceof ApiError ? e : null
      setState({ phase: 'error', code: err?.code ?? 'provider_error', message: err?.message ?? 'We couldn’t generate your ideas right now. Your party data is safe. Try again.' })
    }
  }, [path])
  const cancel = useCallback(() => {
    ctrl.current?.abort()
    setState({ phase: 'idle' })
  }, [])
  const reset = useCallback(() => setState({ phase: 'idle' }), [])
  /** Show a stored result again (no new generation). */
  const restore = useCallback((g: { generationId: string; result: R; appliedKeys: string[]; createdAt: string }) => {
    setState({ phase: 'done', generationId: g.generationId, result: g.result, remaining: null, appliedKeys: g.appliedKeys, restoredAt: g.createdAt })
  }, [])
  return { state, run, cancel, reset, restore }
}
