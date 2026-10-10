/**
 * Evergreen content library: hand-written, fact-checked posts the engine can publish with ZERO AI cost (budget
 * fallback levels 1–3) or when a generated draft fails validation. Every item passes validation in the tests.
 * Facts used here are in facts.ts. No links (links are paid extras on X); no prices; no invented anecdotes.
 */
import type { CardSpec } from './images/templates'
import type { Pillar, PollSpec, PostFormat, SlotRole } from './types'

export interface LibraryItem {
  key: string
  role: SlotRole
  pillar: Pillar
  category: string
  format: PostFormat
  text: string
  hook?: string
  cta?: string | null
  poll?: PollSpec
  card?: Omit<CardSpec, 'seed'>
  thread?: string[]
}

const POLL_DAY = 1440

export const LIBRARY: LibraryItem[] = [
  // ---- founder stories -------------------------------------------------------------------------------------------
  { key: 'f-why', role: 'founder_story', pillar: 'founder_journey', category: 'founder_stories', format: 'text', text: 'I started building Magical Birthday Planner after one kids’ party turned into a pile of tabs, texts and notes.\n\nThe party was fun. The planning was not. That gap is the whole product.' },
  { key: 'f-deleted', role: 'founder_story', pillar: 'founder_journey', category: 'founder_stories', format: 'text', text: 'Hardest decision while rebuilding: deleting most of my first prototype instead of patching it.\n\nIt felt like throwing work away. It was actually throwing complexity away.' },
  { key: 'f-pause', role: 'founder_story', pillar: 'founder_journey', category: 'founder_stories', format: 'text', text: 'My birthday planner sat untouched for almost a year.\n\nWhat brought it back: realising the problem never went away. Every birthday, the same scramble.' },
  { key: 'f-fewer', role: 'founder_story', pillar: 'founder_journey', category: 'founder_stories', format: 'image', text: 'One thing I keep relearning while building this: parents don’t need another app to manage.\n\nThey need fewer things to manage.', card: { template: 'founder_quote', headline: 'Parents don’t need another app. They need fewer things to manage.' } },
  { key: 'f-claim', role: 'founder_story', pillar: 'founder_journey', category: 'founder_stories', format: 'text', text: 'A pre-launch audit found my old prototype homepage claiming “10,000+ parents”.\n\nIt wasn’t true, so it’s gone. Building in public means the boring honest version.' },
  { key: 'f-feedback', role: 'founder_story', pillar: 'founder_journey', category: 'founder_stories', format: 'text', text: 'The product is brand new and I’d rather hear what’s confusing now than later.\n\nIf you plan kids’ parties: what would make you trust a planning app with yours?' },
  { key: 'f-ai-nochat', role: 'founder_story', pillar: 'ai_thinking', category: 'ai_content', format: 'text', text: 'Early decision: the AI in Magical Birthday Planner is not a chatbot.\n\nIt fills in planning pieces inside your plan, and nothing changes until you tap Add.' },

  // ---- parent tips -----------------------------------------------------------------------------------------------
  { key: 't-before-invites', role: 'parent_tip', pillar: 'useful_tips', category: 'planning_tips', format: 'image', text: 'Before you send invitations, lock down three things: the date, the place and a realistic headcount.\n\nEverything else is easier to change later.', card: { template: 'tip', headline: 'Lock these before the invites go out', bullets: ['The date', 'The place', 'A realistic headcount'] } },
  { key: 't-rsvp-date', role: 'parent_tip', pillar: 'useful_tips', category: 'planning_tips', format: 'text', text: 'Set the RSVP date about a week before the party, then send one friendly reminder two days before it.\n\nOne nudge works better than five.' },
  { key: 't-length', role: 'parent_tip', pillar: 'useful_tips', category: 'planning_tips', format: 'text', text: 'Party length rule of thumb: younger kids, shorter party.\n\nNinety minutes is plenty for little ones; two hours works once there is food, cake and a couple of games.' },
  { key: 't-extra-activity', role: 'parent_tip', pillar: 'useful_tips', category: 'planning_tips', format: 'text', text: 'Plan one more activity than you think you need.\n\nIf the craft finishes early or the weather turns, you are not improvising in front of a room of kids.' },
  { key: 't-allergies', role: 'parent_tip', pillar: 'useful_tips', category: 'planning_tips', format: 'text', text: 'Ask about allergies on the invite, not the week of the party.\n\nIt is not awkward. It is part of hosting, and it makes the food plan simple.' },
  { key: 't-backwards', role: 'parent_tip', pillar: 'useful_tips', category: 'planning_tips', format: 'image', text: 'Easiest way to plan a kids’ party: start at the party date and work backwards.\n\nFour weeks out you decide, three weeks out you invite, two weeks out you order, one week out you confirm.', card: { template: 'checklist', headline: 'Plan backwards from the party date', bullets: ['4 weeks: decide', '3 weeks: invite', '2 weeks: order', '1 week: confirm'] } },

  // ---- conversation ----------------------------------------------------------------------------------------------
  { key: 'c-hardest', role: 'conversation', pillar: 'community_question', category: 'questions', format: 'text', text: 'Question for parents: what is the one part of planning your kid’s birthday you wish someone else would just handle?' },
  { key: 'c-lead-time', role: 'conversation', pillar: 'community_question', category: 'questions', format: 'text', text: 'How far ahead do you start planning a birthday party? Honest answers only.' },
  { key: 'c-simplest', role: 'conversation', pillar: 'community_question', category: 'questions', format: 'text', text: 'What was the simplest birthday party your kid loved the most? I’m collecting the low-effort wins.' },
  { key: 'c-rsvp', role: 'conversation', pillar: 'community_question', category: 'questions', format: 'text', text: 'Parents: how do you chase RSVPs without feeling like a debt collector?' },
  { key: 'c-theme-change', role: 'conversation', pillar: 'community_question', category: 'questions', format: 'text', text: 'How many times has your kid changed their party theme this year? Asking for a planner who keeps a backup theme ready.' },
  { key: 'c-forget', role: 'conversation', pillar: 'community_question', category: 'questions', format: 'text', text: 'What is the thing you always remember the night before the party? Candles? Lighter? Bin bags?' },

  // ---- visuals ---------------------------------------------------------------------------------------------------
  { key: 'v-tabs', role: 'visual', pillar: 'parent_pain', category: 'visuals', format: 'image', text: 'Planning one kids’ party shouldn’t need a map, a spreadsheet, a group chat and a dozen tabs.\n\nThat feeling is why I’m building a calmer way.', card: { template: 'pain_point', headline: 'One party. Way too many tabs.' } },
  { key: 'v-decisions', role: 'visual', pillar: 'parent_pain', category: 'visuals', format: 'image', text: 'Birthday planning is rarely one big decision. It is twenty small ones before breakfast.', card: { template: 'pain_point', headline: 'Twenty small decisions before breakfast' } },
  { key: 'v-cake', role: 'visual', pillar: 'parent_pain', category: 'visuals', format: 'image', text: 'They won’t remember the spreadsheet. They’ll remember the cake moment.\n\nPlan just enough to be there for it.', card: { template: 'inspiration', headline: 'They’ll remember the cake moment' } },
  { key: 'v-home-venue', role: 'visual', pillar: 'parent_pain', category: 'visuals', format: 'image', text: 'Home party or venue party? Both work. The right one depends on the guest count, the season and how much cleanup you want afterwards.', card: { template: 'this_or_that', headline: 'Home party or venue party?', left: 'Home', right: 'Venue' } },

  // ---- educational (carousels built from templates) --------------------------------------------------------------
  { key: 'e-venue-questions', role: 'educational', pillar: 'useful_tips', category: 'carousels', format: 'carousel', text: 'Before you book a party venue, ask these questions. They save a lot of surprises later.', card: { template: 'venue_compare', headline: 'Ask before you book a venue', bullets: ['Is it right for their age?', 'How many kids does it fit?', 'Can we bring our own cake?', 'What is the cancellation policy?'] } },
  { key: 'e-first-15', role: 'educational', pillar: 'useful_tips', category: 'carousels', format: 'carousel', text: 'The first 15 minutes of a kids’ party decide the mood. Have something ready for early arrivals.', card: { template: 'tip', headline: 'The first 15 minutes decide everything', bullets: ['A colouring station', 'Name badges to decorate', 'A bubble table', 'A simple scavenger hunt'] } },
  { key: 'e-food-ask', role: 'educational', pillar: 'useful_tips', category: 'carousels', format: 'carousel', text: 'Food for a kids’ party gets easier when you ask every family the same short question first.', card: { template: 'checklist', headline: 'Ask every family before planning food', bullets: ['Allergies', 'Dairy-free or gluten-free', 'Vegetarian', 'Anything they can’t eat'] } },
  { key: 'e-pacing', role: 'educational', pillar: 'useful_tips', category: 'carousels', format: 'carousel', text: 'Pacing a kids’ party: alternate active and calm, keep each activity short, and do cake before the energy dips.', card: { template: 'tip', headline: 'Three pacing rules for a kids’ party', bullets: ['Active, then calm, then active', 'Keep activities short', 'Cake before the energy dips'] } },

  // ---- product ---------------------------------------------------------------------------------------------------
  { key: 'p-rsvp', role: 'product', pillar: 'product_education', category: 'product_features', format: 'image', text: 'In Magical Birthday Planner, guests answer the invitation from a link — no account needed — and the guest list updates itself.\n\nGoing, maybe, can’t go: all in one place.', card: { template: 'product_feature', headline: 'RSVPs that update the guest list' } },
  { key: 'p-venues', role: 'product', pillar: 'product_education', category: 'venue_content', format: 'image', text: 'Venue discovery in Magical Birthday Planner explains why each place is suggested — distance, rating, fit for your kid’s age — instead of just listing results.', card: { template: 'product_feature', headline: 'Venue ideas, with the why' } },
  { key: 'p-checklist', role: 'product', pillar: 'product_education', category: 'product_features', format: 'image', text: 'The checklist in Magical Birthday Planner dates every task from your party date, and an AI check suggests what you might have missed.', card: { template: 'product_feature', headline: 'A checklist dated from your party' } },
  { key: 'p-age', role: 'product', pillar: 'product_education', category: 'venue_content', format: 'text', text: 'Small detail I care about: venue search in Magical Birthday Planner skips places that don’t fit your kid’s age.\n\nNo laser tag suggestions for a toddler party.' },
  { key: 'p-privacy', role: 'product', pillar: 'ai_thinking', category: 'ai_content', format: 'text', text: 'The AI in Magical Birthday Planner never sees guest names, emails, phone numbers or exact locations.\n\nIt plans from the party details, not from your contacts.' },

  // ---- polls -----------------------------------------------------------------------------------------------------
  { key: 'q-hardest', role: 'poll', pillar: 'community_question', category: 'polls', format: 'poll', text: 'What is the hardest part of planning a kid’s birthday?', poll: { options: ['Venue', 'Guest list', 'Budget', 'Invitations'], durationMinutes: POLL_DAY } },
  { key: 'q-start', role: 'poll', pillar: 'community_question', category: 'polls', format: 'poll', text: 'When do you start planning a birthday party?', poll: { options: ['1 month before', '2 months before', '3+ months before', 'Last minute'], durationMinutes: POLL_DAY } },
  { key: 'q-theme', role: 'poll', pillar: 'community_question', category: 'polls', format: 'poll', text: 'Which party theme wins at your house?', poll: { options: ['Superheroes', 'Princesses', 'Animals', 'Science'], durationMinutes: POLL_DAY } },
  { key: 'q-bags', role: 'poll', pillar: 'community_question', category: 'polls', format: 'poll', text: 'Party bags: yes or no?', poll: { options: ['Yes, classic', 'A craft to take home', 'A book instead', 'Just cake'], durationMinutes: POLL_DAY } },
  { key: 'q-place', role: 'poll', pillar: 'community_question', category: 'polls', format: 'poll', text: 'Where do your kids’ parties usually happen?', poll: { options: ['At home', 'A park', 'A venue', 'Depends on the year'], durationMinutes: POLL_DAY } },
  { key: 'q-guests', role: 'poll', pillar: 'community_question', category: 'polls', format: 'poll', text: 'How do you decide how many kids to invite?', poll: { options: ['Whole class', 'Age = guests', 'Close friends only', 'Whatever fits'], durationMinutes: POLL_DAY } },

  // ---- soft conversion (no links: the image/footer carries the name) --------------------------------------------
  { key: 's-one-place', role: 'soft_conversion', pillar: 'launch_invitation', category: 'ctas', format: 'image', text: 'Planning a birthday soon? I built Magical Birthday Planner to bring venue ideas, the guest list, invitations, RSVPs and the checklist into one place.\n\nIt’s live — try it for your next party.', cta: 'Try it for your next party.', card: { template: 'product_feature', headline: 'Plan the party in one place' } },
  { key: 's-feedback', role: 'soft_conversion', pillar: 'launch_invitation', category: 'ctas', format: 'text', text: 'Magical Birthday Planner is live. I’d love a few parents planning a party soon to try it and tell me what we’re getting wrong.', cta: 'Tell me what we’re getting wrong.' },
  { key: 's-search', role: 'soft_conversion', pillar: 'launch_invitation', category: 'ctas', format: 'text', text: 'If your kid’s birthday is coming up and the planning lives in five different apps, give Magical Birthday Planner a try.\n\nSearch the name — it works in your phone browser.', cta: 'Search the name.' },
]

export const libraryByRole = (role: SlotRole) => LIBRARY.filter((i) => i.role === role)
export const libraryKey = (key: string) => `lib:${key}`
