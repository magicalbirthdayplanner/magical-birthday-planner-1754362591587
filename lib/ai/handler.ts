/**
 * One factory for every AI route: auth → input → party ownership → flag → plan → limits → context → model →
 * server post-processing → finalize. Thin route files call createAIRoute({...}).
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest, type AuthedRequest } from '@/lib/server/auth'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { getUserPlan } from '@/lib/billing/server'
import { logMetric } from '@/lib/analytics/server'
import { aiConfig, featureEnabled } from './config'
import { capability, PARTY_CAP, planAllows, tierFor, USER_HOURLY_CAP, type Tier } from './capabilities'
import { callStructured } from './client'
import { buildPartyAIContext, type PartyAIContext } from './context'
import { aiError } from './errors'
import { sanitizeFreeText } from './safety'
import { finalizeGeneration, globalCountToday, reserveGeneration, usedForParty, withinLimits } from './usage'
import type { AIFeature } from './types'

export interface Entitlement { tier: Tier; plan: string; superAdmin: boolean }

/** Plan via the existing trusted resolver (read/recompute only); Super Admin via the user's own RLS session. */
export async function resolveEntitlement(auth: AuthedRequest): Promise<Entitlement> {
  const [plan, role] = await Promise.all([
    hasServiceRole() ? getUserPlan(getSupabaseAdmin(), auth.user.id).catch(() => null) : Promise.resolve(null),
    auth.supabase.from('user_roles').select('role').eq('user_id', auth.user.id).maybeSingle(),
  ])
  const p = plan ?? { plan: 'FREE', source: 'free' }
  return { tier: tierFor(p), plan: p.plan, superAdmin: role.data?.role === 'super_admin' }
}

export const BaseBody = z.object({
  partyId: z.string().uuid(),
  notes: z.string().max(4000).optional(), // sanitised + capped to 1,500 below
  regenerate: z.boolean().optional(),
})

export interface FeatureSpec<B extends z.ZodTypeAny, R> {
  feature: AIFeature
  /** Optional extra data for this feature, loaded with the user's RLS session (never the service role). */
  load?: (db: AuthedRequest['supabase'], partyId: string, ctx: PartyAIContext, body: z.infer<B>) => Promise<unknown>
  body: B
  result: z.ZodType<R>
  /** Prompt pieces from the validated body + the private context. */
  prompt: (args: { body: z.infer<B>; ctx: PartyAIContext; notes: string; extra: unknown }) => { system: string; user: string }
  /** Server-side post-processing: ids, recomputed totals, clamped dates. */
  post?: (args: { result: R; body: z.infer<B>; ctx: PartyAIContext; scrubbed: boolean; extra: unknown }) => R
  /** Structured, non-free-text summary stored with the generation (never the notes). */
  summary?: (body: z.infer<B>, ctx: PartyAIContext) => Record<string, unknown>
  includeInvitationFields?: boolean
  maxTokens?: number
}

export function createAIRoute<B extends z.ZodTypeAny, R>(spec: FeatureSpec<B, R>) {
  return async function POST(req: Request) {
    // 1. authentication
    const auth = await getAuthedRequest(req)
    if (!auth) return aiError('unauthenticated')
    // 2. input
    let body: z.infer<B>
    try {
      body = spec.body.parse(await req.json())
    } catch {
      return aiError('invalid_input')
    }
    const partyId = (body as { partyId: string }).partyId
    // 3. party ownership (RLS: someone else's party looks missing)
    const { data: party } = await auth.supabase.from('parties').select('id').eq('id', partyId).maybeSingle()
    if (!party) return aiError('not_found')
    // 4. flag
    const cfg = aiConfig()
    if (!featureEnabled(spec.feature, cfg)) return aiError('ai_disabled')
    // 5. entitlement
    const ent = await resolveEntitlement(auth)
    if (!planAllows(spec.feature, ent.tier, ent.superAdmin)) {
      return aiError('forbidden_plan', { upgradeTo: capability(spec.feature, { enabled: true, tier: ent.tier, superAdmin: false, used: 0 }).upgradeTo })
    }
    // 6. limits: global breaker, then reserve + rank (race-safe)
    if (cfg.globalDailyLimit > 0 && (await globalCountToday(auth.supabase)) >= cfg.globalDailyLimit) return aiError('high_demand')
    const notes = sanitizeFreeText((body as { notes?: string }).notes)
    const ctx = await buildPartyAIContext(auth.supabase, partyId, { plan: ent.tier, includeInvitationFields: spec.includeInvitationFields })
    if (!ctx) return aiError('not_found')
    const genId = await reserveGeneration(auth.supabase, partyId, spec.feature, { ...(spec.summary?.(body, ctx) ?? {}), hasNotes: notes.length > 0 })
    if (!genId) return aiError('provider_error')
    const ok = await withinLimits(auth.supabase, genId, { partyId, userId: auth.user.id, partyCap: ent.superAdmin ? null : PARTY_CAP[ent.tier], hourlyCap: ent.superAdmin ? null : USER_HOURLY_CAP })
    if (!ok) {
      await finalizeGeneration(auth.supabase, genId, { status: 'rejected', errorCode: 'limit_reached' })
      return aiError('limit_reached', { upgradeTo: ent.tier === 'PRO' ? null : ent.tier === 'PLUS' ? 'PRO' : ent.tier === 'STARTER' ? 'PLUS' : 'STARTER' })
    }
    // 7. model (client abort propagates via req.signal)
    const extra = spec.load ? await spec.load(auth.supabase, partyId, ctx, body) : undefined
    const { system, user } = spec.prompt({ body, ctx, notes, extra })
    const r = await callStructured({ feature: spec.feature, schema: spec.result, system, user, sessionId: genId, signal: req.signal, maxTokens: spec.maxTokens, cfg })
    const log = { feature: spec.feature, user_id: auth.user.id, party_id: partyId, provider: r.provider, model: r.model, duration_ms: r.durationMs, attempts: r.attempts }
    if (!r.ok) {
      await finalizeGeneration(auth.supabase, genId, { status: 'failed', provider: r.provider, model: r.model, durationMs: r.durationMs, errorCode: r.code })
      logMetric('ai_generation', { ...log, status: 'failed', error_code: r.code })
      return aiError(r.code)
    }
    // 8. server post-processing (never trust model arithmetic/dates)
    const result = spec.post ? spec.post({ result: r.data, body, ctx, scrubbed: r.scrubbed, extra }) : r.data
    await finalizeGeneration(auth.supabase, genId, { status: 'success', provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, durationMs: r.durationMs, result })
    logMetric('ai_generation', { ...log, status: 'success', input_tokens: r.inputTokens, output_tokens: r.outputTokens })
    const used = await usedForParty(auth.supabase, partyId)
    const cap = capability(spec.feature, { enabled: true, tier: ent.tier, superAdmin: ent.superAdmin, used })
    return NextResponse.json({ generationId: genId, result, remaining: cap.remaining }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

/** Stable, server-generated item ids. */
export const itemId = (prefix: string, i: number) => `${prefix}-${i + 1}`
export const newSessionId = () => randomUUID()
