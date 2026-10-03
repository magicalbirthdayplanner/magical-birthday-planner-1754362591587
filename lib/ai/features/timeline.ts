/** P2-B Day-of timeline (Starter+). Quick adjusters are an enum, not free text. */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import type { PartyAIContext } from '../context'
import { timelinePrompt } from '../prompts/timeline'
import { dueDateFor } from '../schedule'
import { TIMELINE_ADJUST, TimelineAISchema, type TimelineModelOutput, type TimelineResult } from '../schemas/timeline'
import { clock } from './partyPlanner'
import { offsetsToDurations, type TimelineKind } from '@/lib/experience/model'

export const TimelineBody = BaseBody.extend({ adjust: z.enum(TIMELINE_ADJUST).optional() }).strict()

export function postProcessTimeline(out: TimelineModelOutput, ctx: PartyAIContext, today = new Date()): TimelineResult {
  const seen = new Set<number>()
  const entries = [...out.entries]
    .map((e) => ({ ...e, minute: Math.round(e.minute) }))
    .filter((e) => e.minute >= 0 && e.minute <= ctx.durationMinutes && !seen.has(e.minute) && seen.add(e.minute))
    .sort((a, b) => a.minute - b.minute)
  const timed = offsetsToDurations(entries, ctx.durationMinutes).map((e, i) => ({ id: itemId('time', i), minute: e.minute, time: clock(e.minute), label: e.label, notes: e.notes, duration: e.duration, kind: guessKind(e.label) }))
  const prepTasks = out.prepTasks.map((p, i) => ({ id: itemId('prep', i), title: p.title, notes: p.notes, daysBeforeParty: Math.round(p.daysBeforeParty), ...dueDateFor(ctx.partyDate, p.daysBeforeParty, today) }))
  return { durationMinutes: ctx.durationMinutes, entries: timed, prepTasks, assumptions: out.assumptions }
}

/** Timeline row kind from a schedule label (the apply step links activity rows to the party's activities by name). */
export function guessKind(label: string): TimelineKind {
  const l = label.toLowerCase()
  if (/arriv|welcome table|check.?in/.test(l)) return 'arrival'
  if (/welcome|introduc|gather/.test(l)) return 'welcome'
  if (/cake|candle|happy birthday/.test(l)) return 'cake'
  if (/pizza|food|lunch|snack|eat|meal|dinner/.test(l)) return 'food'
  if (/gift|present/.test(l)) return 'gifts'
  if (/goodbye|farewell|closing|wrap|thank|pick.?up|depart/.test(l)) return 'closing'
  return 'activity'
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
