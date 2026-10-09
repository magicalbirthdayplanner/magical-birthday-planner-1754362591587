'use client'
import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { useOptionalParty } from '@/components/app/PartyProvider'
import { apiFetch } from '@/lib/data/api'
import { allows, effectivePlan, ownedPlan, planAtLeast, type Capability, type Plan, type PlanState } from '@/lib/entitlements'

export type { Plan }

type Status = PlanState & { trialActive: boolean; superAdmin?: boolean }

/**
 * Server-derived plan (/api/billing/status) mapped through the product model (lib/entitlements.ts). Plans are bought
 * per party, so this is the plan of `partyId` — by default the active party when rendered inside <PartyProvider>
 * (account-level plan otherwise). The browser never decides entitlements: this only chooses what to SHOW.
 */
export function usePlanStatus(partyId?: string | null) {
  const { user } = useAuth()
  const ctx = useOptionalParty()
  const pid = partyId !== undefined ? partyId : (ctx?.party?.id ?? null)
  const { data, isLoading } = useSWR(user ? ['billing', user.id, pid] : null, () => apiFetch<Status>(`/api/billing/status${pid ? `?partyId=${pid}` : ''}`))
  const owned = ownedPlan(data)
  return {
    loaded: !user || !!data,
    partyId: pid,
    isLoading,
    /** Effective plan for non-AI features (a trial counts as Starter here). */
    currentPlan: effectivePlan(data, { ai: false }),
    /** The plan the user bought (or was given). A trial owns nothing. */
    ownedPlan: owned,
    onTrial: data?.source === 'trial',
    /** One of the first 25 accounts: Pro free on every party (an account-wide gift, not a purchase). */
    founding: data?.source === 'founding',
    trialActive: !!data?.trialActive,
    superAdmin: !!data?.superAdmin,
    /** Display-only check; the server enforces. While loading, nothing is reported as locked. */
    can: (c: Capability) => (!user ? false : !data ? true : allows(data, c, !!data.superAdmin)),
    canUpgradeTo: (target: Plan) => !planAtLeast(owned, target),
  }
}
