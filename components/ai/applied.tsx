'use client'
/**
 * Which suggestions of the open result are already on the party ("target:itemId"). Seeded from the stored
 * generation's apply log, updated by Add / Add all / Undo, so a reopened result shows "Added" correctly.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface AppliedApi { has: (target: string, itemId: string) => boolean; mark: (target: string, itemIds: string[]) => void; unmark: (target: string, itemId: string) => void }
const Ctx = createContext<AppliedApi | null>(null)

export function AppliedProvider({ initial = [], children }: { initial?: string[]; children: ReactNode }) {
  const [keys, setKeys] = useState(() => new Set(initial))
  const mark = useCallback((target: string, ids: string[]) => setKeys((k) => new Set([...k, ...ids.map((i) => `${target}:${i}`)])), [])
  const unmark = useCallback((target: string, id: string) => setKeys((k) => {
    const n = new Set(k)
    n.delete(`${target}:${id}`)
    return n
  }), [])
  const api = useMemo<AppliedApi>(() => ({ has: (t, i) => keys.has(`${t}:${i}`), mark, unmark }), [keys, mark, unmark])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

const NOOP: AppliedApi = { has: () => false, mark: () => undefined, unmark: () => undefined }
export function useApplied(): AppliedApi {
  return useContext(Ctx) ?? NOOP
}
