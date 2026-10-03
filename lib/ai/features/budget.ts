/** P1-B Budget assistant: the model proposes; the server computes current/projected totals and savings. */
import 'server-only'
import type { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import type { PartyAIContext } from '../context'
import { budgetPrompt } from '../prompts/budget'
import { BudgetAISchema, type BudgetModelOutput, type BudgetResult } from '../schemas/budget'

export const BudgetBody = BaseBody.strict()
const r2 = (n: number) => Math.round(n * 100) / 100

export function postProcessBudget(out: BudgetModelOutput, ctx: PartyAIContext): BudgetResult {
  const current = new Map(ctx.currentBudgetLines.map((l) => [l.category.toLowerCase(), l.amount]))
  const currentTotal = r2(ctx.currentBudgetLines.reduce((s, l) => s + l.amount, 0))
  const seen = new Set<string>()
  const suggestions = out.suggestions
    .filter((s) => !seen.has(s.category.toLowerCase()) && seen.add(s.category.toLowerCase()))
    .map((s, i) => {
      const currentAmount = current.get(s.category.toLowerCase()) ?? 0
      return { ...s, newAmount: r2(s.newAmount), id: itemId('sug', i), currentAmount, savings: r2(currentAmount - s.newAmount) }
    })
  const missing = out.missingExpenses.filter((m) => !current.has(m.category.toLowerCase()) && !seen.has(m.category.toLowerCase())).map((m, i) => ({ ...m, amount: r2(m.amount), newAmount: r2(m.amount), id: itemId('miss', i) }))
  // projected = existing lines with suggestions applied + new suggested categories (missing expenses shown separately)
  const touched = new Map(suggestions.map((s) => [s.category.toLowerCase(), s.newAmount]))
  const projectedTotal = r2(
    ctx.currentBudgetLines.reduce((s, l) => s + (touched.get(l.category.toLowerCase()) ?? l.amount), 0) +
      suggestions.filter((s) => !current.has(s.category.toLowerCase())).reduce((s, x) => s + x.newAmount, 0),
  )
  const target = ctx.budget
  return { target, currentTotal, projectedTotal, overBy: target != null && projectedTotal > target ? r2(projectedTotal - target) : null, suggestions, missing, tradeoffs: out.tradeoffs, assumptions: out.assumptions }
}

export const budgetSpec: FeatureSpec<typeof BudgetBody, BudgetResult> = {
  feature: 'budget_optimizer',
  body: BudgetBody,
  result: BudgetAISchema as unknown as z.ZodType<BudgetResult>,
  maxTokens: 1500,
  prompt: ({ ctx, notes }) => budgetPrompt(ctx, notes),
  post: ({ result, ctx }) => postProcessBudget(result as unknown as BudgetModelOutput, ctx),
  summary: (_b, ctx) => ({ budget: ctx.budget, lines: ctx.currentBudgetLines.length }),
}
