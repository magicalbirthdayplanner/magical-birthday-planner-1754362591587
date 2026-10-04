'use client'
import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/data/api'

export type Plan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO'
const ORDER: Plan[] = ['FREE', 'STARTER', 'PLUS', 'PRO']

type Source = 'admin_override' | 'purchase' | 'trial' | 'free'

/**
 * Server-derived plan (/api/billing/status). The browser never decides entitlements: this only chooses which
 * plans to OFFER. Checkout, product and price are decided by the server; a plan is granted only by a verified
 * payment webhook (or a Super Admin override).
 */
export function usePlanStatus() {
  const { user } = useAuth()
  const { data } = useSWR(user ? ['billing', user.id] : null, () => apiFetch<{ plan: string; source?: Source; trialActive: boolean }>('/api/billing/status'))
  const currentPlan: Plan = ORDER.includes(data?.plan as Plan) ? (data!.plan as Plan) : 'FREE'
  // The sign-up trial is temporary: it never hides a plan from purchase. Only a plan the user actually owns
  // (purchase or admin override) counts when deciding what's an upgrade.
  const onTrial = data?.source === 'trial'
  const ownedPlan: Plan = onTrial ? 'FREE' : currentPlan
  return {
    currentPlan,
    ownedPlan,
    onTrial,
    trialActive: !!data?.trialActive,
    canUpgradeTo: (target: Plan) => ORDER.indexOf(target) > ORDER.indexOf(ownedPlan),
  }
}
