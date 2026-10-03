/** Shared AI types. Safe to import from client code (no secrets, no server modules). */
export const AI_FEATURES = [
  'party_planner', 'theme_ideas', 'checklist', 'budget_optimizer', 'activities', 'food', 'invitation', 'timeline', 'shopping_list', 'discover_explain',
] as const
export type AIFeature = (typeof AI_FEATURES)[number]
export const isAIFeature = (v: unknown): v is AIFeature => typeof v === 'string' && (AI_FEATURES as readonly string[]).includes(v)

export type AIErrorCode =
  | 'unauthenticated' | 'forbidden_plan' | 'limit_reached' | 'invalid_input' | 'provider_error' | 'timeout'
  | 'invalid_response' | 'ai_disabled' | 'not_found' | 'high_demand'

export type ApplyTarget = 'checklist' | 'activities' | 'shopping_list' | 'theme' | 'budget' | 'invitation'

/** What /api/ai/capabilities returns for one feature. */
export interface FeatureCapability {
  feature: AIFeature
  enabled: boolean // flag on (AI_ENABLED + AI_ENABLED_FEATURES)
  allowed: boolean // plan allows it
  remaining: number | null // generations left for this party (null = unlimited / admin)
  limit: number | null
  upgradeTo: 'STARTER' | 'PLUS' | 'PRO' | null // cheapest plan that unlocks it
}
