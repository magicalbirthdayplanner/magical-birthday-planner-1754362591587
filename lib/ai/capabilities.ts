/**
 * Single source of truth: AI feature → minimum plan + per-party generation caps. Marketing matrix (pricing page)
 * mapped onto features; deviations in docs/ai/DECISIONS.md. The server enforces this; the UI only displays it.
 */
import 'server-only'
import type { AIFeature, FeatureCapability } from './types'

export type Tier = 'FREE' | 'STARTER' | 'PLUS' | 'PRO'
const RANK: Record<Tier, number> = { FREE: 0, STARTER: 1, PLUS: 2, PRO: 3 }

export const FEATURE_MIN_TIER: Record<AIFeature, Tier> = {
  party_planner: 'FREE', // limited trial on Free
  theme_ideas: 'FREE', // Starter: "Theme suggestions based on age"
  checklist: 'STARTER', // Starter: "Smart checklist & timeline"
  invitation: 'STARTER', // Starter: "Simple invitation creator"
  timeline: 'STARTER', // Starter: "Smart checklist & timeline"
  activities: 'PLUS', // Plus: "Personalized activity ideas"
  shopping_list: 'PLUS',
  discover_explain: 'PLUS',
  budget_optimizer: 'PRO', // Pro: "Smart budget tracker with cost insights" (Plus: manual input only)
  food: 'PRO', // Pro: "Personalized food suggestions by age & theme"
  // Party Experience (proposal; all flagged off until enabled — see docs/experience/README.md)
  activity_studio: 'PLUS', // creating/personalising activities = "Personalized activity ideas" (Plus)
  host_content: 'STARTER', // short speeches and messages, sits with the Starter invitation creator
  party_experience: 'PLUS', // the multi-section plan; Free keeps the lighter Plan My Party
}

/** Generations per party (all features together), plus a per-user hourly cap. */
export const PARTY_CAP: Record<Tier, number> = { FREE: 3, STARTER: 10, PLUS: 25, PRO: 50 }
export const USER_HOURLY_CAP = 10

/** Effective AI tier. A sign-up trial counts as Free for AI; Super Admin overrides apply as their plan. */
export function tierFor(plan: { plan: string; source: string }): Tier {
  if (plan.source === 'trial') return 'FREE'
  if (plan.plan === 'PRO' || plan.plan === 'PROFESSIONAL') return 'PRO'
  if (plan.plan === 'PLUS') return 'PLUS'
  if (plan.plan === 'STARTER') return 'STARTER'
  return 'FREE'
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
    upgradeTo: allowed ? null : (min === 'FREE' ? 'STARTER' : min),
  }
}
