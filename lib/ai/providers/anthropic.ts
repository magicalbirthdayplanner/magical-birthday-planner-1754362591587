/** Anthropic adapter — stub. Not used at launch (AI_PROVIDER=opencode). Kept so the config surface is complete. */
import 'server-only'
import type { AIConfig } from '../config'
import { ProviderError, type AIProvider, type CompletionResult } from '../provider'

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'
  readonly model: string
  constructor(cfg: AIConfig) {
    this.model = cfg.model
  }
  async complete(): Promise<CompletionResult> {
    throw new ProviderError('not_configured', 'The Anthropic adapter is not implemented yet; use AI_PROVIDER=opencode or openai.')
  }
}
