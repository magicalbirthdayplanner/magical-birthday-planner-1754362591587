/**
 * callStructured(): the only way features talk to a model. Timeout + client abort, one safe repair pass, at most one
 * retry with the validation error, usage capture. Never throws; returns a typed result or a friendly error code.
 */
import 'server-only'
import type { z } from 'zod'
import { aiConfig, type AIConfig } from './config'
import { getProvider, ProviderError, type ChatMessage } from './provider'
import { cleanResult, looksLikePromptLeak } from './safety'
import type { AIErrorCode } from './types'

export interface StructuredOk<T> { ok: true; data: T; model: string; provider: string; inputTokens: number | null; outputTokens: number | null; durationMs: number; attempts: number; scrubbed: boolean }
export interface StructuredErr { ok: false; code: AIErrorCode; model: string; provider: string; durationMs: number; attempts: number; detail?: string }
export type StructuredResult<T> = StructuredOk<T> | StructuredErr

/** Safe repair: strip code fences, take the outermost JSON object, parse. Unknown keys are dropped by zod. */
export function repairJson(text: string): unknown | undefined {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  for (const candidate of [t, outermostObject(t)]) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      /* try next */
    }
  }
  return undefined
}
function outermostObject(s: string): string | null {
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  return a >= 0 && b > a ? s.slice(a, b + 1) : null
}
function zodSummary(err: z.ZodError): string {
  return err.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ').slice(0, 600)
}

export async function callStructured<T>(opts: {
  feature: string
  schema: z.ZodType<T>
  system: string
  user: string
  sessionId: string
  signal?: AbortSignal
  maxTokens?: number
  cfg?: AIConfig
}): Promise<StructuredResult<T>> {
  const cfg = opts.cfg ?? aiConfig()
  const started = Date.now()
  const provider = await getProvider(cfg)
  const base = { model: provider.model, provider: provider.name }
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort('timeout'), cfg.timeoutMs)
  const onAbort = () => timeout.abort('client_abort')
  opts.signal?.addEventListener('abort', onAbort, { once: true })
  if (opts.signal?.aborted) timeout.abort('client_abort') // cancelled before we started listening
  const messages: ChatMessage[] = [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }]
  let attempts = 0
  let inTok: number | null = null, outTok: number | null = null
  try {
    for (;;) {
      attempts++
      let text: string
      try {
        const r = await provider.complete({ feature: opts.feature, messages, maxTokens: opts.maxTokens ?? cfg.maxOutputTokens, json: true, signal: timeout.signal, sessionId: opts.sessionId })
        text = r.text
        base.model = r.model
        inTok = (inTok ?? 0) + (r.inputTokens ?? 0)
        outTok = (outTok ?? 0) + (r.outputTokens ?? 0)
      } catch (e) {
        const kind = e instanceof ProviderError ? e.kind : 'unavailable'
        const code: AIErrorCode = kind === 'timeout' || (kind === 'aborted' && String(timeout.signal.reason) === 'timeout') ? 'timeout' : kind === 'rate_limited' ? 'high_demand' : 'provider_error'
        return { ok: false, code, ...base, durationMs: Date.now() - started, attempts, detail: kind }
      }
      const parsed = repairJson(text)
      const checked = parsed === undefined ? null : opts.schema.safeParse(parsed)
      if (checked?.success && !looksLikePromptLeak(JSON.stringify(checked.data))) {
        const { value, scrubbed } = cleanResult(checked.data)
        return { ok: true, data: value, ...base, inputTokens: inTok, outputTokens: outTok, durationMs: Date.now() - started, attempts, scrubbed }
      }
      if (attempts > cfg.maxRetries) {
        return { ok: false, code: 'invalid_response', ...base, durationMs: Date.now() - started, attempts, detail: checked ? 'schema' : 'json' }
      }
      const reason = checked && !checked.success ? zodSummary(checked.error) : checked?.success ? 'the output repeated internal instructions' : 'it was not a single valid JSON object'
      messages.push({ role: 'assistant', content: text.slice(0, 4000) }, { role: 'user', content: `Your last output was invalid because: ${reason}. Return only the corrected JSON object.` })
    }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}
