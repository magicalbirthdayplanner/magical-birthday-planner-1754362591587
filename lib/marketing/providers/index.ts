/** Provider registry: one factory per platform. Tests swap in a fake with setMarketingProviderOverride. SERVER ONLY. */
import 'server-only'
import type { MarketingConfig } from '../config'
import type { Platform } from '../types'
import type { MarketingProvider } from './types'
import { XMarketingProvider, xCredentialsFromEnv } from './x'
import { InstagramProvider, instagramFromEnv } from './instagram'

let override: MarketingProvider | null = null
/** Tests only. */
export function setMarketingProviderOverride(p: MarketingProvider | null) {
  override = p
}

export function getMarketingProvider(platform: Platform, cfg: MarketingConfig, env: Record<string, string | undefined> = process.env): MarketingProvider {
  if (override) return override
  switch (platform) {
    case 'x':
      return new XMarketingProvider({ credentials: xCredentialsFromEnv(env), maxChars: cfg.xMaxChars, username: cfg.xUsername })
    case 'instagram':
      return new InstagramProvider(instagramFromEnv(env))
    default:
      // facebook / reddit / linkedin: implement MarketingProvider and register it here.
      throw new Error(`No marketing provider for ${platform} yet`)
  }
}

export { MarketingProviderError } from './types'
export type { MarketingProvider } from './types'
