import { z } from 'zod'
import { list, num, optStr, shoppingCategory, str, strList } from './shared'

export const FOOD_CATEGORIES = ['main', 'snack', 'dessert', 'cake', 'drink', 'other'] as const
const foodCategory = z.preprocess((v) => {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (/cake/.test(s)) return 'cake'
  if (/drink|juice|water|lemonade|beverage/.test(s)) return 'drink'
  if (/dessert|sweet|cupcake|cookie|treat/.test(s)) return 'dessert'
  if (/snack|side|fruit|veg|chip/.test(s)) return 'snack'
  if (/main|meal|pizza|entree|savory|savoury/.test(s)) return 'main'
  return 'other'
}, z.enum(FOOD_CATEGORIES))

/** One menu line with a practical quantity for the party's guests. */
export const FoodItemSchema = z.object({
  name: str(80),
  category: foodCategory,
  quantity: num(0, 10000, 1),
  unit: optStr(30),
  estimated_cost: num(0, 2000, 0),
  dietary_tags: strList(5, 30),
  notes: optStr(200),
})
export type FoodItem = z.infer<typeof FoodItemSchema>

export const FoodAISchema = z.object({
  items: list(FoodItemSchema, 14),
  shoppingList: list(z.object({ item: str(80), qty: optStr(30), category: shoppingCategory, estimatedCost: num(0, 1000, 0) }), 25),
  prepTimeline: list(z.object({ when: str(40), task: str(140) }), 8),
  tips: strList(4, 200),
}).refine((f) => f.items.length >= 3, { message: 'the menu needs at least 3 dishes or drinks' })
export type FoodModelOutput = z.infer<typeof FoodAISchema>
export const ALLERGY_NOTE = 'Please check allergies and dietary needs with each family. These are ideas, not a guarantee that any food is allergen-free or safe for a specific child.'
export interface FoodResult {
  /** Who the quantities were calculated for (server-computed from the party, not the model). */
  guests: number | null
  kids: number | null
  adults: number | null
  items: (FoodItem & { id: string })[]
  shoppingList: (FoodModelOutput['shoppingList'][number] & { id: string })[]
  estimatedTotal: number
  /** "Add to budget": one Food & drinks estimate line. */
  budget: { id: string; category: string; amount: number }[]
  prepTimeline: FoodModelOutput['prepTimeline']
  tips: string[]
  allergyNote: string
}
