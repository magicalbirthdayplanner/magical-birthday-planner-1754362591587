/** P1-D Food planner (Pro). The allergy disclaimer is added by the server, always. */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { foodPrompt } from '../prompts/food'
import { sanitizeFreeText } from '../safety'
import { ALLERGY_NOTE, FoodAISchema, type FoodModelOutput, type FoodResult } from '../schemas/food'

export const FoodBody = BaseBody.extend({ preferences: z.string().max(500).optional() }).strict()
/** Never let model text claim medical/allergen safety. */
const SAFETY_CLAIM = /\b(allergen[- ]free|nut[- ]free|gluten[- ]free|safe for (all|everyone|allergies|kids with allergies)|allergy[- ]safe)\b/gi
const unclaim = (s: string) => s.replace(SAFETY_CLAIM, 'check-with-families')

export function postProcessFood(out: FoodModelOutput): FoodResult {
  const shoppingList = out.shoppingList.map((s, i) => ({ ...s, item: unclaim(s.item), category: s.category, estimatedCost: Math.round(s.estimatedCost * 100) / 100, id: itemId('food', i) }))
  const menu = Object.fromEntries(Object.entries(out.menu).map(([k, v]) => [k, v.map((d) => ({ ...d, name: unclaim(d.name) }))])) as FoodModelOutput['menu']
  return {
    menu,
    shoppingList,
    estimatedTotal: Math.round(shoppingList.reduce((s, x) => s + x.estimatedCost, 0) * 100) / 100,
    prepTimeline: out.prepTimeline.map((p) => ({ ...p, task: unclaim(p.task) })),
    tips: out.tips.map(unclaim),
    allergyNote: ALLERGY_NOTE,
  }
}

export const foodSpec: FeatureSpec<typeof FoodBody, FoodResult> = {
  feature: 'food',
  body: FoodBody,
  result: FoodAISchema as unknown as z.ZodType<FoodResult>,
  maxTokens: 2000,
  prompt: ({ body, ctx, notes }) => foodPrompt(ctx, notes, sanitizeFreeText(body.preferences, 200)),
  post: ({ result }) => postProcessFood(result as unknown as FoodModelOutput),
  summary: (body, ctx) => ({ guests: ctx.guestCountEstimate, hasPreferences: !!body.preferences }),
}
