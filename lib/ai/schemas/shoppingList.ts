import { z } from 'zod'
import { list, shoppingCategory, str } from './shared'

export const ShoppingCategorizeSchema = z.object({ categories: list(z.object({ item: str(80), category: shoppingCategory }), 80) })
export type ShoppingCategorizeOutput = z.infer<typeof ShoppingCategorizeSchema>
export type ShoppingCategory = 'food' | 'decorations' | 'activities' | 'favors' | 'other'
export interface ShoppingListResult {
  items: { id: string; item: string; qty: string; category: ShoppingCategory; estimatedCost: number; sources: string[]; onList: boolean }[]
  groups: { category: ShoppingCategory; count: number }[]
  estimatedTotal: number
}
