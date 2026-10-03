import { contextForPrompt, type PartyAIContext } from '../context'
import { wrapParentNotes } from '../safety'
import { SYSTEM_PROMPT } from './system'

const SHAPE = `{"themes":[{"name":"","emoji":"🎨","description":"1 sentence: what the party looks and feels like","why":"1 sentence: why it fits THIS child","palette":["#RRGGBB"],"decorations":[""],"activities":[""],"food":[""],"invitationIdea":"1 sentence invitation concept","ageFit":"why it suits this age"}],"assumptions":[""]}`

export function themeIdeasPrompt(ctx: PartyAIContext, notes: string) {
  return {
    system: SYSTEM_PROMPT,
    user: `Suggest exactly 5 party themes for this child. Blend their interests into original "hybrid" themes (e.g. art + animals → "Wild Art Safari"). Generic names only — no characters, franchises, brands or artists. Each: 3-5 hex palette colours, 3-5 decoration ideas, 3-5 activity ideas and 2-4 themed food ideas that work for the age, setting, guest count and budget, plus a one-line invitation concept.
The parent's notes describe what the child loves and what the parent does or does not want (e.g. "loves unicorns but not a typical pink unicorn party", "dinosaurs and space"). Follow those wishes closely — they matter more than the stored interests — and make the 5 themes clearly different from each other. Keep every list item short (at most 10 words).
Return JSON exactly in this shape: ${SHAPE}
Party facts: ${contextForPrompt(ctx)}
${notes ? wrapParentNotes(notes) : '<parent_notes></parent_notes>'}`,
  }
}
