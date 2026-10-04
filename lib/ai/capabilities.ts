/**
 * AI view of the product model: feature → minimum plan (from lib/entitlements.ts) + per-party generation caps.
 * The server enforces this (lib/ai/handler.ts); the UI only displays it.
 */
import 'server-only'
import { effectivePlan, minPlanFor, type Plan } from '@/lib/entitlements'
import { AI_FEATURES, type AIFeature, type FeatureCapability } from './types'

export type Tier = Plan
const RANK: Record<Tier, number> = { FREE: 0, STARTER: 1, PLUS: 2, PRO: 3 }

/** Derived from the product model in lib/entitlements.ts (the single source of truth). */
export const FEATURE_MIN_TIER = Object.fromEntries(AI_FEATURES.map((f) => [f, minPlanFor(f)])) as Record<AIFeature, Tier>

/** Generations per party (all features together), plus a per-user hourly cap. Free has no AI. */
export const PARTY_CAP: Record<Tier, number> = { FREE: 0, STARTER: 10, PLUS: 25, PRO: 50 }
export const USER_HOURLY_CAP = 10

/** Effective AI tier. A sign-up trial counts as Free for AI; Super Admin overrides apply as their plan. */
export function tierFor(plan: { plan: string; source: string }): Tier {
  return effectivePlan(plan, { ai: true })
}

export function planAllows(feature: AIFeature, tier: Tier, superAdmin = false): boolean {
  return superAdmin || RANK[tier] >= RANK[FEATURE_MIN_TIER[feature]]
}

export function capability(feature: AIFeature, opts: { enabled: boolean; tier: Tier; superAdmin: boolean; used: number }): FeatureCapability {
  const allowed = planAllows(feature, opts.tier, opts.superAdmin)
  const limit = opts.superAdmin ? null : PARTY_CAP[opts.tier]
  const min = FEATURE_MIN_TIER[feature]
  return {
    feature,
    enabled: opts.enabled,
    allowed,
    limit,
    remaining: limit == null ? null : Math.max(0, limit - opts.used),
    upgradeTo: allowed ? null : (min === 'FREE' ? 'STARTER' : min) as FeatureCapability['upgradeTo'],
  }
}
