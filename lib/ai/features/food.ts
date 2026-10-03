/** P1-D Food planner (Pro). The allergy disclaimer is added by the server, always. */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { foodHeadcount, foodPrompt } from '../prompts/food'
import { sanitizeFreeText } from '../safety'
import { ALLERGY_NOTE, FoodAISchema, type FoodModelOutput, type FoodResult } from '../schemas/food'

export const FoodBody = BaseBody.extend({ preferences: z.string().max(500).optional() }).strict()
/** Never let model text claim medical/allergen safety. */
const SAFETY_CLAIM = /\b(allergen[- ]free|nut[- ]free|gluten[- ]free|safe for (all|everyone|allergies|kids with allergies)|allergy[- ]safe)\b/gi
const unclaim = (s: string) => s.replace(SAFETY_CLAIM, 'check-with-families')
/** A dietary tag is a label, not a promise: "nut-free" → "nut-free option" (the allergy note always applies). */
const CLAIM_TAG = new RegExp(SAFETY_CLAIM.source, 'i')
const tag = (t: string) => (CLAIM_TAG.test(t) ? `${t.toLowerCase()} option`.slice(0, 40) : t)

/** Claims are stripped from every model string; quantities, totals and the headcount are server-side facts. */
export function postProcessFood(out: FoodModelOutput, headcount: { guests: number | null; kids: number | null; adults: number | null } = { guests: null, kids: null, adults: null }): FoodResult {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const items = out.items.map((d, i) => ({ ...d, name: unclaim(d.name), notes: unclaim(d.notes), dietary_tags: d.dietary_tags.map(tag), quantity: r2(d.quantity), estimated_cost: r2(d.estimated_cost), id: itemId('dish', i) }))
  const shoppingList = out.shoppingList.map((s, i) => ({ ...s, item: unclaim(s.item), category: s.category, estimatedCost: r2(s.estimatedCost), id: itemId('food', i) }))
  const menuTotal = r2(items.reduce((s, x) => s + x.estimated_cost, 0))
  const listTotal = r2(shoppingList.reduce((s, x) => s + x.estimatedCost, 0))
  const estimatedTotal = Math.max(menuTotal, listTotal)
  return {
    ...headcount,
    items,
    shoppingList,
    estimatedTotal,
    budget: estimatedTotal > 0 ? [{ id: 'fbud-1', category: 'Food & drinks', amount: estimatedTotal }] : [],
    prepTimeline: out.prepTimeline.map((p) => ({ ...p, task: unclaim(p.task) })),
    tips: out.tips.map(unclaim),
    allergyNote: ALLERGY_NOTE,
  }
}

export const foodSpec: FeatureSpec<typeof FoodBody, FoodResult> = {
  feature: 'food',
  body: FoodBody,
  result: FoodAISchema as unknown as z.ZodType<FoodResult>,
  maxTokens: 2600, // measured ~1,500 live; headroom so the menu is never cut off
  prompt: ({ body, ctx, notes }) => foodPrompt(ctx, notes, sanitizeFreeText(body.preferences, 200)),
  post: ({ result, ctx }) => postProcessFood(result as unknown as FoodModelOutput, foodHeadcount(ctx)),
  summary: (body, ctx) => ({ guests: ctx.guestCountEstimate, hasPreferences: !!body.preferences }),
}
