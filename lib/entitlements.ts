/**
 * THE product model: plans and which plan each capability needs. Single source of truth for the server (AI routes,
 * guests/RSVP enforcement), the UI (locks, upgrade prompts) and the pricing page. Isomorphic: no secrets here.
 *
 *   FREE "Explore"  → STARTER "Plan" ($9.99) → PLUS "Organize" ($19.99) → PRO "Experience" ($29.99), priced PER PARTY
 *
 * A paid plan is bought for one party (migration 20251004001400). Enforcement lives on the server, per party:
 * lib/ai/handler.ts (AI, via getPartyPlan), the guests/party_invitations RLS policies (`public.has_paid_access(party)`)
 * and /api/invitations/send. Admin overrides, the founding-family gift (first 25 accounts: Pro, free) and the sign-up
 * trial are account-wide. The UI only displays this.
 */

export const PLANS = ['FREE', 'STARTER', 'PLUS', 'PRO'] as const
export type Plan = (typeof PLANS)[number]
const RANK: Record<Plan, number> = { FREE: 0, STARTER: 1, PLUS: 2, PRO: 3 }
export const planRank = (p: Plan) => RANK[p]
export const planAtLeast = (have: Plan, need: Plan) => RANK[have] >= RANK[need]

export const PLAN_INFO: Record<Plan, { name: string; stage: string; tagline: string; priceCents: number }> = {
  FREE: { name: 'Free', stage: 'Explore', tagline: 'Find venues, browse ideas and start planning.', priceCents: 0 },
  STARTER: { name: 'Starter', stage: 'Plan', tagline: 'Let AI help you build your party plan.', priceCents: 999 },
  PLUS: { name: 'Plus', stage: 'Organize', tagline: 'Let AI handle the details.', priceCents: 1999 },
  PRO: { name: 'Pro', stage: 'Experience', tagline: 'Let AI help make the birthday itself magical.', priceCents: 2999 },
}

/** Capability ids. AI ids are the AI feature ids used by /api/ai/* (lib/ai/types.ts AI_FEATURES). */
export type Capability =
  // core (no AI)
  | 'party' | 'discover' | 'saved_venues' | 'checklist_basic' | 'themes' | 'party_plan' | 'activities_manual'
  | 'guests' | 'rsvp'
  // AI
  | 'party_planner' | 'theme_ideas' | 'checklist' | 'activity_studio' | 'activities'
  | 'food' | 'budget_optimizer' | 'invitation' | 'timeline' | 'shopping_list' | 'discover_explain'
  | 'host_content' | 'party_experience'

export interface CapabilityInfo {
  minPlan: Plan
  ai: boolean
  /** Shown in locks and upgrade prompts. */
  name: string
  /** Value, not mechanics: why a parent would want it. */
  pitch: string
  /** Listed on the pricing page (only validated, live capabilities are advertised). */
  advertised: boolean
}

export const CAPABILITIES: Record<Capability, CapabilityInfo> = {
  party: { minPlan: 'FREE', ai: false, name: 'Create a party', pitch: 'Set up the party in nine quick questions.', advertised: true },
  discover: { minPlan: 'FREE', ai: false, name: 'Discover venues', pitch: 'Real local party places, matched to your child.', advertised: true },
  saved_venues: { minPlan: 'FREE', ai: false, name: 'Save & compare venues', pitch: 'Shortlist places with private notes.', advertised: true },
  checklist_basic: { minPlan: 'FREE', ai: false, name: 'Party checklist', pitch: 'A dated to-do list built from your party date.', advertised: true },
  themes: { minPlan: 'FREE', ai: false, name: 'Theme ideas', pitch: 'Browse our curated party themes.', advertised: true },
  party_plan: { minPlan: 'FREE', ai: false, name: 'Party plan', pitch: 'Venue, theme, activities, budget and timeline in one place.', advertised: true },
  activities_manual: { minPlan: 'FREE', ai: false, name: 'Your own activities', pitch: 'Add and organise the games and crafts you choose.', advertised: true },

  guests: { minPlan: 'STARTER', ai: false, name: 'Guests & RSVP', pitch: 'Invite families, collect RSVPs with one link and see who’s coming at a glance.', advertised: true },
  rsvp: { minPlan: 'STARTER', ai: false, name: 'Invitations & RSVP', pitch: 'A beautiful invitation, emailed or shared, with RSVPs collected for you.', advertised: true },

  party_planner: { minPlan: 'STARTER', ai: true, name: 'Plan My Party', pitch: 'A complete party plan — theme, activities, food, budget and shopping — built around your child.', advertised: true },
  theme_ideas: { minPlan: 'STARTER', ai: true, name: 'AI theme ideas', pitch: 'Five original themes from what your child loves (and what to avoid).', advertised: true },
  checklist: { minPlan: 'STARTER', ai: true, name: 'AI checklist', pitch: '“What am I forgetting?” — the tasks your party still needs, with dates.', advertised: true },
  activity_studio: { minPlan: 'STARTER', ai: true, name: 'AI Activity Studio', pitch: 'Personalised activities for your child’s age, interests, theme and guest count — with materials and steps.', advertised: true },
  activities: { minPlan: 'STARTER', ai: true, name: 'AI activity list', pitch: 'Activity ideas for your party.', advertised: false },

  food: { minPlan: 'PLUS', ai: true, name: 'AI Food Planner', pitch: 'A menu with quantities for your real headcount and dietary needs.', advertised: true },
  budget_optimizer: { minPlan: 'PLUS', ai: true, name: 'AI Budget Assistant', pitch: 'Where your money goes, what you forgot and how to stretch it.', advertised: true },
  invitation: { minPlan: 'PLUS', ai: true, name: 'AI Invitation Writer', pitch: 'Invitation wording in your tone, ready to send.', advertised: true },
  timeline: { minPlan: 'PLUS', ai: true, name: 'AI Timeline', pitch: 'Your plan turned into a minute-by-minute party day, plus prep tasks.', advertised: true },
  shopping_list: { minPlan: 'PLUS', ai: true, name: 'AI Shopping List', pitch: 'One shopping list from everything you planned.', advertised: true },
  discover_explain: { minPlan: 'PLUS', ai: true, name: 'Why these places', pitch: 'Why each venue fits your party.', advertised: false },

  host_content: { minPlan: 'PRO', ai: true, name: 'AI Party Host', pitch: 'What to say on the day — welcome speech, activity intros, cake moment, closing — and personal thank-you messages.', advertised: true },
  party_experience: { minPlan: 'PRO', ai: true, name: 'AI Party Experience', pitch: 'Your whole party designed together: theme, activities, timeline, food, shopping and what to say.', advertised: true },
}

export const isCapability = (x: unknown): x is Capability => typeof x === 'string' && x in CAPABILITIES
export const minPlanFor = (c: Capability): Plan => CAPABILITIES[c].minPlan

/** Server-derived plan state (lib/billing/server getUserPlan → /api/billing/status). */
export interface PlanState {
  plan: string
  source: 'founding' | 'admin_override' | 'purchase' | 'trial' | 'free' | string
}

const asPlan = (p: string): Plan => (p === 'PRO' || p === 'PROFESSIONAL' ? 'PRO' : p === 'PLUS' ? 'PLUS' : p === 'STARTER' ? 'STARTER' : 'FREE')

/**
 * Effective plan for one capability. The 24 h sign-up trial unlocks Starter's NON-AI features (guests & RSVP) and no
 * AI (AI costs real money per request). Purchases and admin overrides apply as their plan.
 */
export function effectivePlan(state: PlanState | null | undefined, opts: { ai: boolean }): Plan {
  if (!state) return 'FREE'
  if (state.source === 'trial') return opts.ai ? 'FREE' : 'STARTER'
  return asPlan(state.plan)
}

export function allows(state: PlanState | null | undefined, c: Capability, superAdmin = false): boolean {
  if (superAdmin) return true
  const info = CAPABILITIES[c]
  return planAtLeast(effectivePlan(state, { ai: info.ai }), info.minPlan)
}

/** The plan a parent actually owns (purchase or override). A trial owns nothing. Drives pricing CTAs. */
export function ownedPlan(state: PlanState | null | undefined): Plan {
  if (!state || state.source === 'trial' || state.source === 'free') return 'FREE'
  return asPlan(state.plan)
}

export const formatPrice = (cents: number) => (cents === 0 ? '$0' : `$${(cents / 100).toFixed(2)}`)
