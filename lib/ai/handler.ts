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
import { finalizeGeneration, globalCountToday, reserveGeneration, usedForParty, limitExceeded } from './usage'
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

/** Largest AI request body we accept (free text is capped at 1,500 chars; this leaves room for JSON + fields). */
export const MAX_BODY_BYTES = 16 * 1024

/** Parse a JSON body without ever buffering more than `max` bytes. Returns undefined when too large or invalid. */
export async function readJsonBody(req: Request, max = MAX_BODY_BYTES): Promise<unknown | undefined> {
  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > max) return undefined
  if (!req.body) return undefined
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => undefined)
      return undefined
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
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
  /** Longer answers (several sections) may need more than the default timeout; capped below the 60 s route limit. */
  timeoutMs?: number
  /** Extra ownership checks on ids in the body (e.g. an activity of this party). false → not_found, nothing counted. */
  precheck?: (db: AuthedRequest['supabase'], partyId: string, body: z.infer<B>) => Promise<boolean>
}

export function createAIRoute<B extends z.ZodTypeAny, R>(spec: FeatureSpec<B, R>) {
  return async function POST(req: Request) {
    // 1. authentication
    const auth = await getAuthedRequest(req)
    if (!auth) return aiError('unauthenticated')
    // 2. input
    const parsed = spec.body.safeParse(await readJsonBody(req))
    if (!parsed.success) return aiError('invalid_input')
    const body: z.infer<B> = parsed.data
    const partyId = (body as { partyId: string }).partyId
    // 3. party ownership (RLS: someone else's party looks missing)
    const { data: party } = await auth.supabase.from('parties').select('id').eq('id', partyId).maybeSingle()
    if (!party) return aiError('not_found')
    // 4. flag (fail closed without the service role: usage can't be finalized safely without it)
    const cfg = aiConfig()
    if (!featureEnabled(spec.feature, cfg) || !hasServiceRole()) return aiError('ai_disabled')
    if (spec.precheck && !(await spec.precheck(auth.supabase, partyId, body))) return aiError('not_found')
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
    const over = await limitExceeded(auth.supabase, genId, {
      partyId, userId: auth.user.id,
      partyCap: ent.superAdmin ? null : PARTY_CAP[ent.tier],
      hourlyCap: ent.superAdmin ? null : USER_HOURLY_CAP,
      dailyCap: ent.superAdmin ? null : cfg.userDailyLimit,
    })
    if (over) {
      await finalizeGeneration(auth.user.id, genId, { status: 'rejected', errorCode: `limit_${over}` })
      if (over !== 'party') return aiError('limit_reached', { upgradeTo: null }, over === 'hourly' ? 'You’ve asked for lots of ideas in the last hour. Please try again a little later.' : 'You’ve reached today’s limit for AI suggestions. Please try again tomorrow.')
      return aiError('limit_reached', { upgradeTo: ent.tier === 'PRO' ? null : ent.tier === 'PLUS' ? 'PRO' : ent.tier === 'STARTER' ? 'PLUS' : 'STARTER' })
    }
    // 7. model (client abort propagates via req.signal)
    const extra = spec.load ? await spec.load(auth.supabase, partyId, ctx, body) : undefined
    const { system, user } = spec.prompt({ body, ctx, notes, extra })
    const callCfg = spec.timeoutMs ? { ...cfg, timeoutMs: Math.min(55_000, Math.max(cfg.timeoutMs, spec.timeoutMs)) } : cfg
    const r = await callStructured({ feature: spec.feature, schema: spec.result, system, user, sessionId: genId, signal: req.signal, maxTokens: spec.maxTokens, cfg: callCfg })
    const log = { feature: spec.feature, user_id: auth.user.id, party_id: partyId, provider: r.provider, model: r.model, duration_ms: r.durationMs, attempts: r.attempts }
    if (!r.ok) {
      await finalizeGeneration(auth.user.id, genId, { status: 'failed', provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, durationMs: r.durationMs, errorCode: r.code })
      logMetric('ai_generation', { ...log, status: 'failed', error_code: r.code, input_tokens: r.inputTokens ?? null, output_tokens: r.outputTokens ?? null })
      return aiError(r.code)
    }
    // 8. server post-processing (never trust model arithmetic/dates)
    let result: R
    try {
      result = spec.post ? spec.post({ result: r.data, body, ctx, scrubbed: r.scrubbed, extra }) : r.data
    } catch {
      await finalizeGeneration(auth.user.id, genId, { status: 'failed', provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, durationMs: r.durationMs, errorCode: 'invalid_response' })
      logMetric('ai_generation', { ...log, status: 'failed', error_code: 'post_processing' })
      return aiError('invalid_response')
    }
    await finalizeGeneration(auth.user.id, genId, { status: 'success', provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, durationMs: r.durationMs, result })
    logMetric('ai_generation', { ...log, status: 'success', input_tokens: r.inputTokens, output_tokens: r.outputTokens })
    const used = await usedForParty(auth.supabase, partyId)
    const cap = capability(spec.feature, { enabled: true, tier: ent.tier, superAdmin: ent.superAdmin, used })
    return NextResponse.json({ generationId: genId, result, remaining: cap.remaining }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

/** Stable, server-generated item ids. */
export const itemId = (prefix: string, i: number) => `${prefix}-${i + 1}`
export const newSessionId = () => randomUUID()
