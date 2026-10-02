'use client'
import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/data/api'

export type Plan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO'
const ORDER: Plan[] = ['FREE', 'STARTER', 'PLUS', 'PRO']

/** Server-derived plan (/api/billing/status). The browser never decides entitlements. */
export function usePlanStatus() {
  const { user } = useAuth()
  const { data } = useSWR(user ? ['billing', user.id] : null, () => apiFetch<{ plan: string; trialActive: boolean }>('/api/billing/status'))
  const currentPlan: Plan = ORDER.includes(data?.plan as Plan) ? (data!.plan as Plan) : 'FREE'
  return {
    currentPlan,
    trialActive: !!data?.trialActive,
    canUpgradeTo: (target: Plan) => ORDER.indexOf(target) > ORDER.indexOf(currentPlan),
  }
}
