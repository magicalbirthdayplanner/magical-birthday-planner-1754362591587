/**
 * Brand card provider: renders an on-brand 1600×900 PNG with next/og (Satori + resvg, already part of Next.js — no
 * external API, no key). Cream background, the party-hat logo, Nunito, purple/coral/gold confetti and ONE short
 * headline. No UI, no numbers, no social proof. Deterministic per post id. SERVER ONLY (Node runtime).
 */
import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Pillar } from '../types'
import type { GeneratedImage, ImageGenerationProvider, ImageRequest } from './types'

export const BRAND = { cream: '#FEF9F1', ink: '#1D182F', purple: '#5932B3', coral: '#F47352', gold: '#F6B128', lavender: '#E9E3FA', muted: '#6B6680' }
const W = 1600
const H = 900

const KICKER: Record<Pillar, string> = {
  founder_journey: 'Founder’s build log',
  parent_pain: 'Planning, honestly',
  useful_tips: 'Party planning tip',
  product_education: 'Inside the planner',
  ai_thinking: 'AI that saves time',
  community_question: 'Question for parents',
  launch_invitation: 'Now open',
}

const ASSETS = path.join(process.cwd(), 'lib/marketing/assets')
let assets: Promise<{ extraBold: Buffer; bold: Buffer; logo: string }> | null = null
export function loadAssets() {
  return (assets ??= Promise.all([
    readFile(path.join(ASSETS, 'Nunito-ExtraBold.ttf')),
    readFile(path.join(ASSETS, 'Nunito-Bold.ttf')),
    readFile(path.join(ASSETS, 'mbp-logo-256.png')),
  ]).then(([extraBold, bold, logo]) => ({ extraBold, bold, logo: `data:image/png;base64,${logo.toString('base64')}` })))
}

/** Small deterministic PRNG (mulberry32) seeded from the post id. */
export function seeded(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Confetti kept to the right-hand side and the edges, away from the headline. */
export function confetti(seed: string, n = 26) {
  const r = seeded(seed)
  const colors = [BRAND.purple, BRAND.coral, BRAND.gold, BRAND.lavender]
  return Array.from({ length: n }, () => {
    const right = r() < 0.75
    const x = right ? 1000 + r() * 560 : r() * 1560
    const y = right ? r() * 860 : r() * 90 // left side: top band only (headline and wordmark stay clear)
    const size = 10 + Math.round(r() * 22)
    return { x: Math.round(x), y: Math.round(y), w: size, h: r() < 0.5 ? size : Math.round(size * 0.45), round: r() < 0.45, rot: Math.round(r() * 180), color: colors[Math.floor(r() * colors.length)] }
  })
}

export class BrandCardImageProvider implements ImageGenerationProvider {
  readonly name = 'brand'
  configured() {
    return true
  }

  async generate(req: ImageRequest): Promise<GeneratedImage> {
    const [{ ImageResponse }, a] = await Promise.all([import('next/og'), loadAssets()])
    const headline = req.headline.trim().slice(0, 60)
    const size = headline.length > 40 ? 72 : headline.length > 24 ? 84 : 96
    const res = new ImageResponse(
      (
        <div style={{ width: W, height: H, display: 'flex', position: 'relative', backgroundColor: BRAND.cream, fontFamily: 'Nunito' }}>
          <div style={{ position: 'absolute', left: 1040, top: 150, width: 640, height: 640, borderRadius: 640, backgroundColor: BRAND.lavender, display: 'flex' }} />
          <div style={{ position: 'absolute', left: -160, top: 640, width: 420, height: 420, borderRadius: 420, backgroundColor: '#FDE6DE', display: 'flex' }} />
          {confetti(req.postId).map((c, i) => (
            <div key={i} style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: c.round ? c.w : 3, backgroundColor: c.color, transform: `rotate(${c.rot}deg)`, display: 'flex' }} />
          ))}
          <div style={{ position: 'absolute', left: 1130, top: 250, width: 400, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 400, backgroundColor: BRAND.cream, boxShadow: '0 30px 80px rgba(89,50,179,0.18)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={a.logo} width={300} height={300} style={{ borderRadius: 300 }} />
          </div>
          <div style={{ position: 'absolute', left: 110, top: 120, width: 900, height: 660, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 700, color: BRAND.purple, letterSpacing: 1 }}>
              <div style={{ width: 16, height: 16, borderRadius: 16, backgroundColor: BRAND.coral, marginRight: 16, display: 'flex' }} />
              {KICKER[req.pillar]}
            </div>
            <div style={{ display: 'flex', marginTop: 28, fontSize: size, fontWeight: 800, lineHeight: 1.08, color: BRAND.ink, letterSpacing: -1 }}>{headline}</div>
          </div>
          <div style={{ position: 'absolute', left: 110, bottom: 70, display: 'flex', fontSize: 32, fontWeight: 800, color: BRAND.ink }}>
            Magical Birthday&nbsp;<span style={{ color: BRAND.purple }}>Planner</span>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts: [
          { name: 'Nunito', data: a.extraBold, weight: 800, style: 'normal' },
          { name: 'Nunito', data: a.bold, weight: 700, style: 'normal' },
        ],
      },
    )
    const bytes = new Uint8Array(await res.arrayBuffer())
    return { bytes, mimeType: 'image/png', width: W, height: H, provider: this.name, model: null, prompt: `brand-card: ${headline}` }
  }
}
