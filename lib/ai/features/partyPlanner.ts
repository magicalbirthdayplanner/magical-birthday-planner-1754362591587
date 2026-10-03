/** P0-A AI Party Planner: body, server post-processing, route spec. */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import type { PartyAIContext } from '../context'
import { partyPlannerPrompt, type PlannerOverrides } from '../prompts/partyPlanner'
import { PartyPlanAIResultSchema, type PartyPlanModelOutput, type PartyPlanResult } from '../schemas/partyPlanner'

export const PlannerBody = BaseBody.extend({
  overrides: z
    .object({
      childAge: z.number().int().min(0).max(14).optional(),
      interests: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
      guestCount: z.number().int().min(1).max(200).optional(),
      budget: z.number().min(0).max(100000).optional(),
      city: z.string().trim().max(60).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      setting: z.enum(['indoor', 'outdoor', 'either']).optional(),
      food: z.string().trim().max(120).optional(),
      theme: z.string().trim().max(60).optional(),
    })
    .strict()
    .default({}),
}).strict()

const round2 = (n: number) => Math.round(n * 100) / 100
export const clock = (minute: number) => `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`

/** Never trust model arithmetic, ids or times. Pure; unit-tested. */
export function postProcessPlan(out: PartyPlanModelOutput, opts: { budget: number | null; durationMinutes: number; scrubbed: boolean }): PartyPlanResult {
  const lines = out.budget.lines.map((l, i) => ({ ...l, amount: round2(l.amount), id: itemId('bud', i) }))
  const total = round2(lines.reduce((s, l) => s + l.amount, 0))
  const assumptions = [...out.assumptions]
  const overBy = opts.budget != null && total > opts.budget ? round2(total - opts.budget) : null
  if (overBy != null) assumptions.push(`These estimates come to about $${total}, which is $${overBy} over your $${opts.budget} budget — trim the largest lines first.`)
  if (opts.scrubbed) assumptions.push('Some character or brand names were replaced with generic ideas.')
  const seen = new Set<number>()
  const timeline = [...out.timeline]
    .map((t) => ({ ...t, minute: Math.round(t.minute) }))
    .filter((t) => t.minute >= 0 && t.minute <= opts.durationMinutes && !seen.has(t.minute) && seen.add(t.minute))
    .sort((a, b) => a.minute - b.minute)
    .map((t, i) => ({ id: itemId('time', i), minute: t.minute, time: clock(t.minute), label: t.label }))
  return {
    ...out,
    activities: out.activities.map((a, i) => ({ ...a, id: itemId('act', i) })),
    shoppingList: out.shoppingList.map((s, i) => ({ ...s, estimatedCost: round2(s.estimatedCost), id: itemId('shop', i) })),
    timeline,
    budget: { lines, total, overBy },
    assumptions: assumptions.slice(0, 10),
  }
}

export const partyPlannerSpec: FeatureSpec<typeof PlannerBody, PartyPlanResult> = {
  feature: 'party_planner',
  body: PlannerBody,
  result: PartyPlanAIResultSchema as unknown as z.ZodType<PartyPlanResult>,
  maxTokens: 3000,
  prompt: ({ body, ctx, notes }) => partyPlannerPrompt(ctx, body.overrides as PlannerOverrides, notes),
  post: ({ result, body, ctx, scrubbed }) =>
    postProcessPlan(result as unknown as PartyPlanModelOutput, { budget: body.overrides.budget ?? ctx.budget, durationMinutes: ctx.durationMinutes, scrubbed }),
  summary: (body, ctx: PartyAIContext) => ({ childAge: body.overrides.childAge ?? ctx.childAge, guestCount: body.overrides.guestCount ?? ctx.guestCountEstimate, budget: body.overrides.budget ?? ctx.budget, daysUntilParty: ctx.daysUntilParty, overrides: Object.keys(body.overrides) }),
}
