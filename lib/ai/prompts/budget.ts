import { contextForPrompt, type PartyAIContext } from '../context'
import { wrapParentNotes } from '../safety'
import { SYSTEM_PROMPT } from './system'
import { formatMoney } from '@/lib/country/format'

export function budgetPrompt(ctx: PartyAIContext, notes: string) {
  const lines = ctx.currentBudgetLines.length ? 'currentBudgetLines lists what the parent has planned so far (amount = planned estimate; actual = what they already spent — never suggest changing money already spent).' : 'There are no budget lines yet: propose a sensible allocation by category (each as a suggestion with newAmount).'
  return {
    system: SYSTEM_PROMPT,
    user: `Help the parent stay under their budget${ctx.budget != null ? ` of ${formatMoney(ctx.budget, ctx.country)}` : ''}. ${lines}
Give concrete suggestions per category: what to change, the new amount, and why. List expected expenses they seem to be missing (e.g. favors, tableware). Mention trade-offs briefly. Amounts are estimates in ${ctx.currency}; do not compute totals — the app does.
Return JSON exactly: {"suggestions":[{"category":"","change":"","newAmount":0,"reason":""}],"missingExpenses":[{"category":"","amount":0,"note":""}],"tradeoffs":[""],"assumptions":[""]}
Party facts: ${contextForPrompt(ctx)}
${notes ? wrapParentNotes(notes) : '<parent_notes></parent_notes>'}`,
  }
}
