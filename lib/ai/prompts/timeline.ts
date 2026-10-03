import { contextForPrompt, type PartyAIContext } from '../context'
import { SYSTEM_PROMPT } from './system'

const ADJUST: Record<string, string> = {
  relaxed: 'Make it more relaxed: fewer transitions, longer free-play and food blocks.',
  more_games: 'Add more games: more short, active games between the other blocks.',
  less_prep: 'Reduce preparation: favour activities and food that need little or no setup.',
}

export function timelinePrompt(ctx: PartyAIContext, adjust: string | undefined) {
  return {
    system: SYSTEM_PROMPT,
    user: `Create a minute-by-minute schedule for the party day. "minute" = minutes after the party starts (0 = arrival), strictly increasing, last entry no later than durationMinutes (${ctx.durationMinutes}). Include arrival, activities${ctx.existingActivities.length ? ' (use existingActivities)' : ''}, food, cake and candles, and goodbyes, fitting ${ctx.guestCountEstimate ?? 'the'} guests${ctx.venue?.booked ? ` and the venue (${ctx.venue.type ?? 'venue'})` : ''}. Also list prep tasks for the days before (daysBeforeParty).${adjust ? ` ${ADJUST[adjust]}` : ''}
Return JSON exactly: {"entries":[{"minute":0,"label":"","notes":""}],"prepTasks":[{"title":"","daysBeforeParty":1,"notes":""}],"assumptions":[""]}
Party facts: ${contextForPrompt(ctx)}`,
  }
}
