/** Image provider registry. Default 'brand' (no external API); 'openai' when configured; 'none' disables images. SERVER ONLY. */
import 'server-only'
import type { MarketingConfig } from '../config'
import type { ImageGenerationProvider } from './types'

let override: ImageGenerationProvider | null | undefined
/** Tests only (null = no images). */
export function setImageProviderOverride(p: ImageGenerationProvider | null | undefined) {
  override = p
}

export async function getImageProvider(cfg: MarketingConfig, env: Record<string, string | undefined> = process.env): Promise<ImageGenerationProvider | null> {
  if (override !== undefined) return override
  if (cfg.imageProvider === 'none') return null
  if (cfg.imageProvider === 'openai' && env.OPENAI_API_KEY?.trim()) {
    const { OpenAIImageProvider } = await import('./openai')
    return new OpenAIImageProvider({ apiKey: env.OPENAI_API_KEY.trim(), model: cfg.imageModel })
  }
  // 'brand' — and the fallback when OpenAI is selected without a key.
  const { BrandCardImageProvider } = await import('./brand-card')
  return new BrandCardImageProvider()
}

export type { ImageGenerationProvider, GeneratedImage, ImageRequest } from './types'
