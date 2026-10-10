/**
 * OpenAI Images provider (POST /v1/images/generations, gpt-image-1 by default). Used only when
 * MARKETING_IMAGE_PROVIDER=openai and OPENAI_API_KEY is set. The key is sent only in the Authorization header and
 * never logged. The prompt is the safety-checked scene + brand style + hard constraints (no text/UI/logos/characters).
 * SERVER ONLY.
 */
import 'server-only'
import { fullImagePrompt } from './safety'
import type { GeneratedImage, ImageGenerationProvider, ImageRequest } from './types'

export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly name = 'openai'
  constructor(private opts: { apiKey: string | null; model: string; baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {}

  configured() {
    return !!this.opts.apiKey
  }

  async generate(req: ImageRequest): Promise<GeneratedImage> {
    if (!this.opts.apiKey) throw new Error('OPENAI_API_KEY is not set')
    const prompt = fullImagePrompt(req.prompt)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 50_000)
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(`${(this.opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '')}/images/generations`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.opts.model, prompt, size: '1536x1024', n: 1, quality: 'medium' }),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`image provider returned ${res.status}`)
      const body = (await res.json()) as { data?: { b64_json?: string }[] }
      const b64 = body.data?.[0]?.b64_json
      if (!b64) throw new Error('image provider returned no image')
      return { bytes: new Uint8Array(Buffer.from(b64, 'base64')), mimeType: 'image/png', width: 1536, height: 1024, provider: this.name, model: this.opts.model, prompt }
    } catch (e) {
      if (ctrl.signal.aborted) throw new Error('image provider timed out')
      throw e
    } finally {
      clearTimeout(timer)
    }
  }
}
