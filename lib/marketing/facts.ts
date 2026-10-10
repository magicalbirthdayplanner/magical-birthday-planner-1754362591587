/**
 * The founder agent's fact register: the ONLY facts generated posts may state about the founder, the product or its
 * history. Each was verified against this repository, its git history or an owner ruling (see
 * docs/marketing/FOUNDER_MARKETING_AGENT.md). Anything not here is opinion, a question, or general advice — never a
 * claim. Update this list (not the prompt) when something new becomes true; never add user counts, revenue,
 * testimonials, press or partnerships unless they are real and verifiable.
 */

export interface Fact { id: string; text: string }

export const PRODUCT_URL = 'https://magicalbirthdayplanner.app'
export const PRODUCT_NAME = 'Magical Birthday Planner'

export const FOUNDER_FACTS: Fact[] = [
  { id: 'F-origin', text: 'The founder is a parent who started building Magical Birthday Planner after planning a child’s birthday turned into many browser tabs, text threads and notes.' },
  { id: 'F-first-commit', text: 'The first commit was on July 31, 2025. The first prototype already had a party wizard, a guest list with RSVPs and AI theme suggestions.' },
  { id: 'F-pause', text: 'The prototype’s last commit landed a week before the founder’s daughter turned 6 (October 2025). Then the project sat untouched for almost a year.' },
  { id: 'F-rebuild', text: 'A mobile-first rebuild started on October 1, 2026. Most of the old desktop prototype was deleted rather than patched.' },
  { id: 'F-launch', text: 'Public launch is October 13, 2026 — the same day the founder’s daughter turns 7.' },
  { id: 'F-signups-open', text: 'Sign-ups opened before launch (October 9, 2026); the early waitlist was retired because it added friction.' },
  { id: 'F-fake-claim', text: 'A pre-launch audit found the old prototype homepage claimed "10,000+ parents". It was not true and was removed.' },
  { id: 'F-early', text: 'The product is brand new: there are very few users so far, and the founder wants honest feedback from parents.' },
]

export const PRODUCT_FACTS: Fact[] = [
  { id: 'P-wizard', text: 'Party setup is a short wizard with one question per screen; optional steps can be skipped.' },
  { id: 'P-venues', text: 'Venue discovery searches real local places (US ZIP codes) for kids’ parties and explains why each place is suggested using plain data (distance, rating, fit for the child’s age).' },
  { id: 'P-ranking', text: 'Venue ranking looks at several factors; a 5.0 rating from 3 reviews does not beat a 4.7 from hundreds.' },
  { id: 'P-age', text: 'Venue search skips categories that do not fit the child’s age (no laser tag for toddlers).' },
  { id: 'P-guests', text: 'Guest list and RSVP tracking: guests RSVP from a link without creating an account (yes / maybe / can’t go, kids and adults).' },
  { id: 'P-invites', text: 'Invitations can be shared by link; replies land in the guest list automatically.' },
  { id: 'P-checklist', text: 'The checklist dates every task from the party date; an AI check suggests tasks you may have missed.' },
  { id: 'P-themes', text: 'Theme ideas: AI suggests party themes from the child’s age and interests.' },
  { id: 'P-ai-plan', text: 'AI planning features (party plan, activities, food quantities, timeline, shopping list) work from the party details; nothing changes until the parent taps Add.' },
  { id: 'P-ai-no-chat', text: 'The AI is not a chatbot to manage; it fills in planning pieces inside the plan, and nothing is ever sent to anyone automatically.' },
  { id: 'P-ai-privacy', text: 'The AI never sees guest names, emails, phone numbers or exact location.' },
  { id: 'P-mobile', text: 'It works in the phone browser and can be installed like an app.' },
]

/** House rules every post must follow (owner rulings). */
export const HOUSE_RULES = [
  'The founder is anonymous: never name the founder or any family member, never describe their appearance.',
  'Never invent events, conversations, customers, quotes, numbers, testimonials, press, awards, partnerships or traction.',
  'Never state prices, plan names, discounts or "free" offers (pricing is communicated manually by the founder).',
  'Never name the AI vendor or model, and never quote internal usage limits.',
  'No copyrighted characters, franchises, celebrities or competitor names.',
  'No politics, religion, news events, or anything unrelated to family celebrations and building the product.',
  'No mentions (@handles), no more than one hashtag (prefer none), at most one emoji (prefer none).',
  'Never criticise parents, never use fear, guilt, fake urgency or scarcity.',
]

export function factSheet(): string {
  const fmt = (f: Fact) => `- [${f.id}] ${f.text}`
  return ['FOUNDER FACTS (true; use only these about the founder):', ...FOUNDER_FACTS.map(fmt), '', 'PRODUCT FACTS (true; use only these about the product):', ...PRODUCT_FACTS.map(fmt)].join('\n')
}
