/** P1-C Activity generator (Plus+). */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { activitiesPrompt } from '../prompts/activities'
import { sanitizeFreeText } from '../safety'
import { ActivitiesAISchema, type ActivitiesModelOutput, type ActivitiesResult } from '../schemas/activities'

export const ActivitiesBody = BaseBody.extend({ materialsOnHand: z.string().max(1000).optional() }).strict()

export function postProcessActivities(out: ActivitiesModelOutput, existing: string[], scrubbed: boolean): ActivitiesResult {
  const have = new Set(existing.map((e) => e.toLowerCase()))
  const seen = new Set<string>()
  const activities = out.activities
    .filter((a) => !have.has(a.name.toLowerCase()) && !seen.has(a.name.toLowerCase()) && seen.add(a.name.toLowerCase()))
    .map((a, i) => ({ ...a, durationMin: Math.round(a.durationMin), estimatedCost: Math.round(a.estimatedCost * 100) / 100, id: itemId('act', i) }))
  return { activities, assumptions: scrubbed ? [...out.assumptions, 'Some character or brand names were replaced with generic ideas.'] : out.assumptions }
}

export const activitiesSpec: FeatureSpec<typeof ActivitiesBody, ActivitiesResult> = {
  feature: 'activities',
  body: ActivitiesBody,
  result: ActivitiesAISchema as unknown as z.ZodType<ActivitiesResult>,
  maxTokens: 2200,
  prompt: ({ body, ctx, notes }) => activitiesPrompt(ctx, notes, sanitizeFreeText(body.materialsOnHand, 300)),
  post: ({ result, ctx, scrubbed }) => postProcessActivities(result as unknown as ActivitiesModelOutput, ctx.existingActivities, scrubbed),
  summary: (body, ctx) => ({ childAge: ctx.childAge, setting: ctx.indoorOutdoor, hasMaterials: !!body.materialsOnHand }),
}
