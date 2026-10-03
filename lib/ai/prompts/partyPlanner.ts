import type { PartyAIContext } from '../context'
import { contextForPrompt } from '../context'
import { wrapParentNotes } from '../safety'
import { SYSTEM_PROMPT } from './system'

export interface PlannerOverrides { childAge?: number; interests?: string[]; guestCount?: number; budget?: number; city?: string; date?: string; setting?: 'indoor' | 'outdoor' | 'either'; food?: string; theme?: string }

const SHAPE = `{"summary":"2 sentences","partyConcept":"1 sentence","theme":{"name":"","why":"","palette":["#hex"]},
"activities":[{"name":"","description":"","durationMin":20,"estimatedCost":15,"materials":[""],"difficulty":"easy"}],
"food":{"main":[""],"snacks":[""],"dessert":[""],"drinks":[""]},"decorations":[""],
"timeline":[{"minute":0,"label":"Guests arrive"}],
"shoppingList":[{"item":"","qty":"","category":"food|decorations|activities|favors|other","estimatedCost":0}],
"budget":{"lines":[{"category":"","amount":0}]},"backupPlan":"","assumptions":[""],"followUpQuestions":[""]}`

export function partyPlannerPrompt(ctx: PartyAIContext, overrides: PlannerOverrides, notes: string) {
  const user = `Create a practical birthday party plan.
Return JSON with exactly this shape (3 to 5 activities; timeline "minute" = minutes after the party starts, increasing, within durationMinutes; budget lines are estimates and must fit the budget when one is given):
${SHAPE}

Party facts (from the app): ${contextForPrompt(ctx)}
Parent's choices for this plan (override the facts when present): ${JSON.stringify(overrides)}
${notes ? wrapParentNotes(notes) : '<parent_notes></parent_notes>'}`
  return { system: SYSTEM_PROMPT, user }
}
