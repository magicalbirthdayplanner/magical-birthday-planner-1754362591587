import { z } from 'zod'
import { list, num, optStr, str, strList } from './shared'

export const BudgetSuggestionSchema = z.object({ category: str(40), change: str(160), newAmount: num(0, 10000), reason: optStr(200) })
export const MissingExpenseSchema = z.object({ category: str(40), amount: num(0, 10000), note: optStr(160) })
export const BudgetAISchema = z.object({
  suggestions: list(BudgetSuggestionSchema, 8, 1),
  missingExpenses: list(MissingExpenseSchema, 5),
  tradeoffs: strList(4, 200),
  assumptions: strList(5, 200),
})
export type BudgetModelOutput = z.infer<typeof BudgetAISchema>
export interface BudgetResult {
  target: number | null
  currentTotal: number
  projectedTotal: number
  overBy: number | null
  suggestions: (z.infer<typeof BudgetSuggestionSchema> & { id: string; currentAmount: number; savings: number })[]
  missing: (z.infer<typeof MissingExpenseSchema> & { id: string; newAmount: number })[]
  tradeoffs: string[]
  assumptions: string[]
}
