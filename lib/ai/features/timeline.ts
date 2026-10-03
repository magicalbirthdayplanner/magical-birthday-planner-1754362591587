/** P2-B Day-of timeline (Starter+). Quick adjusters are an enum, not free text. */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import type { PartyAIContext } from '../context'
import { timelinePrompt } from '../prompts/timeline'
import { dueDateFor } from '../schedule'
import { TIMELINE_ADJUST, TimelineAISchema, type TimelineModelOutput, type TimelineResult } from '../schemas/timeline'
import { clock } from './partyPlanner'

export const TimelineBody = BaseBody.extend({ adjust: z.enum(TIMELINE_ADJUST).optional() }).strict()

export function postProcessTimeline(out: TimelineModelOutput, ctx: PartyAIContext, today = new Date()): TimelineResult {
  const seen = new Set<number>()
  const entries = [...out.entries]
    .map((e) => ({ ...e, minute: Math.round(e.minute) }))
    .filter((e) => e.minute >= 0 && e.minute <= ctx.durationMinutes && !seen.has(e.minute) && seen.add(e.minute))
    .sort((a, b) => a.minute - b.minute)
    .map((e, i) => ({ id: itemId('time', i), minute: e.minute, time: clock(e.minute), label: e.label, notes: e.notes }))
  const prepTasks = out.prepTasks.map((p, i) => ({ id: itemId('prep', i), title: p.title, notes: p.notes, daysBeforeParty: Math.round(p.daysBeforeParty), ...dueDateFor(ctx.partyDate, p.daysBeforeParty, today) }))
  return { durationMinutes: ctx.durationMinutes, entries, prepTasks, assumptions: out.assumptions }
}

export const timelineSpec: FeatureSpec<typeof TimelineBody, TimelineResult> = {
  feature: 'timeline',
  body: TimelineBody,
  result: TimelineAISchema as unknown as z.ZodType<TimelineResult>,
  maxTokens: 1500,
  prompt: ({ body, ctx }) => timelinePrompt(ctx, body.adjust),
  post: ({ result, ctx }) => postProcessTimeline(result as unknown as TimelineModelOutput, ctx),
  summary: (body, ctx) => ({ durationMinutes: ctx.durationMinutes, adjust: body.adjust ?? null }),
}
