import { z } from 'zod'
import { list, str } from './shared'

export const INVITE_TONES = ['playful', 'elegant', 'funny', 'simple', 'adventurous'] as const
export const InvitationAISchema = z.object({ options: list(z.object({ headline: str(120), message: str(600) }), 3, 1) })
export type InvitationModelOutput = z.infer<typeof InvitationAISchema>
export interface InvitationResult { tone: (typeof INVITE_TONES)[number]; options: { id: string; headline: string; message: string }[] }
