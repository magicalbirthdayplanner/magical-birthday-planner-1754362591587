/**
 * Central AI configuration and feature flags. Reads the environment once per process (tests can reset it).
 * Server only: AI_API_KEY never leaves this module tree.
 */
import 'server-only'
import { AI_FEATURES, type AIFeature } from './types'

export type ProviderName = 'opencode' | 'openai' | 'anthropic' | 'mock'

export interface AIConfig {
  enabled: boolean
  features: ReadonlySet<AIFeature>
  provider: ProviderName
  apiKey: string | null
  baseUrl: string
  model: string
  maxOutputTokens: number
  timeoutMs: number
  maxRetries: number
  globalDailyLimit: number
  /** Per-user generations in any rolling 24 h (all parties, all features, failures included). */
  userDailyLimit: number
  /** Reasoning-model 'thinking' (DeepSeek V4): off by default — measured: on = 3000 reasoning tokens, empty answer, >45 s; off = valid JSON in ~12 s. */
  thinking: boolean
  /** True when the provider can actually be called (mock always can; others need a key). */
  configured: boolean
}

// OpenCode Go (verified 2026-10-03, https://opencode.ai/docs/go/): OpenAI-compatible chat completions.
const DEFAULTS: Record<ProviderName, { baseUrl: string; model: string }> = {
  opencode: { baseUrl: 'https://opencode.ai/zen/go/v1', model: 'deepseek-v4-pro' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: '' },
  mock: { baseUrl: '', model: 'mock-1' },
}

const int = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}

let cached: AIConfig | null = null
let warned = false

export function readAIConfig(env: NodeJS.ProcessEnv = process.env): AIConfig {
  const raw = (env.AI_PROVIDER ?? 'opencode').trim().toLowerCase()
  const provider: ProviderName = raw === 'openai' || raw === 'anthropic' || raw === 'mock' ? raw : 'opencode'
  const apiKey = env.AI_API_KEY?.trim() || null
  const features = new Set<AIFeature>(
    (env.AI_ENABLED_FEATURES ?? '').split(',').map((s) => s.trim()).filter((s): s is AIFeature => (AI_FEATURES as readonly string[]).includes(s)),
  )
  const model = env.AI_MODEL?.trim() || DEFAULTS[provider].model
  const configured = provider === 'mock' ? true : Boolean(apiKey && model)
  if (provider === 'mock' && env.NODE_ENV === 'production' && !warned) {
    warned = true
    console.warn('[ai] WARNING: AI_PROVIDER=mock in production — AI features return fixture output, not real suggestions.')
  }
  return {
    enabled: env.AI_ENABLED === 'true',
    features,
    provider,
    apiKey,
    baseUrl: (env.AI_BASE_URL?.trim() || DEFAULTS[provider].baseUrl).replace(/\/+$/, ''),
    model,
    maxOutputTokens: int(env.AI_MAX_OUTPUT_TOKENS, 3000, 256, 8000),
    timeoutMs: int(env.AI_TIMEOUT_MS, 45_000, 2_000, 120_000),
    maxRetries: int(env.AI_MAX_RETRIES, 1, 0, 1), // hard cap: never more than one retry
    globalDailyLimit: int(env.AI_GLOBAL_DAILY_LIMIT, 2000, 0, 1_000_000),
    userDailyLimit: int(env.AI_USER_DAILY_LIMIT, 30, 1, 1000),
    thinking: env.AI_THINKING?.trim().toLowerCase() === 'on',
    configured,
  }
}

export function aiConfig(): AIConfig {
  return (cached ??= readAIConfig())
}
/** Tests only. */
export function resetAIConfig() {
  cached = null
}

/** A feature is on only when the master switch is on, the feature is listed, and the provider is usable. */
export function featureEnabled(feature: AIFeature, cfg: AIConfig = aiConfig()): boolean {
  return cfg.enabled && cfg.configured && cfg.features.has(feature)
}
