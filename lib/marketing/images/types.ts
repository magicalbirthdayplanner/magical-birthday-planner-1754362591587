/**
 * ImageGenerationProvider: turns a post's visual brief into an image. Providers are swappable (brand card renderer,
 * OpenAI images, others later); the pipeline never depends on one.
 */
import type { Pillar } from '../types'

export interface ImageRequest {
  postId: string
  pillar: Pillar
  /** Scene description written by the model for this post (already safety-checked). */
  prompt: string
  /** 2–7 words max; the only text allowed on the image. */
  headline: string
  altText: string
}

export interface GeneratedImage { bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number; provider: string; model: string | null; prompt: string }

export interface ImageGenerationProvider {
  readonly name: string
  configured(): boolean
  generate(req: ImageRequest): Promise<GeneratedImage>
}
