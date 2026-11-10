/**
 * Azure OpenAI / Azure AI Foundry chat completions over fetch. AI_BASE_URL is the resource endpoint
 * (https://<name>.openai.azure.com, …cognitiveservices.azure.com or …services.ai.azure.com) and AI_MODEL the
 * DEPLOYMENT name. AI_API_VERSION: "v1" (default) → the v1 API (/openai/v1/chat/completions, model = deployment);
 * a dated version (e.g. 2025-01-01-preview) → /openai/deployments/<deployment>/chat/completions?api-version=…
 *
 * Reasoning models (gpt-5*, o*) take max_completion_tokens, reject a custom temperature and get a reasoning effort
 * (AI_REASONING_EFFORT, default "low" — keeps answers fast and inside the output cap). A parameter a deployment
 * rejects is dropped and the call repeated once. The key goes only in the api-key header and is never logged.
 */
import 'server-only'
import type { AIConfig } from '../config'
import { ProviderError, type AIProvider, type CompletionRequest, type CompletionResult } from '../provider'
import { completionFromBody, errorForStatus } from './openaiCompatible'

/** gpt-5, gpt-5-mini, gpt-5.1…, o1/o3/o4-mini: reasoning models (by deployment name, the usual convention). */
export const isReasoningDeployment = (name: string) => /^(gpt-5|o\d)/i.test(name.trim())

export function azureChatUrl(baseUrl: string, deployment: string, apiVersion: string): string {
  const root = baseUrl.replace(/\/+$/, '').replace(/\/openai(\/v1)?$/i, '')
  if (!apiVersion || apiVersion.toLowerCase() === 'v1') return `${root}/openai/v1/chat/completions`
  return `${root}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
}

export function azureBody(cfg: Pick<AIConfig, 'model' | 'thinking' | 'reasoningEffort'>, req: Pick<CompletionRequest, 'messages' | 'maxTokens' | 'json'>): Record<string, unknown> {
  const reasoning = isReasoningDeployment(cfg.model)
  return {
    model: cfg.model,
    messages: req.messages,
    max_completion_tokens: req.maxTokens,
    ...(reasoning ? { reasoning_effort: cfg.reasoningEffort ?? (cfg.thinking ? 'medium' : 'low') } : { temperature: 0.7 }),
    ...(req.json ? { response_format: { type: 'json_object' } } : {}),
  }
}

/** The parameter Azure says it can't take (400 unsupported_parameter / unsupported_value), if any. */
function rejectedParam(err: unknown): string | null {
  const e = (err as { error?: { code?: string; param?: string; message?: string } })?.error
  if (!e) return null
  if (e.param) return e.param
  const m = /'(temperature|reasoning_effort|max_completion_tokens|response_format)'/.exec(e.message ?? '')
  return m ? m[1] : null
}

export class AzureOpenAIProvider implements AIProvider {
  readonly name = 'azure'
  readonly model: string
  constructor(private cfg: AIConfig) {
    this.model = cfg.model
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (!this.cfg.apiKey || !this.cfg.model || !this.cfg.baseUrl) throw new ProviderError('not_configured', 'AI provider is not configured')
    const url = azureChatUrl(this.cfg.baseUrl, this.cfg.model, this.cfg.apiVersion)
    let body = azureBody(this.cfg, req)
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          signal: req.signal,
          headers: { 'api-key': this.cfg.apiKey, 'Content-Type': 'application/json', 'User-Agent': 'magical-birthday-planner/1.0' },
          body: JSON.stringify(body),
          cache: 'no-store',
        })
      } catch {
        if (req.signal.aborted) throw new ProviderError(String(req.signal.reason ?? '').includes('timeout') ? 'timeout' : 'aborted', 'request aborted')
        throw new ProviderError('unavailable', 'network error')
      }
      if (res.status === 400 && attempt === 0) {
        const param = rejectedParam(await res.clone().json().catch(() => null))
        if (param && param in body && param !== 'messages' && param !== 'model') {
          const next: Record<string, unknown> = { ...body }
          delete next[param]
          // Older deployments/API versions only know max_tokens.
          if (param === 'max_completion_tokens') next.max_tokens = req.maxTokens
          body = next
          continue
        }
      }
      const err = errorForStatus(res.status)
      if (err) throw err
      let json: unknown
      try {
        json = await res.json()
      } catch {
        throw new ProviderError('unavailable', 'provider returned non-JSON')
      }
      return completionFromBody(json, this.cfg.model)
    }
  }
}
