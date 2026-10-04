'use client'
import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/data/api'
import { allows, effectivePlan, ownedPlan, planAtLeast, type Capability, type Plan, type PlanState } from '@/lib/entitlements'

export type { Plan }

type Status = PlanState & { trialActive: boolean; superAdmin?: boolean }

/**
 * Server-derived plan (/api/billing/status) mapped through the product model (lib/entitlements.ts). The browser
 * never decides entitlements: this only chooses what to SHOW. The server enforces every paid capability.
 */
export function usePlanStatus() {
  const { user } = useAuth()
  const { data, isLoading } = useSWR(user ? ['billing', user.id] : null, () => apiFetch<Status>('/api/billing/status'))
  const owned = ownedPlan(data)
  return {
    loaded: !user || !!data,
    isLoading,
    /** Effective plan for non-AI features (a trial counts as Starter here). */
    currentPlan: effectivePlan(data, { ai: false }),
    /** The plan the user bought (or was given). A trial owns nothing. */
    ownedPlan: owned,
    onTrial: data?.source === 'trial',
    trialActive: !!data?.trialActive,
    superAdmin: !!data?.superAdmin,
    /** Display-only check; the server enforces. While loading, nothing is reported as locked. */
    can: (c: Capability) => (!user ? false : !data ? true : allows(data, c, !!data.superAdmin)),
    canUpgradeTo: (target: Plan) => !planAtLeast(owned, target),
  }
}
