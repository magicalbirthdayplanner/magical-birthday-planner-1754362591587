import { z } from 'zod'
import { list, num, optStr, pick, shoppingCategory, str, strList } from './shared'

export const ActivitySchema = z.object({
  name: str(80),
  description: optStr(400),
  durationMin: num(5, 240, 30),
  estimatedCost: num(0, 2000, 0),
  materials: strList(10, 60),
  difficulty: pick(['easy', 'medium', 'hard'] as const, 'easy'),
})
export const ShoppingItemSchema = z.object({ item: str(80), qty: optStr(30), category: shoppingCategory, estimatedCost: num(0, 2000, 0) })
export const BudgetLineSchema = z.object({ category: str(40), amount: num(0, 10000) })
export const TimelineEntrySchema = z.object({ minute: num(0, 600), label: str(120) })

export const PartyPlanAIResultSchema = z.object({
  summary: str(400),
  partyConcept: optStr(300),
  theme: z.object({ name: str(60), why: optStr(240), palette: strList(6, 20) }),
  activities: list(ActivitySchema, 5, 1),
  food: z.object({ main: strList(8, 80), snacks: strList(8, 80), dessert: strList(6, 80), drinks: strList(6, 80) }).default({ main: [], snacks: [], dessert: [], drinks: [] }),
  decorations: strList(10, 100),
  timeline: list(TimelineEntrySchema, 14),
  shoppingList: list(ShoppingItemSchema, 30),
  budget: z.object({ lines: list(BudgetLineSchema, 12), total: num(0, 100000, 0).optional() }).default({ lines: [] }),
  backupPlan: optStr(300),
  assumptions: strList(8, 200),
  followUpQuestions: strList(4, 160),
})
export type PartyPlanModelOutput = z.infer<typeof PartyPlanAIResultSchema>

/** What the API returns/stores after server post-processing (ids, recomputed totals, formatted times). */
export interface PartyPlanResult extends Omit<PartyPlanModelOutput, 'activities' | 'shoppingList' | 'timeline' | 'budget'> {
  activities: (z.infer<typeof ActivitySchema> & { id: string })[]
  shoppingList: (z.infer<typeof ShoppingItemSchema> & { id: string })[]
  timeline: { id: string; minute: number; time: string; label: string }[]
  budget: { lines: (z.infer<typeof BudgetLineSchema> & { id: string })[]; total: number; overBy: number | null }
}
