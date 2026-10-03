/** P1-A AI checklist: adapts to days left and to what already exists; additive to the rule-based checklist. */
import 'server-only'
import type { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import type { PartyAIContext } from '../context'
import { checklistPrompt } from '../prompts/checklist'
import { ChecklistAISchema, type ChecklistModelOutput, type ChecklistResult } from '../schemas/checklist'
import { ACTIVITY_VENUE, alreadyListed, BOOK_ACTIVITY, BOOK_VENUE, dueDateFor } from '../schedule'

export const ChecklistBody = BaseBody.strict()

export function postProcessChecklist(out: ChecklistModelOutput, ctx: PartyAIContext, scrubbed: boolean, today = new Date()): ChecklistResult {
  const venueProvidesActivity = !!ctx.venue?.booked && ACTIVITY_VENUE.test(`${ctx.venue.type ?? ''} ${ctx.venue.name}`)
  let skipped = 0
  const seen: { title: string }[] = []
  const tasks = out.tasks.filter((t) => {
    const drop =
      alreadyListed(t.title, ctx.existingChecklist) || alreadyListed(t.title, seen) ||
      (ctx.venue?.booked && BOOK_VENUE.test(t.title)) || (venueProvidesActivity && BOOK_ACTIVITY.test(t.title))
    if (drop) skipped++
    else seen.push(t)
    return !drop
  })
  const assumptions = [...out.assumptions]
  if (scrubbed) assumptions.push('Some character or brand names were replaced with generic ideas.')
  return {
    tasks: tasks
      .map((t) => ({ ...t, daysBeforeParty: Math.round(t.daysBeforeParty), ...dueDateFor(ctx.partyDate, t.daysBeforeParty, today) }))
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
      .map((t, i) => ({ ...t, id: itemId('chk', i) })),
    assumptions,
    skipped,
  }
}

export const checklistSpec: FeatureSpec<typeof ChecklistBody, ChecklistResult> = {
  feature: 'checklist',
  body: ChecklistBody,
  result: ChecklistAISchema as unknown as z.ZodType<ChecklistResult>,
  maxTokens: 1500,
  prompt: ({ ctx, notes }) => checklistPrompt(ctx, notes),
  post: ({ result, ctx, scrubbed }) => postProcessChecklist(result as unknown as ChecklistModelOutput, ctx, scrubbed),
  summary: (_b, ctx) => ({ daysUntilParty: ctx.daysUntilParty, existingTasks: ctx.existingChecklist.length, venueBooked: !!ctx.venue }),
}
