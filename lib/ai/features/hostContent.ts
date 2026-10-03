/**
 * Party host content (host_content): welcome speech, activity introduction, cake announcement, closing speech,
 * reminders and thank-you messages. Copy only — nothing is ever sent. May use the child's first name (and, for
 * per-guest thank-yous, guests' first names) like the invitation writer.
 */
import 'server-only'
import { z } from 'zod'
import { BaseBody, type FeatureSpec } from '../handler'
import { HOST_KINDS, hostPrompt, type HostKind } from '../prompts/experience'
import { list, num, optStr, str } from '../schemas/shared'

const KINDS = Object.keys(HOST_KINDS) as [HostKind, ...HostKind[]]
export const HOST_TONES = ['warm', 'playful', 'short and sweet', 'excited'] as const
export const HostBody = BaseBody.extend({
  kind: z.enum(KINDS),
  activityId: z.string().uuid().optional(),
  tone: z.enum(HOST_TONES).default('warm'),
}).strict().refine((b) => b.kind !== 'activity_intro' || !!b.activityId, { message: 'activity_intro needs an activity' })

export const HostAISchema = z.object({
  title: optStr(120),
  body: optStr(1500),
  messages: list(z.object({ guest: num(1, 60), body: str(800) }), 40),
}).refine((h) => h.body.length >= 20 || h.messages.length > 0, { message: 'write the message in "body" (or one per guest in "messages")' })
type Out = z.infer<typeof HostAISchema>

export interface HostItem { id: string; kind: HostKind; title: string; body: string; activityId: string | null; guestId: string | null; guestName: string | null }
export interface HostResult { kind: HostKind; items: HostItem[] }
interface Extra { activity?: { id: string; name: string; description: string | null; host_script?: unknown }; guests?: { id: string; first: string }[] }

export const hostSpec: FeatureSpec<typeof HostBody, HostResult> = {
  feature: 'host_content',
  body: HostBody,
  result: HostAISchema as unknown as z.ZodType<HostResult>,
  maxTokens: 1400,
  includeInvitationFields: true,
  precheck: async (db, partyId, body) => {
    if (!body.activityId) return true
    const { data } = await db.from('party_ai_activities').select('id').eq('id', body.activityId).eq('party_id', partyId).maybeSingle()
    return !!data
  },
  load: async (db, partyId, _ctx, body): Promise<Extra> => {
    const extra: Extra = {}
    if (body.activityId) {
      const { data } = await db.from('party_ai_activities').select('id, name, description, details').eq('id', body.activityId).eq('party_id', partyId).maybeSingle()
      if (data) extra.activity = { id: data.id, name: data.name, description: data.description, host_script: (data.details as { host_script?: string } | null)?.host_script }
    }
    if (body.kind === 'thank_you_guest') {
      // Guests who came (confirmed); first names only, never contact details.
      const { data } = await db.from('guests').select('id, name').eq('party_id', partyId).eq('rsvp_status', 'CONFIRMED').order('name').limit(30)
      extra.guests = (data ?? []).map((g) => ({ id: g.id, first: g.name.trim().split(/\s+/)[0].slice(0, 30) }))
    }
    return extra
  },
  prompt: ({ body, ctx, notes, extra }) => {
    const e = extra as Extra
    return hostPrompt(ctx, body.kind, body.tone, { activity: e.activity ? { name: e.activity.name, description: e.activity.description, script_idea: e.activity.host_script } : undefined, guests: e.guests?.map((g) => g.first) }, notes)
  },
  post: ({ result, body, extra }) => {
    const r = result as unknown as Out
    const e = extra as Extra
    const title = r.title || null
    if (body.kind === 'thank_you_guest' && e.guests?.length) {
      const seen = new Set<number>()
      const items = r.messages
        .filter((m) => Number.isInteger(m.guest) && m.guest >= 1 && m.guest <= e.guests!.length && !seen.has(m.guest) && seen.add(m.guest))
        .map((m, i) => { const g = e.guests![m.guest - 1]; return { id: `host-${i + 1}`, kind: body.kind, title: `Thank you, ${g.first}`, body: m.body, activityId: null, guestId: g.id, guestName: g.first } })
      return { kind: body.kind, items }
    }
    const text = r.body || r.messages.map((m) => m.body).join('\n\n')
    return { kind: body.kind, items: [{ id: 'host-1', kind: body.kind, title: title ?? '', body: text.slice(0, 1500), activityId: e.activity?.id ?? null, guestId: null, guestName: null }] }
  },
  summary: (body) => ({ kind: body.kind, tone: body.tone, activity: !!body.activityId }),
}
