/**
 * AI observability. Metadata only: feature, plan, provider, model, outcome, latency, attempts, token counts and an
 * ESTIMATED cost. Never prompts, notes, model output, party details or user identity (party → safeId hash).
 * Every function is fail-safe (see telemetry.ts) and none of them changes what the AI route does.
 */
import 'server-only'
import { distribution, reportError, safeId, timing, track, withSpan, type Dims } from './telemetry'

/** Per-feature latency metric names for the dashboards (the generic `ai.latency` has every feature too). */
const LATENCY_METRIC: Record<string, string> = {
  party_planner: 'PLAN_MY_PARTY_LATENCY',
  theme_ideas: 'THEME_IDEAS_LATENCY',
  checklist: 'AI_CHECKLIST_LATENCY',
}

/**
 * USD per 1M tokens [input, output]. DeepSeek V4 Pro via OpenCode Go, measured 2026-10-03 (docs/ai/AI_PRODUCTION_READINESS_REPORT.md):
 * off-peak $0.66 / $1.98, peak (Mon–Fri 01–04 and 06–10 UTC) $1.32 / $3.96. Unknown models → no estimate.
 */
const PRICES: Record<string, { offPeak: [number, number]; peak: [number, number] }> = {
  'deepseek-v4-pro': { offPeak: [0.66, 1.98], peak: [1.32, 3.96] },
}
const isPeak = (d: Date) => {
  const day = d.getUTCDay(), h = d.getUTCHours()
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
}

/** Estimated cost in USD, or null when the model's price or the token counts are unknown (never invented). */
export function estimateCostUsd(model: string, inputTokens: number | null | undefined, outputTokens: number | null | undefined, at = new Date()): number | null {
  const p = PRICES[model]
  if (!p || !inputTokens || outputTokens == null) return null
  const [i, o] = isPeak(at) ? p.peak : p.offPeak
  return Math.round(((inputTokens * i + outputTokens * o) / 1e6) * 1e6) / 1e6
}

export interface AIRequestMeta {
  feature: string
  /** FREE | STARTER | PLUS | PRO (the AI tier). */
  plan: string
  superAdmin?: boolean
  provider: string
  model: string
  /** The generation id (ai_generations.id) — trace/log context only, never a metric dimension. */
  requestId?: string
  partyId?: string
}

const dims = (m: AIRequestMeta): Dims => ({ feature: m.feature, plan: m.plan, provider: m.provider, model: m.model })
const ctx = (m: AIRequestMeta): Dims => ({ request_id: m.requestId, party: safeId(m.partyId), super_admin: m.superAdmin })

export function aiLimitReached(m: Pick<AIRequestMeta, 'feature' | 'plan' | 'superAdmin' | 'requestId' | 'partyId'>, limit: 'party' | 'hourly' | 'daily' | 'global') {
  track('AI_REQUEST_LIMIT_REACHED', { feature: m.feature, plan: m.plan, limit }, { request_id: m.requestId, party: safeId(m.partyId) })
}

/** Called by the client loop when it re-asks the model (invalid JSON / schema / truncated / leak). */
export function aiRetried(m: { feature: string; provider: string; model: string }, reason: string) {
  track('AI_REQUEST_RETRIED', { feature: m.feature, provider: m.provider, model: m.model, reason })
}

export interface AIOutcome {
  ok: boolean
  /** AIErrorCode when !ok: timeout | provider_error | invalid_response | … */
  code?: string
  /** Why (timeout / unavailable / rate_limited / auth / aborted / json / schema / truncated / leak / post_processing). */
  detail?: string
  model: string
  durationMs: number
  attempts: number
  inputTokens?: number | null
  outputTokens?: number | null
}

/** Wraps one model call (all attempts) in a gen_ai span and records started / succeeded / failed telemetry. */
export async function observeAICall<T extends AIOutcome>(m: AIRequestMeta, call: () => Promise<T>): Promise<T> {
  track('AI_REQUEST_STARTED', dims(m), ctx(m))
  return withSpan(
    {
      name: `chat ${m.model}`,
      op: 'gen_ai.chat',
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': m.provider,
        'gen_ai.system': m.provider,
        'gen_ai.request.model': m.model,
        'mbp.ai.feature': m.feature,
        'mbp.plan': m.plan,
        'mbp.request_id': m.requestId,
        'mbp.party': safeId(m.partyId),
      },
    },
    call,
    (set, r, markFailed) => {
      if (!r.ok) markFailed(r.code ?? 'error')
      const usageKnown = !!r.inputTokens // 0 means the provider didn't report usage
      const cost = usageKnown ? estimateCostUsd(r.model, r.inputTokens, r.outputTokens) : null
      set({
        'gen_ai.response.model': r.model,
        'gen_ai.usage.input_tokens': usageKnown ? r.inputTokens : undefined,
        'gen_ai.usage.output_tokens': usageKnown ? r.outputTokens ?? undefined : undefined,
        'mbp.ai.success': r.ok,
        'mbp.ai.failure': r.ok ? undefined : r.code,
        'mbp.ai.failure_detail': r.ok ? undefined : r.detail,
        'mbp.ai.attempts': r.attempts,
        'mbp.ai.retry_count': Math.max(0, r.attempts - 1),
        'mbp.ai.estimated_cost_usd': cost ?? undefined,
      })
      recordOutcome({ ...m, model: r.model || m.model }, r, usageKnown, cost)
    },
  )
}

function recordOutcome(m: AIRequestMeta, r: AIOutcome, usageKnown: boolean, cost: number | null) {
  const d = dims(m)
  const c: Dims = {
    ...ctx(m),
    latency_ms: r.durationMs,
    attempts: r.attempts,
    retry_count: Math.max(0, r.attempts - 1),
    input_tokens: usageKnown ? r.inputTokens : 'unknown',
    output_tokens: usageKnown ? r.outputTokens : 'unknown',
    estimated_cost_usd: cost ?? 'unknown',
  }
  timing('ai.latency', r.durationMs, { ...d, success: r.ok })
  if (LATENCY_METRIC[m.feature]) timing(LATENCY_METRIC[m.feature], r.durationMs, { plan: m.plan, success: r.ok })
  if (usageKnown) {
    distribution('ai.tokens.input', r.inputTokens!, d)
    if (r.outputTokens != null) distribution('ai.tokens.output', r.outputTokens, d)
  }
  if (cost != null) distribution('ai.estimated_cost_usd', cost, d)

  if (r.ok) return track('AI_REQUEST_SUCCEEDED', d, c)

  const clientAbort = r.code === 'provider_error' && r.detail === 'aborted' // parent closed the tab; timeouts are code 'timeout'
  const failure = clientAbort ? 'client_abort' : r.code ?? 'unknown'
  track('AI_REQUEST_FAILED', { ...d, failure, detail: r.detail }, c, 'warn')
  if (r.code === 'timeout') track('AI_REQUEST_TIMEOUT', d, c, 'warn')
  if (r.code === 'invalid_response') track('AI_REQUEST_VALIDATION_FAILED', { ...d, detail: r.detail }, c, 'warn')

  // Issues only for what someone should look at; client aborts and single bad answers are metrics only.
  if (r.code === 'provider_error' && !clientAbort) {
    reportError(`AI provider failure: ${r.detail ?? 'unknown'}`, { area: 'ai', op: 'ai_call', level: 'error', tags: { feature: m.feature, provider: m.provider, model: m.model, detail: r.detail }, fingerprint: ['ai-provider', m.provider, r.detail ?? 'unknown'] })
  } else if (r.code === 'high_demand') {
    reportError('AI provider rate limited', { area: 'ai', op: 'ai_call', level: 'warning', tags: { feature: m.feature, provider: m.provider, model: m.model }, fingerprint: ['ai-rate-limited', m.provider] })
  } else if (r.code === 'timeout') {
    reportError('AI request timed out', { area: 'ai', op: 'ai_call', level: 'warning', tags: { feature: m.feature, provider: m.provider, model: m.model }, fingerprint: ['ai-timeout', m.feature] })
  }
}

/** Post-processing bug after a valid model answer (the model call itself was already counted as succeeded). */
export function aiPostProcessingFailed(m: AIRequestMeta, err: unknown) {
  track('AI_POST_PROCESSING_FAILED', dims(m), ctx(m), 'warn')
  reportError(err instanceof Error ? err : 'AI post-processing failed', { area: 'ai', op: 'ai_post_processing', tags: { feature: m.feature } })
}

/** Failed to reserve/finalize a generation row (usage accounting). */
export function aiUsageRecordingFailed(op: 'reserve' | 'finalize', feature?: string, code?: string) {
  reportError(`AI usage ${op} failed`, { area: 'db', op: `ai_usage_${op}`, tags: { feature, code }, fingerprint: ['ai-usage', op, code ?? 'unknown'] })
}
