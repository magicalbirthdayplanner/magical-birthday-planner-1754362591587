/** P2-A Invitation writer (Starter+): copy only — fills the editor as a draft; never sends anything. */
import 'server-only'
import { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { invitationPrompt } from '../prompts/invitation'
import { INVITE_TONES, InvitationAISchema, type InvitationModelOutput, type InvitationResult } from '../schemas/invitation'

export const InvitationBody = BaseBody.extend({ tone: z.enum(INVITE_TONES).default('playful') }).strict()

export const invitationSpec: FeatureSpec<typeof InvitationBody, InvitationResult> = {
  feature: 'invitation',
  body: InvitationBody,
  result: InvitationAISchema as unknown as z.ZodType<InvitationResult>,
  maxTokens: 900,
  includeInvitationFields: true,
  prompt: ({ body, ctx, notes }) => invitationPrompt(ctx, body.tone, notes),
  post: ({ result, body }) => ({ tone: body.tone, options: (result as unknown as InvitationModelOutput).options.map((o, i) => ({ ...o, id: itemId('inv', i) })) }),
  summary: (body) => ({ tone: body.tone }),
}
