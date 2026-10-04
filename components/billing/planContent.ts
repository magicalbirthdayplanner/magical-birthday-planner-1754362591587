/** What the pricing page says about each plan. Pure data (no React) so tests can check it against lib/entitlements.ts. */
import type { Plan } from '@/lib/entitlements'

/** Per-tier highlights: only capabilities validated and live (see docs/PRODUCT_MODEL_AUDIT.md). */
export const PLAN_HIGHLIGHTS: Record<Plan, { intro?: string; items: string[]; ai?: string }> = {
  FREE: {
    items: ['Create your party in 9 quick questions', 'Discover real local venues on a map', 'Save and compare venues', 'Party checklist with dates', 'Curated party themes', 'Your party plan and your own activities'],
  },
  STARTER: {
    intro: 'Everything in Free, plus:',
    items: ['Guests & RSVP — invitation link, emailed invites, RSVPs collected for you', 'AI Plan My Party — a complete plan built around your child', 'AI theme ideas', 'AI checklist — “What am I forgetting?”', 'AI Activity Studio — personalised activities with materials and steps'],
    ai: '10 AI requests per party',
  },
  PLUS: {
    intro: 'Everything in Starter, plus:',
    items: ['AI Food Planner — menu and quantities for your headcount', 'AI Budget Assistant', 'AI Invitation Writer', 'AI Timeline — your party day, minute by minute', 'AI Shopping List from everything you planned'],
    ai: '25 AI requests per party',
  },
  PRO: {
    intro: 'Everything in Plus, plus:',
    items: ['AI Party Host — welcome speech, activity intros, cake moment and closing words', 'Personal thank-you and reminder messages', 'AI Party Experience — theme, activities, timeline, food, shopping and what to say, designed together'],
    ai: '50 AI requests per party',
  },
}

type Row = { label: string; min: Plan }
export const COMPARISON: { category: string; rows: Row[] }[] = [
  { category: 'Plan', rows: [{ label: 'Create your party', min: 'FREE' }, { label: 'Discover venues & map', min: 'FREE' }, { label: 'Save & compare venues', min: 'FREE' }, { label: 'Party checklist', min: 'FREE' }, { label: 'Curated themes', min: 'FREE' }] },
  { category: 'Manage', rows: [{ label: 'Party plan & your own activities', min: 'FREE' }, { label: 'Guests', min: 'STARTER' }, { label: 'Invitations & RSVP', min: 'STARTER' }] },
  { category: 'AI planning', rows: [{ label: 'Plan My Party', min: 'STARTER' }, { label: 'AI theme ideas', min: 'STARTER' }, { label: 'AI checklist', min: 'STARTER' }, { label: 'AI Activity Studio', min: 'STARTER' }] },
  { category: 'AI organization', rows: [{ label: 'Food planner', min: 'PLUS' }, { label: 'Budget assistant', min: 'PLUS' }, { label: 'Invitation writer', min: 'PLUS' }, { label: 'Party-day timeline', min: 'PLUS' }, { label: 'Shopping list', min: 'PLUS' }] },
  { category: 'AI party experience', rows: [{ label: 'Party Host: welcome, activity intros, cake, closing', min: 'PRO' }, { label: 'Thank-you & reminder messages', min: 'PRO' }, { label: 'Party Experience (everything designed together)', min: 'PRO' }] },
]
