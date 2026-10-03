/** Provider abstraction: one call shape for every backend. Server only. */
import 'server-only'
import { aiConfig, type AIConfig } from './config'

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface CompletionRequest {
  feature: string
  messages: ChatMessage[]
  maxTokens: number
  json: boolean
  signal: AbortSignal
  /** Stable per generation; OpenCode Go requires it (x-opencode-session). */
  sessionId: string
}
export interface CompletionResult { text: string; model: string; inputTokens: number | null; outputTokens: number | null; /** Hit the output-token cap (answer cut off). */ truncated?: boolean }

export type ProviderErrorKind = 'timeout' | 'aborted' | 'rate_limited' | 'unavailable' | 'auth' | 'bad_request' | 'not_configured'
export class ProviderError extends Error {
  constructor(public kind: ProviderErrorKind, message: string, public status?: number) {
    super(message)
    this.name = 'ProviderError'
  }
}

export interface AIProvider {
  readonly name: string
  readonly model: string
  complete(req: CompletionRequest): Promise<CompletionResult>
}

let override: AIProvider | null = null
/** Tests only: route every call to this provider. */
export function setProviderOverride(p: AIProvider | null) {
  override = p
}

export async function getProvider(cfg: AIConfig = aiConfig()): Promise<AIProvider> {
  if (override) return override
  switch (cfg.provider) {
    case 'mock': {
      const { MockProvider } = await import('./providers/mock')
      return new MockProvider()
    }
    case 'anthropic': {
      const { AnthropicProvider } = await import('./providers/anthropic')
      return new AnthropicProvider(cfg)
    }
    default: {
      const { OpenAICompatibleProvider } = await import('./providers/openaiCompatible')
      return new OpenAICompatibleProvider(cfg)
    }
  }
}
