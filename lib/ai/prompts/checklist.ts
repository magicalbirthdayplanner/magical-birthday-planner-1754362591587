import { contextForPrompt, type PartyAIContext } from '../context'
import { wrapParentNotes } from '../safety'
import { SYSTEM_PROMPT } from './system'

export function checklistPrompt(ctx: PartyAIContext, notes: string) {
  const soon = ctx.daysUntilParty != null && ctx.daysUntilParty <= 14
  return {
    system: SYSTEM_PROMPT,
    user: `Build a short, practical to-do list for THIS party (max 12 tasks). Each task: title (imperative), notes (1 sentence), daysBeforeParty (integer: how many days before the party it should be done), priority (high|medium|low), effort (quick|medium|big).
Rules:
- The party is in ${ctx.daysUntilParty ?? 'an unknown number of'} days.${soon ? ' It is SOON: compress the plan; no task may need more lead time than remains. If something is normally booked further ahead (e.g. a custom cake needs 1-2 weeks), give a fast alternative instead (e.g. order a decorated bakery cake or decorate store-bought cupcakes) and say why in notes.' : ''}
- Do not repeat anything in existingChecklist.
- ${ctx.venue?.booked ? `A venue is already booked (${ctx.venue.type ?? 'venue'}): do NOT suggest booking or choosing a venue${/(studio|play|museum|art|class|trampoline|bowling)/i.test(`${ctx.venue.type} ${ctx.venue.name}`) ? ', and do NOT suggest booking entertainment or an activity — the venue provides it; instead add tasks tied to the venue (confirm headcount, what to bring, arrival time)' : ''}.` : 'No venue is booked yet.'}
- Tailor tasks to the theme${ctx.theme ? ` "${ctx.theme}"` : ''} and the guest count.
Return JSON exactly: {"tasks":[{"title":"","notes":"","daysBeforeParty":7,"priority":"high","effort":"quick"}],"assumptions":[""]}
Party facts: ${contextForPrompt(ctx)}
${notes ? wrapParentNotes(notes) : '<parent_notes></parent_notes>'}`,
  }
}
