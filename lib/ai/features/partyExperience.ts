/**
 * Create My Party Experience (party_experience): one structured answer with separate sections — theme, activities,
 * timeline, food, shopping, host lines, checklist, budget. Every section is applied separately by the parent;
 * nothing changes the party until they tap Add / Use.
 */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { partyExperiencePrompt } from '../prompts/experience'
import { list, num, optStr, pick, shoppingCategory, str, strList } from '../schemas/shared'
import { FoodItemSchema, type FoodItem } from '../schemas/food'
import { dueDateFor } from '../schedule'
import { ActivityDetailSchema, offsetsToDurations, TIMELINE_KINDS, type ActivityDetail, type TimelineKind } from '@/lib/experience/model'

export const ExperienceBody = BaseBody.strict()

export const ExperienceAISchema = z.object({
  summary: str(400),
  theme: z.object({ name: str(60), emoji: optStr(8), description: optStr(240), palette: list(z.string().regex(/^#[0-9a-fA-F]{6}$/), 5), decorations: strList(6, 100) }),
  activities: list(ActivityDetailSchema, 5, 1),
  timeline: list(z.object({ minute: num(0, 600), label: str(80), kind: pick(TIMELINE_KINDS, 'other') }), 14),
  food: list(FoodItemSchema, 10),
  shopping: list(z.object({ item: str(80), qty: optStr(30), category: shoppingCategory, estimatedCost: num(0, 1000, 0) }), 30),
  host: z.object({ welcome: optStr(600), cake: optStr(600), closing: optStr(600) }).default({ welcome: '', cake: '', closing: '' }),
  checklist: list(z.object({ title: str(120), daysBeforeParty: num(0, 120, 7) }), 10),
  budget: list(z.object({ category: str(40), amount: num(0, 10000) }), 10),
  assumptions: strList(6, 200),
})
type Out = z.infer<typeof ExperienceAISchema>

export type { ExperienceResult } from './partyExperience.types'
import type { ExperienceResult } from './partyExperience.types'

const r2 = (n: number) => Math.round(n * 100) / 100
const HOST_TITLES = { welcome: 'Welcome speech', cake: 'Cake announcement', closing: 'Closing speech' } as const

export function postProcessExperience(out: Out, opts: { budget: number | null; durationMinutes: number; partyDate: string | null; guests: number | null; scrubbed: boolean }, today = new Date()): ExperienceResult {
  const lines = out.budget.map((l, i) => ({ id: itemId('bud', i), category: l.category, amount: r2(l.amount) }))
  const total = r2(lines.reduce((s, l) => s + l.amount, 0))
  const overBy = opts.budget != null && total > opts.budget ? r2(total - opts.budget) : null
  const assumptions = [...out.assumptions]
  if (overBy != null) assumptions.push(`These estimates come to about $${total}, which is $${overBy} over your $${opts.budget} budget — trim the largest lines first.`)
  if (opts.scrubbed) assumptions.push('Some character or brand names were replaced with generic ideas.')
  const seen = new Set<number>()
  const entries = out.timeline.map((t) => ({ ...t, minute: Math.round(t.minute) })).filter((t) => t.minute <= opts.durationMinutes && !seen.has(t.minute) && seen.add(t.minute))
  const names = new Set<string>()
  const activities = out.activities.filter((a) => !names.has(a.name.toLowerCase()) && names.add(a.name.toLowerCase())).map((a, i) => ({ ...a, id: itemId('act', i) }))
  return {
    summary: out.summary,
    theme: { ...out.theme, id: 'theme', activities: activities.map((a) => a.name) },
    activities,
    timeline: offsetsToDurations(entries, opts.durationMinutes).map((t, i) => ({ id: itemId('time', i), minute: t.minute, duration: t.duration, label: t.label, kind: t.kind })),
    food: out.food.map((f, i) => ({ ...f, id: itemId('dish', i) })),
    shopping: out.shopping.map((s, i) => ({ ...s, estimatedCost: r2(s.estimatedCost), id: itemId('shop', i) })),
    host: (['welcome', 'cake', 'closing'] as const).filter((k) => out.host[k].length >= 10).map((k, i) => ({ id: itemId('host', i), kind: k, title: HOST_TITLES[k], body: out.host[k] })),
    checklist: out.checklist.map((c, i) => ({ id: itemId('chk', i), title: c.title, daysBeforeParty: Math.round(c.daysBeforeParty), ...dueDateFor(opts.partyDate, c.daysBeforeParty, today) })),
    budget: { lines, total, overBy },
    assumptions: assumptions.slice(0, 8),
    designedForGuests: opts.guests,
  }
}

export const experienceSpec: FeatureSpec<typeof ExperienceBody, ExperienceResult> = {
  feature: 'party_experience',
  body: ExperienceBody,
  result: ExperienceAISchema as unknown as z.ZodType<ExperienceResult>,
  maxTokens: 4000,
  timeoutMs: 55_000,
  prompt: ({ ctx, notes }) => partyExperiencePrompt(ctx, notes),
  post: ({ result, ctx, scrubbed }) => postProcessExperience(result as unknown as Out, { budget: ctx.budget, durationMinutes: ctx.durationMinutes, partyDate: ctx.partyDate, guests: ctx.guestCountEstimate, scrubbed }),
  summary: (_b, ctx) => ({ guests: ctx.guestCountEstimate, budget: ctx.budget, theme: ctx.theme }),
}
