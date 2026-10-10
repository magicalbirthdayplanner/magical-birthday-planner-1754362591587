/**
 * Content pillars: default weekly mix, what each pillar is for, a topic bank, and link/image policy.
 * Topics are starting angles, not copy — the model writes the post. Rotation and learning live in strategy.ts.
 */
import type { Pillar } from './types'

export interface Topic { key: string; angle: string }

export interface PillarSpec {
  /** Share of the default weekly mix (launch_invitation is not part of the mix: see strategy.ts). */
  weight: number
  brief: string
  /** 'always' | 'never' | 'optional' (optional = the strategy alternates). */
  link: 'always' | 'never' | 'optional'
  image: 'always' | 'never' | 'optional'
  topics: Topic[]
}

export const PILLAR_SPECS: Record<Pillar, PillarSpec> = {
  founder_journey: {
    weight: 30,
    brief: 'Building Magical Birthday Planner in public: decisions, mistakes, lessons, what is surprisingly hard, launch preparation. Only true events from the fact sheet; otherwise share an opinion or a lesson, not a story.',
    link: 'optional',
    image: 'optional',
    topics: [
      { key: 'why-i-started', angle: 'Why a parent started building a birthday planner at all' },
      { key: 'deleted-prototype', angle: 'Deleting most of the old prototype instead of patching it' },
      { key: 'year-pause', angle: 'The project sat untouched for almost a year — what brought it back' },
      { key: 'launch-on-birthday', angle: 'Launching on the same day my daughter turns 7' },
      { key: 'fake-claim-removed', angle: 'Finding an untrue "10,000+ parents" claim on my own old homepage and removing it' },
      { key: 'fewer-things', angle: 'Parents don’t need another app to manage — they need fewer things to manage' },
      { key: 'waitlist-retired', angle: 'Why I retired the waitlist before launch' },
      { key: 'hardest-part-building', angle: 'The part of building this that turned out harder than expected' },
      { key: 'what-im-cutting', angle: 'Deciding what NOT to build for launch' },
      { key: 'feedback-ask', angle: 'What kind of honest feedback I want from the first parents' },
    ],
  },
  parent_pain: {
    weight: 20,
    brief: 'Real planning problems, told with empathy: venues, comparing options, budgets, invitations, guest lists, RSVPs, themes, last-minute planning, information overload. Never blame parents, no fear.',
    link: 'optional',
    image: 'optional',
    topics: [
      { key: 'tab-overload', angle: 'Planning one party across too many tabs, threads and notes' },
      { key: 'venue-compare', angle: 'Comparing venues when every site lists different details' },
      { key: 'rsvp-silence', angle: 'Waiting on RSVPs that never come' },
      { key: 'headcount-guess', angle: 'Not knowing how many kids will actually show up' },
      { key: 'budget-creep', angle: 'How small extras quietly add up' },
      { key: 'theme-pressure', angle: 'Picking a theme the child will still love on the day' },
      { key: 'last-minute', angle: 'Realising the party is two weeks away and nothing is booked' },
      { key: 'group-chat-chaos', angle: 'Party details buried in a group chat' },
      { key: 'decision-fatigue', angle: 'Too many small decisions, not one big one' },
    ],
  },
  useful_tips: {
    weight: 15,
    brief: 'Genuinely useful birthday-planning advice that helps even if the reader never uses the product. Concrete, specific, practical. No product pitch unless natural.',
    link: 'optional',
    image: 'always',
    topics: [
      { key: 'before-invites', angle: 'What to lock down before sending invitations' },
      { key: 'before-venue', angle: 'What to decide before choosing a venue' },
      { key: 'estimate-headcount', angle: 'A simple way to estimate how many kids will really come' },
      { key: 'rsvp-deadline', angle: 'Setting an RSVP date that actually works' },
      { key: 'party-length', angle: 'How long a party should be for the child’s age' },
      { key: 'activity-buffer', angle: 'Planning one more activity than you think you need' },
      { key: 'allergy-ask', angle: 'Asking about allergies early, kindly' },
      { key: 'budget-split', angle: 'Splitting a party budget before shopping' },
      { key: 'timeline-backwards', angle: 'Planning backwards from the party date' },
      { key: 'home-party', angle: 'Making a home party feel special without overspending' },
      { key: 'first-15-minutes', angle: 'What to have ready for the first 15 minutes' },
      { key: 'pacing', angle: 'Pacing a party: active, calm, active' },
      { key: 'food-quantities', angle: 'Estimating party food without overbuying' },
      { key: 'cake-timing', angle: 'When to do the cake (before the energy dips)' },
      { key: 'party-bags', angle: 'Party bags: what actually gets used' },
      { key: 'siblings', angle: 'Planning for siblings who come along' },
      { key: 'weather-backup', angle: 'A simple rainy-day backup plan' },
      { key: 'thank-yous', angle: 'Thank-you notes that actually get sent' },
      { key: 'drop-off', angle: 'Drop-off or stay? Saying it on the invite' },
      { key: 'shy-kids', angle: 'Helping shy kids join in' },
    ],
  },
  product_education: {
    weight: 15,
    brief: 'Show ONE capability of Magical Birthday Planner and the problem it solves. Never list several features. Only capabilities from the product fact sheet.',
    link: 'optional',
    image: 'always',
    topics: [
      { key: 'venue-discovery', angle: 'Venue discovery near you, with reasons for each suggestion' },
      { key: 'party-setup', angle: 'Setting up a party one question at a time' },
      { key: 'theme-ideas', angle: 'Theme ideas based on what your child actually loves' },
      { key: 'guest-list', angle: 'One guest list instead of notes and screenshots' },
      { key: 'rsvp-tracking', angle: 'RSVPs that update the guest list by themselves' },
      { key: 'invitations', angle: 'Sharing an invitation link guests can answer without an account' },
      { key: 'checklist', angle: 'A checklist dated from your party date' },
      { key: 'age-fit-venues', angle: 'Venue suggestions that fit the child’s age' },
      { key: 'ai-checklist', angle: 'The AI check that suggests missed tasks' },
      { key: 'party-plan', angle: 'A whole party plan from a few details' },
    ],
  },
  ai_thinking: {
    weight: 10,
    brief: 'How AI can genuinely help parents plan (theme suggestions, decision support, personalised ideas) — practical and honest. Core belief: AI should save you time, not give you another chatbot to manage. No hype.',
    link: 'optional',
    image: 'optional',
    topics: [
      { key: 'not-a-chatbot', angle: 'Why the AI is not a chatbot' },
      { key: 'decide-first', angle: 'AI should help decide what kind of party makes sense before writing anything' },
      { key: 'nothing-auto', angle: 'Nothing the AI suggests changes your plan until you tap Add' },
      { key: 'privacy-by-default', angle: 'What the AI never sees (guest names, emails, exact location)' },
      { key: 'quantities', angle: 'Using AI for the boring maths: food and supplies for the real headcount' },
      { key: 'missing-tasks', angle: 'AI as a second pair of eyes: what am I forgetting?' },
      { key: 'personal-not-generic', angle: 'Personalised ideas from the child’s interests instead of generic lists' },
    ],
  },
  community_question: {
    weight: 10,
    brief: 'Ask parents ONE genuine, specific question about birthday planning. The goal is a real conversation, not engagement bait. Short. No link, no pitch.',
    link: 'never',
    image: 'never',
    topics: [
      { key: 'hardest-part', angle: 'The hardest part of planning your child’s birthday' },
      { key: 'venue-vs-guests', angle: 'Venue or guest list — which stresses you more' },
      { key: 'delegate-task', angle: 'The planning task you wish someone else would just do' },
      { key: 'home-or-venue', angle: 'Home party or venue party, and why' },
      { key: 'rsvp-habits', angle: 'How you chase RSVPs' },
      { key: 'best-party-memory', angle: 'The simplest party your kid loved most' },
      { key: 'planning-lead-time', angle: 'How far ahead you start planning' },
      { key: 'theme-winner', angle: 'Which party theme wins at your house' },
      { key: 'party-bags-q', angle: 'Party bags: yes or no' },
      { key: 'guest-count-rule', angle: 'How you decide how many kids to invite' },
      { key: 'venue-or-home-q', angle: 'Where your kids’ parties usually happen' },
      { key: 'budget-q', angle: 'How much planning time a party takes you' },
      { key: 'night-before', angle: 'What you always remember the night before' },
      { key: 'favourite-game', angle: 'The party game that never fails' },
      { key: 'cake-choice', angle: 'Homemade cake or bakery cake' },
      { key: 'theme-changes', angle: 'How many times your kid changed the theme' },
      { key: 'host-stress', angle: 'The moment during a party you stress most' },
      { key: 'invite-method', angle: 'How you send invitations now' },
    ],
  },
  launch_invitation: {
    weight: 0,
    brief: 'Invite parents to try Magical Birthday Planner and tell the founder what is wrong with it. Honest, low-pressure, one clear call to action. Used sparingly.',
    link: 'always',
    image: 'always',
    topics: [
      { key: 'launch-day', angle: 'It is live — try it for your next party and tell me what is wrong' },
      { key: 'feedback-invite', angle: 'Looking for a few parents planning a party soon to try it' },
      { key: 'tabs-invite', angle: 'For parents tired of planning a party across twenty tabs' },
      { key: 'one-place', angle: 'Venue ideas, guests, invitations and RSVPs in one place' },
      { key: 'honest-feedback', angle: 'Asking parents with a party coming up to try it' },
      { key: 'phone-browser', angle: 'It works in the phone browser — nothing to install' },
      { key: 'rsvp-cta', angle: 'Stop chasing RSVPs in the group chat' },
      { key: 'next-party', angle: 'For your next party, try planning it in one place' },
    ],
  },
}

/** The default weekly mix (sums to 100). */
export function defaultWeights(): Record<Pillar, number> {
  return Object.fromEntries(Object.entries(PILLAR_SPECS).map(([p, s]) => [p, s.weight])) as Record<Pillar, number>
}
