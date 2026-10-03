import { z } from 'zod'
import { list, num, optStr, shoppingCategory, str, strList } from './shared'

const Dish = z.object({ name: str(80), qty: optStr(60) })
export const FoodAISchema = z.object({
  menu: z.object({ main: list(Dish, 6), snacks: list(Dish, 6), dessert: list(Dish, 4), drinks: list(Dish, 4) }),
  shoppingList: list(z.object({ item: str(80), qty: optStr(30), category: shoppingCategory, estimatedCost: num(0, 1000, 0) }), 25),
  prepTimeline: list(z.object({ when: str(40), task: str(140) }), 8),
  tips: strList(4, 200),
}).refine((f) => f.menu.main.length + f.menu.snacks.length + f.menu.dessert.length + f.menu.drinks.length >= 3, { message: 'the menu needs at least 3 dishes or drinks' })
export type FoodModelOutput = z.infer<typeof FoodAISchema>
export const ALLERGY_NOTE = 'Please check allergies and dietary needs with each family. These are ideas, not a guarantee that any food is allergen-free or safe for a specific child.'
export interface FoodResult {
  menu: FoodModelOutput['menu']
  shoppingList: (FoodModelOutput['shoppingList'][number] & { id: string })[]
  estimatedTotal: number
  prepTimeline: FoodModelOutput['prepTimeline']
  tips: string[]
  allergyNote: string
}
