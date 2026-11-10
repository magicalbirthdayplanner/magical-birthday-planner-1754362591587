/**
 * OpenAI-compatible chat completions over fetch (OpenCode Go, OpenAI, others; Azure has its own adapter). No SDK: explicit timeout/abort,
 * headers and error mapping. The key is sent only in the Authorization header and never logged.
 */
import 'server-only'
import type { AIConfig } from '../config'
import { ProviderError, type AIProvider, type CompletionRequest, type CompletionResult } from '../provider'

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string
  readonly model: string
  constructor(private cfg: AIConfig) {
    this.name = cfg.provider
    this.model = cfg.model
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (!this.cfg.apiKey || !this.cfg.model || !this.cfg.baseUrl) throw new ProviderError('not_configured', 'AI provider is not configured')
    let res: Response
    try {
      res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: req.signal,
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'magical-birthday-planner/1.0',
          'x-opencode-session': req.sessionId, // required by OpenCode Go; harmless elsewhere
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: req.messages,
          max_tokens: req.maxTokens,
          temperature: 0.7,
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
          // DeepSeek V4 reasons by default and can spend the whole token budget thinking (empty answer, timeouts).
          // Only sent to DeepSeek models; other providers may reject unknown parameters.
          ...(/deepseek/i.test(this.cfg.model) && !this.cfg.thinking ? { thinking: { type: 'disabled' } } : {}),
        }),
        cache: 'no-store',
      })
    } catch (e) {
      if (req.signal.aborted) throw new ProviderError(String(req.signal.reason ?? '').includes('timeout') ? 'timeout' : 'aborted', 'request aborted')
      throw new ProviderError('unavailable', 'network error')
    }
    const err = errorForStatus(res.status)
    if (err) throw err
    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new ProviderError('unavailable', 'provider returned non-JSON')
    }
    return completionFromBody(body, this.cfg.model)
  }
}

/** HTTP status → provider error (null when the call succeeded). Shared with the Azure adapter. */
export function errorForStatus(status: number): ProviderError | null {
  if (status === 429) return new ProviderError('rate_limited', 'provider rate limited', 429)
  if (status === 401 || status === 403) return new ProviderError('auth', 'provider rejected credentials', status)
  if (status >= 500) return new ProviderError('unavailable', `provider ${status}`, status)
  if (status < 200 || status >= 300) return new ProviderError('bad_request', `provider ${status}`, status)
  return null
}

/** An OpenAI-style chat completion body → our result. Shared with the Azure adapter. */
export function completionFromBody(raw: unknown, fallbackModel: string): CompletionResult {
  const body = (raw ?? {}) as { model?: string; choices?: { message?: { content?: string | null }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  // reasoning_content (DeepSeek) is deliberately ignored — never shown or stored.
  const text = body.choices?.[0]?.message?.content ?? ''
  // Out of tokens before any answer (e.g. all spent reasoning): a provider problem, not something a retry fixes.
  if (!text.trim() && body.choices?.[0]?.finish_reason === 'length') throw new ProviderError('unavailable', 'no answer before the token limit')
  return { text, model: body.model ?? fallbackModel, inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null, truncated: body.choices?.[0]?.finish_reason === 'length' }
}
