import { contextForPrompt, type PartyAIContext } from '../context'
import { wrapParentNotes } from '../safety'
import { SYSTEM_PROMPT } from './system'

const SHAPE = `{"themes":[{"name":"","emoji":"🎨","why":"1 sentence","palette":["#RRGGBB"],"decorations":[""],"activities":[""],"ageFit":"why it suits this age"}],"assumptions":[""]}`

export function themeIdeasPrompt(ctx: PartyAIContext, notes: string) {
  return {
    system: SYSTEM_PROMPT,
    user: `Suggest exactly 5 party themes for this child. Blend their interests into original "hybrid" themes (e.g. art + animals → "Wild Art Safari"). Generic names only — no characters, franchises, brands or artists. Each: 3-5 hex palette colours, 3-5 decoration ideas, 3-5 activity ideas that work for the age, setting, guest count and budget.
Return JSON exactly in this shape: ${SHAPE}
Party facts: ${contextForPrompt(ctx)}
${notes ? wrapParentNotes(notes) : '<parent_notes></parent_notes>'}`,
  }
}
