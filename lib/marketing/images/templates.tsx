/**
 * Reusable branded visual templates (zero API cost): one renderer, ten templates, dynamic text. Rendered with next/og
 * in the server, cream + purple/coral/gold, Nunito, the party-hat logo, the product name and the domain as plain text
 * in the footer (a free "CTA": X only bills real links). Short text only; no UI, no numbers-as-claims, no people.
 * SERVER ONLY (Node runtime).
 */
import 'server-only'
import { BRAND, confetti, loadAssets } from './brand-card'

export const TEMPLATES = ['tip', 'founder_quote', 'pain_point', 'checklist', 'this_or_that', 'venue_compare', 'ai_tip', 'product_feature', 'inspiration', 'poll_companion'] as const
export type TemplateKey = (typeof TEMPLATES)[number]
export const isTemplateKey = (v: unknown): v is TemplateKey => typeof v === 'string' && (TEMPLATES as readonly string[]).includes(v)

export const TEMPLATE_INFO: Record<TemplateKey, { label: string; kicker: string; layout: 'headline' | 'list' | 'quote' | 'versus' }> = {
  tip: { label: 'Birthday planning tip', kicker: 'Party planning tip', layout: 'list' },
  founder_quote: { label: 'Founder quote / story', kicker: 'Founder’s build log', layout: 'quote' },
  pain_point: { label: 'Parent pain point', kicker: 'Planning, honestly', layout: 'headline' },
  checklist: { label: 'Birthday checklist', kicker: 'Save this checklist', layout: 'list' },
  this_or_that: { label: 'This or that', kicker: 'This or that?', layout: 'versus' },
  venue_compare: { label: 'Venue comparison', kicker: 'Before you book a venue', layout: 'list' },
  ai_tip: { label: 'AI planning tip', kicker: 'AI that saves time', layout: 'list' },
  product_feature: { label: 'Product feature', kicker: 'Inside the planner', layout: 'headline' },
  inspiration: { label: 'Birthday inspiration', kicker: 'Party idea', layout: 'headline' },
  poll_companion: { label: 'Question / poll companion', kicker: 'Question for parents', layout: 'headline' },
}

export interface CardSpec {
  template: TemplateKey
  /** Seed for the confetti (post id + slide). */
  seed: string
  headline: string
  bullets?: string[]
  left?: string
  right?: string
  /** Carousel slide "2/4" badge. */
  badge?: string | null
  size?: 'wide' | 'square'
}

/** Text limits that keep images light (the post carries the words). */
export function cleanSpec(spec: CardSpec): CardSpec {
  // Emoji and symbols outside the bundled Nunito would make next/og fetch fonts from the network: drop them.
  const t = (s: string | undefined, max: number) => (s ?? '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim().slice(0, max)
  return {
    ...spec,
    headline: t(spec.headline, 80),
    bullets: (spec.bullets ?? []).map((b) => t(b, 48)).filter(Boolean).slice(0, 4),
    left: spec.left === undefined ? undefined : t(spec.left, 28),
    right: spec.right === undefined ? undefined : t(spec.right, 28),
  }
}

export async function renderCard(input: CardSpec): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const spec = cleanSpec(input)
  const [{ ImageResponse }, a] = await Promise.all([import('next/og'), loadAssets()])
  const square = spec.size === 'square'
  const W = square ? 1200 : 1600
  const H = square ? 1200 : 900
  const info = TEMPLATE_INFO[spec.template]
  const dark = info.layout === 'quote'
  const ink = dark ? '#FFFFFF' : BRAND.ink
  const bg = dark ? '#3A1F7A' : BRAND.cream
  const hl = spec.headline
  const big = info.layout === 'list' ? (hl.length > 44 ? 58 : 68) : hl.length > 50 ? 68 : hl.length > 28 ? 82 : 96
  const textW = square ? 980 : info.layout === 'headline' ? 900 : 1300
  const bits = confetti(spec.seed, square ? 16 : 22).map((c) => ({ ...c, x: Math.round((c.x / 1600) * W), y: Math.round((c.y / 900) * H) }))

  const body =
    info.layout === 'versus' ? (
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 44, gap: 36 }}>
        {[spec.left ?? 'This', spec.right ?? 'That'].map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: square ? 440 : 560, height: 220, borderRadius: 40, backgroundColor: i ? BRAND.coral : BRAND.purple, color: '#FFFFFF', fontSize: 64, fontWeight: 800, textAlign: 'center', padding: 24 }}>
            {t}
          </div>
        ))}
      </div>
    ) : info.layout === 'list' && spec.bullets?.length ? (
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, gap: 18 }}>
        {spec.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 44, fontWeight: 700, color: BRAND.ink }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 52, backgroundColor: BRAND.purple, color: '#FFFFFF', fontSize: 30, fontWeight: 800, marginRight: 24 }}>
              {spec.template === 'checklist' ? <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 18, backgroundColor: '#FFFFFF' }} /> : String(i + 1)}
            </div>
            {b}
          </div>
        ))}
      </div>
    ) : null

  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', backgroundColor: bg, fontFamily: 'Nunito' }}>
        {!dark ? <div style={{ position: 'absolute', right: -220, top: -220, width: 640, height: 640, borderRadius: 640, backgroundColor: BRAND.lavender, display: 'flex' }} /> : null}
        <div style={{ position: 'absolute', left: -180, bottom: -200, width: 460, height: 460, borderRadius: 460, backgroundColor: dark ? '#4B2A99' : '#FDE6DE', display: 'flex' }} />
        {bits.map((c, i) => (
          <div key={i} style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: c.round ? c.w : 3, backgroundColor: c.color, transform: `rotate(${c.rot}deg)`, display: 'flex', opacity: 0.9 }} />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={a.logo} width={120} height={120} style={{ position: 'absolute', right: 70, top: 60, borderRadius: 120 }} />
        {spec.badge ? (
          <div style={{ position: 'absolute', right: 74, bottom: 70, display: 'flex', fontSize: 30, fontWeight: 800, color: dark ? '#FFFFFF' : BRAND.purple }}>{spec.badge}</div>
        ) : null}
        <div style={{ position: 'absolute', left: 100, top: 90, width: textW, height: H - 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700, color: dark ? '#F6B128' : BRAND.purple, letterSpacing: 1 }}>
            <div style={{ width: 16, height: 16, borderRadius: 16, backgroundColor: BRAND.coral, marginRight: 16, display: 'flex' }} />
            {info.kicker}
          </div>
          {dark ? <div style={{ display: 'flex', fontSize: 160, lineHeight: 0.8, marginTop: 24, color: BRAND.gold, fontWeight: 800 }}>“</div> : null}
          <div style={{ display: 'flex', marginTop: dark ? 0 : 24, fontSize: big, fontWeight: 800, lineHeight: 1.08, color: ink, letterSpacing: -1 }}>{hl}</div>
          {body}
        </div>
        <div style={{ position: 'absolute', left: 100, bottom: 66, display: 'flex', alignItems: 'baseline', fontSize: 30, fontWeight: 800, color: ink }}>
          Magical Birthday&nbsp;<span style={{ color: dark ? BRAND.gold : BRAND.purple }}>Planner</span>
          <span style={{ marginLeft: 22, fontSize: 24, fontWeight: 700, color: dark ? '#D9CCF5' : BRAND.muted }}>magicalbirthdayplanner.app</span>
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
  return { bytes: new Uint8Array(await res.arrayBuffer()), width: W, height: H }
}
