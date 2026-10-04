'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { listParties, type Party } from '@/lib/data/parties'
import { localToday } from '@/lib/planning/checklist'
import { setAnalyticsParty } from '@/lib/analytics/client'

interface PartyContextValue {
  parties: Party[]
  party: Party | null
  isLoading: boolean
  error: unknown
  setActivePartyId: (id: string) => void
  refreshParties: () => Promise<unknown>
  /** Optimistically replace the active party in the cache. */
  replaceParty: (p: Party) => void
}

const Ctx = createContext<PartyContextValue | null>(null)
const ACTIVE_KEY = 'mbp.activePartyId'

/** Upcoming first (soonest), then most recent past party. */
export function pickDefaultParty(parties: Party[], today = localToday()): Party | null {
  const upcoming = parties.filter((p) => p.party_date >= today).sort((a, b) => a.party_date.localeCompare(b.party_date))
  if (upcoming.length) return upcoming[0]
  return [...parties].sort((a, b) => b.party_date.localeCompare(a.party_date))[0] ?? null
}

export function PartyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(user ? ['parties', user.id] : null, () => listParties(), {
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    try {
      setActiveId(localStorage.getItem(ACTIVE_KEY))
    } catch {
      /* private mode */
    }
  }, [])

  const parties = useMemo(() => data ?? [], [data])
  const party = useMemo(() => parties.find((p) => p.id === activeId) ?? pickDefaultParty(parties), [parties, activeId])

  useEffect(() => {
    setAnalyticsParty(party?.id ?? null)
  }, [party?.id])

  const setActivePartyId = useCallback((id: string) => {
    setActiveId(id)
    try {
      localStorage.setItem(ACTIVE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  const replaceParty = useCallback(
    (p: Party) => {
      void mutate((list) => {
        const rest = (list ?? []).filter((x) => x.id !== p.id)
        return [...rest, p].sort((a, b) => a.party_date.localeCompare(b.party_date))
      }, { revalidate: false })
    },
    [mutate],
  )

  const value = useMemo<PartyContextValue>(
    () => ({ parties, party, isLoading: !!user && isLoading && !data, error, setActivePartyId, refreshParties: () => mutate(), replaceParty }),
    [parties, party, user, isLoading, data, error, setActivePartyId, mutate, replaceParty],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useParty() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useParty must be used inside <PartyProvider>')
  return v
}

/** The party context when rendered inside <PartyProvider> (the app); null on public pages without one. */
export function useOptionalParty() {
  return useContext(Ctx)
}
