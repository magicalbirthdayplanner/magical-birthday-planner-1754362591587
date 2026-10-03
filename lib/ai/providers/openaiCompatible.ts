/**
 * OpenAI-compatible chat completions over fetch (OpenCode Go, OpenAI, others). No SDK: explicit timeout/abort,
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
        }),
        cache: 'no-store',
      })
    } catch (e) {
      if (req.signal.aborted) throw new ProviderError(String(req.signal.reason ?? '').includes('timeout') ? 'timeout' : 'aborted', 'request aborted')
      throw new ProviderError('unavailable', 'network error')
    }
    if (res.status === 429) throw new ProviderError('rate_limited', 'provider rate limited', 429)
    if (res.status === 401 || res.status === 403) throw new ProviderError('auth', 'provider rejected credentials', res.status)
    if (res.status >= 500) throw new ProviderError('unavailable', `provider ${res.status}`, res.status)
    if (!res.ok) throw new ProviderError('bad_request', `provider ${res.status}`, res.status)
    let body: { model?: string; choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    try {
      body = await res.json()
    } catch {
      throw new ProviderError('unavailable', 'provider returned non-JSON')
    }
    // reasoning_content (DeepSeek) is deliberately ignored — never shown or stored.
    const text = body.choices?.[0]?.message?.content ?? ''
    return { text, model: body.model ?? this.cfg.model, inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null }
  }
}
