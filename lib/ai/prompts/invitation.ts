import type { PartyAIContext } from '../context'
import { wrapParentNotes } from '../safety'
import { SYSTEM_PROMPT } from './system'

export function invitationPrompt(ctx: PartyAIContext, tone: string, notes: string) {
  const inv = ctx.invitation
  const facts = { firstName: inv?.childFirstName || 'the birthday child', turning: ctx.childAge, theme: ctx.theme, date: ctx.partyDate, startTime: inv?.startTime, endTime: inv?.endTime, venue: inv?.venueName, venueAddress: inv?.venueAddress }
  return {
    system: SYSTEM_PROMPT,
    user: `Write 3 short invitation options in a ${tone} tone for a child's birthday party. This feature may use the child's first name. Each option: a headline (max 10 words) and a message (2-4 sentences, warm, no emojis overload, ask families to RSVP using the link, mention anything parents need to know). Do not invent details that are not in the facts; leave out what is unknown. No URLs, no phone numbers.
Return JSON exactly: {"options":[{"headline":"","message":""}]}
Facts: ${JSON.stringify(facts)}
${notes ? wrapParentNotes(notes) : '<parent_notes></parent_notes>'}`,
  }
}
