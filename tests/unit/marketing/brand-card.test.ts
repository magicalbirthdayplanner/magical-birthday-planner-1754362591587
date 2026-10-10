/** The default image provider really renders an on-brand PNG (next/og: Satori + resvg, no external API). */
import { describe, expect, it } from 'vitest'
import { BrandCardImageProvider } from '@/lib/marketing/images/brand-card'

describe('BrandCardImageProvider', () => {
  it('renders a 1600×900 PNG with the headline', async () => {
    const img = await new BrandCardImageProvider().generate({ postId: 'test-post', pillar: 'useful_tips', prompt: 'confetti', headline: 'Lock the date before the invites', altText: 'x' })
    expect(img.mimeType).toBe('image/png')
    expect(Array.from(img.bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const view = new DataView(img.bytes.buffer, img.bytes.byteOffset)
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1600, 900])
    expect(img.bytes.byteLength).toBeGreaterThan(20_000)
  }, 30_000)
})
