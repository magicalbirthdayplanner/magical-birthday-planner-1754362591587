/** The instructions one live Santa session runs with: the versioned prompt, Santa's exact first line, and the
 *  Nice List beat that follows it (the classic "have you been good?" → "let me check my list…"). */
import { buildSantaSystemPrompt, niceListLine, santaGreeting, type SantaCallKind, type SantaChildProfile } from './persona'

export function sessionInstructions(profile: SantaChildProfile, kind: SantaCallKind): string {
  return [
    buildSantaSystemPrompt(profile, kind),
    `Your very first words in this call must be: "${santaGreeting(profile)}"`,
    `Then, whatever they answer, your NEXT reply is the Nice List check: react warmly to what they said in a few words, then check your list out loud, slowly and playfully, in the spirit of: "${niceListLine(profile)}" — and finish with one easy question about something they love.`,
  ].join('\n\n')
}
