import { describe, expect, it } from 'vitest'
import { allows, CAPABILITIES, effectivePlan, formatPrice, minPlanFor, ownedPlan, PLAN_INFO, PLANS, planAtLeast, type Capability, type Plan } from '@/lib/entitlements'
import { capability, FEATURE_MIN_TIER, PARTY_CAP, planAllows, tierFor } from '@/lib/ai/capabilities'
import { AI_FEATURES } from '@/lib/ai/types'
import { COMPARISON, PLAN_HIGHLIGHTS } from '@/components/billing/planContent'
import { expectedPriceCents } from '@/lib/billing/plans'
import { EXPECTED_CENTS, productProblems } from '../../scripts/check-dodo-prices.mjs'

const free = { plan: 'FREE', source: 'free' }
const trial = { plan: 'PRO', source: 'trial' }
const buy = (plan: string) => ({ plan, source: 'purchase' })

/** The finalized product model, written out once so a change to lib/entitlements.ts has to be deliberate. */
const MODEL: Record<Plan, Capability[]> = {
  FREE: ['party', 'discover', 'saved_venues', 'checklist_basic', 'themes', 'party_plan', 'activities_manual'],
  STARTER: ['guests', 'rsvp', 'party_planner', 'theme_ideas', 'checklist', 'activity_studio', 'activities'],
  PLUS: ['food', 'budget_optimizer', 'invitation', 'timeline', 'shopping_list', 'discover_explain'],
  PRO: ['host_content', 'party_experience'],
}

describe('product model (lib/entitlements.ts)', () => {
  it('every capability has exactly the minimum plan of the finalized model', () => {
    const listed = Object.values(MODEL).flat().sort()
    expect(Object.keys(CAPABILITIES).sort()).toEqual(listed)
    for (const p of PLANS) for (const c of MODEL[p]) expect([c, minPlanFor(c)]).toEqual([c, p])
  })

  it('Free has no AI at all and no guests/RSVP', () => {
    for (const [c, info] of Object.entries(CAPABILITIES) as [Capability, (typeof CAPABILITIES)[Capability]][]) {
      expect([c, allows(free, c)]).toEqual([c, !info.ai && info.minPlan === 'FREE'])
    }
  })

  it('the 24 h trial unlocks Starter’s non-AI features and no AI', () => {
    expect(allows(trial, 'guests')).toBe(true)
    expect(allows(trial, 'rsvp')).toBe(true)
    for (const c of Object.keys(CAPABILITIES) as Capability[]) if (CAPABILITIES[c].ai) expect([c, allows(trial, c)]).toEqual([c, false])
    expect(effectivePlan(trial, { ai: true })).toBe('FREE')
    expect(effectivePlan(trial, { ai: false })).toBe('STARTER')
    expect(ownedPlan(trial)).toBe('FREE')
  })

  it('each paid plan includes everything below it and nothing above it', () => {
    for (const p of ['STARTER', 'PLUS', 'PRO'] as const) {
      for (const c of Object.keys(CAPABILITIES) as Capability[]) expect([p, c, allows(buy(p), c)]).toEqual([p, c, planAtLeast(p, minPlanFor(c))])
      expect(ownedPlan(buy(p))).toBe(p)
    }
    expect(effectivePlan(buy('PROFESSIONAL'), { ai: true })).toBe('PRO') // legacy plan name
    expect(effectivePlan({ plan: 'PLUS', source: 'admin_override' }, { ai: true })).toBe('PLUS')
    expect(effectivePlan(null, { ai: false })).toBe('FREE')
  })

  it('Super Admin is allowed everything', () => {
    for (const c of Object.keys(CAPABILITIES) as Capability[]) expect(allows(free, c, true)).toBe(true)
  })

  it('prices match Dodo’s configured prices and are increasing', () => {
    expect([PLAN_INFO.FREE.priceCents, PLAN_INFO.STARTER.priceCents, PLAN_INFO.PLUS.priceCents, PLAN_INFO.PRO.priceCents]).toEqual([0, 999, 1999, 2999])
    for (const p of ['STARTER', 'PLUS', 'PRO'] as const) expect(expectedPriceCents(p, {})).toBe(PLAN_INFO[p].priceCents)
  })

  it('displays Free $0 · Starter $9.99 · Plus $19.99 · Pro $29.99', () => {
    expect(PLANS.map((p) => formatPrice(PLAN_INFO[p].priceCents))).toEqual(['$0', '$9.99', '$19.99', '$29.99'])
  })

  it('the Dodo price check expects exactly the displayed prices and flags an old-priced product', () => {
    for (const p of ['STARTER', 'PLUS', 'PRO'] as const) expect(EXPECTED_CENTS[p]).toBe(PLAN_INFO[p].priceCents)
    const product = (price: number, extra = {}) => ({ price: { type: 'one_time_price', currency: 'USD', price, discount: 0, pay_what_you_want: false, ...extra } })
    expect(productProblems(product(1999), EXPECTED_CENTS.PLUS)).toEqual([])
    expect(productProblems(product(999), EXPECTED_CENTS.PLUS)).toEqual(['price is 999 cents, expected 1999'])
    expect(productProblems(product(2999, { type: 'recurring_price' }), EXPECTED_CENTS.PRO)).toHaveLength(1)
  })
})

describe('AI enforcement uses the same model', () => {
  it('every AI feature’s server minimum tier comes from the model', () => {
    for (const f of AI_FEATURES) {
      expect(CAPABILITIES[f].ai).toBe(true)
      expect(FEATURE_MIN_TIER[f]).toBe(minPlanFor(f))
    }
  })
  it('tiers: trial → FREE for AI; purchases map to their plan; allowance grows with the plan', () => {
    expect(tierFor(trial)).toBe('FREE')
    expect(tierFor(free)).toBe('FREE')
    expect(tierFor(buy('PLUS'))).toBe('PLUS')
    expect(PARTY_CAP).toEqual({ FREE: 0, STARTER: 10, PLUS: 25, PRO: 50 })
  })
  it('planAllows / capability agree with allows() and suggest the cheapest plan that unlocks', () => {
    for (const f of AI_FEATURES) {
      for (const t of PLANS) {
        expect(planAllows(f, t)).toBe(allows(buy(t), f))
        const cap = capability(f, { enabled: true, tier: t, superAdmin: false, used: 0 })
        expect(cap.allowed).toBe(planAllows(f, t))
        if (!cap.allowed) expect(cap.upgradeTo).toBe(minPlanFor(f))
      }
    }
  })
})

describe('pricing page reflects the model', () => {
  it('comparison rows match the minimum plans of what they describe', () => {
    const byLabel: Record<string, Capability> = {
      'Create your party': 'party', 'Discover venues & map': 'discover', 'Save & compare venues': 'saved_venues', 'Party checklist': 'checklist_basic',
      'Curated themes': 'themes', 'Party plan & your own activities': 'party_plan', Guests: 'guests', 'Invitations & RSVP': 'rsvp',
      'Plan My Party': 'party_planner', 'AI theme ideas': 'theme_ideas', 'AI checklist': 'checklist', 'AI Activity Studio': 'activity_studio',
      'Food planner': 'food', 'Budget assistant': 'budget_optimizer', 'Invitation writer': 'invitation', 'Party-day timeline': 'timeline', 'Shopping list': 'shopping_list',
      'Party Host: welcome, activity intros, cake, closing': 'host_content', 'Thank-you & reminder messages': 'host_content', 'Party Experience (everything designed together)': 'party_experience',
    }
    const rows = COMPARISON.flatMap((s) => s.rows)
    expect(rows.map((r) => r.label).sort()).toEqual(Object.keys(byLabel).sort())
    for (const r of rows) expect([r.label, r.min]).toEqual([r.label, minPlanFor(byLabel[r.label])])
    expect(COMPARISON.map((s) => s.category)).toEqual(['Plan', 'Manage', 'AI planning', 'AI organization', 'AI party experience'])
  })
  it('unadvertised capabilities are not sold; every advertised paid capability appears', () => {
    const text = JSON.stringify(PLAN_HIGHLIGHTS) + JSON.stringify(COMPARISON)
    expect(text).not.toMatch(/why these places|activity list/i)
    for (const p of PLANS) expect(PLAN_HIGHLIGHTS[p].items.length).toBeGreaterThan(0)
    expect(PLAN_HIGHLIGHTS.FREE.ai).toBeUndefined()
    expect(PLAN_HIGHLIGHTS.STARTER.ai).toMatch(/10/)
    expect(PLAN_HIGHLIGHTS.PLUS.ai).toMatch(/25/)
    expect(PLAN_HIGHLIGHTS.PRO.ai).toMatch(/50/)
  })
})
