/**
 * Activity studio (activity_studio): create one fully described activity from the parent's words, or revise an
 * existing one ("Make it cheaper", "Ask"). The result is a suggestion: nothing changes until the parent applies it
 * (target `activities` = add a new activity, `activity_update` = replace that activity's content).
 */
import 'server-only'
import { z } from 'zod'
import { BaseBody, type FeatureSpec } from '../handler'
import { activityCreatePrompt, activityEditPrompt } from '../prompts/experience'
import { ACTIVITY_EDIT_KEYS, ACTIVITY_EDITS, ActivityDetailSchema, type ActivityEdit } from '@/lib/experience/model'
import { optStr } from '../schemas/shared'

export const ActivityStudioBody = BaseBody.extend({
  mode: z.enum(['create', 'edit']).default('create'),
  activityId: z.string().uuid().optional(),
  edit: z.enum(ACTIVITY_EDIT_KEYS as [ActivityEdit, ...ActivityEdit[]]).optional(),
}).strict().refine((b) => b.mode === 'create' || (!!b.activityId && (!!b.edit || !!b.notes?.trim())), { message: 'edit needs an activity and a change' })

export const ActivityStudioAISchema = z.object({ activity: ActivityDetailSchema, what_changed: optStr(200) })
type Out = z.infer<typeof ActivityStudioAISchema>

export type { ActivityStudioResult } from './activityStudio.types'
import type { ActivityStudioResult } from './activityStudio.types'

/** The activity as the model sees it when editing (no ids, no provenance). */
async function loadActivity(db: Parameters<NonNullable<FeatureSpec<typeof ActivityStudioBody, ActivityStudioResult>['load']>>[0], partyId: string, id: string) {
  const { data } = await db.from('party_ai_activities').select('name, description, category, age_min, age_max, duration_min, setting, estimated_cost, difficulty, cleanup_level, materials, details').eq('id', id).eq('party_id', partyId).maybeSingle()
  if (!data) return null
  const d = (data.details ?? {}) as Record<string, unknown>
  return { name: data.name, description: data.description, category: data.category, age_min: data.age_min, age_max: data.age_max, duration_minutes: data.duration_min, indoor_outdoor: data.setting, estimated_cost: data.estimated_cost != null ? Number(data.estimated_cost) : null, difficulty: data.difficulty, cleanup_level: data.cleanup_level, materials: data.materials, preparation_steps: d.preparation_steps, instructions: d.instructions, host_script: d.host_script, safety_notes: d.safety_notes, variations: d.variations, backup_version: d.backup_version }
}

export const activityStudioSpec: FeatureSpec<typeof ActivityStudioBody, ActivityStudioResult> = {
  feature: 'activity_studio',
  body: ActivityStudioBody,
  result: ActivityStudioAISchema as unknown as z.ZodType<ActivityStudioResult>,
  maxTokens: 1800,
  precheck: async (db, partyId, body) => {
    if (body.mode !== 'edit') return true
    const { data } = await db.from('party_ai_activities').select('id').eq('id', body.activityId!).eq('party_id', partyId).maybeSingle()
    return !!data
  },
  load: (db, partyId, _ctx, body) => (body.mode === 'edit' ? loadActivity(db, partyId, body.activityId!) : Promise.resolve(null)),
  prompt: ({ body, ctx, notes, extra }) => {
    if (body.mode === 'edit') {
      const instruction = body.edit ? ACTIVITY_EDITS[body.edit as ActivityEdit] : 'Apply the parent\'s requested change.'
      return activityEditPrompt(ctx, extra, body.edit === 'theme' && ctx.theme ? `${instruction} The theme is now "${ctx.theme}".` : body.edit === 'guests' ? `${instruction} The party now has ${ctx.guestCountEstimate ?? 'an unknown number of'} guests.` : instruction, notes)
    }
    return activityCreatePrompt(ctx, notes)
  },
  post: ({ result, body, ctx }) => {
    const r = result as unknown as Out
    return {
      mode: body.mode,
      targetActivityId: body.mode === 'edit' ? body.activityId! : null,
      designedForGuests: ctx.guestCountEstimate,
      designedForTheme: ctx.theme,
      whatChanged: r.what_changed,
      activity: { ...r.activity, id: 'act-1' as const },
    }
  },
  summary: (body, ctx) => ({ mode: body.mode, edit: body.edit ?? null, guests: ctx.guestCountEstimate, theme: ctx.theme }),
}
