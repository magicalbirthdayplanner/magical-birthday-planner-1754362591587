'use client'

/**
 * Storybook Santa — our own animated Santa (option B: no avatar vendor). Pure SVG, animated in the browser:
 *   • mouth + jaw follow the loudness (and a little of the tone) of Santa's voice via a Web Audio analyser
 *   • blinks, breathing, gentle head sway, nodding emphasis while talking
 *   • "listening" pose (head tilt, raised brows, soft smile) while the child talks
 *   • hat pom-pom sways, warm bokeh lights and snow in the background
 *
 * All animation writes SVG attributes directly from requestAnimationFrame (no React re-render per frame).
 * Respects prefers-reduced-motion (keeps lip-sync, drops sway/snow).
 */
import { useEffect, useMemo, useRef } from 'react'
import { demoLevel, useVoiceLevel } from './useVoiceLevel'

export type SantaMode = 'idle' | 'listening' | 'speaking'

const SKIN = '#f6c6a3'
const SKIN_SHADE = '#e9ad8b'
const RED = '#c8202e'
const RED_DARK = '#951520'
const FUR = '#fffdf8'
const FUR_SHADE = '#e8e1d6'
const GOLD = '#d4a443'
const INK = '#3a2418'

/** Scalloped "cloud" outline: circles placed along a polyline (beard, fur). */
function scallops(points: [number, number][], r: number, jitter = 0.18) {
  const out: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const n = Math.max(1, Math.round(len / (r * 0.9)))
    for (let k = 0; k < n; k++) {
      const t = k / n
      const wob = 1 + jitter * Math.sin((i * 7 + k) * 1.7)
      out.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, r: r * wob })
    }
  }
  return out
}

/** Left half → mirrored around x = 300, so the beard and hair are symmetric. */
function mirrored(half: [number, number][], r: number, jitter = 0.14) {
  const left = scallops(half, r, jitter)
  return [...left, ...left.map((c) => ({ ...c, x: 600 - c.x }))]
}

export function StorybookSanta({ stream, audioContext, mode, demo = false, className }: {
  /** Santa's voice (remote WebRTC audio). Analysed only; playback is done by the caller's <audio>. */
  stream: MediaStream | null
  /** Created/resumed by the caller inside the user's tap (iOS needs this). */
  audioContext: AudioContext | null
  mode: SantaMode
  /** No audio: fake a talking mouth (design preview). */
  demo?: boolean
  className?: string
}) {
  const modeRef = useRef(mode)
  modeRef.current = mode
  const refs = {
    head: useRef<SVGGElement>(null),
    body: useRef<SVGGElement>(null),
    jaw: useRef<SVGGElement>(null),
    mouth: useRef<SVGEllipseElement>(null),
    tongue: useRef<SVGEllipseElement>(null),
    teeth: useRef<SVGRectElement>(null),
    mustache: useRef<SVGGElement>(null),
    brows: useRef<SVGGElement>(null),
    eyeL: useRef<SVGGElement>(null),
    eyeR: useRef<SVGGElement>(null),
    pom: useRef<SVGGElement>(null),
    cheeks: useRef<SVGGElement>(null),
  }

  const { level: levelRef, tone: toneRef } = useVoiceLevel(stream, audioContext)

  // ---------------------------------------------------------------- animation loop
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let open = 0
    let round = 0.5
    let tilt = 0
    let brow = 0
    let nextBlink = performance.now() + 1500
    let blinkUntil = 0
    const t0 = performance.now()
    const frame = (now: number) => {
      const t = (now - t0) / 1000
      const m = modeRef.current
      let target = levelRef.current
      if (demo && m === 'speaking') target = demoLevel(t)
      if (m !== 'speaking' && !stream) target = 0
      // Fast attack, slower release — reads as speech, not flapping.
      open += (target - open) * (target > open ? 0.55 : 0.22)
      round += (toneRef.current - round) * 0.1

      const listening = m === 'listening'
      tilt += ((listening ? -3.2 : 0) - tilt) * 0.06
      brow += ((listening ? 1 : open > 0.5 ? 0.6 : 0) - brow) * 0.12

      const sway = reduce ? 0 : Math.sin(t * 0.55) * 1.1 + Math.sin(t * 0.23) * 0.6
      const nod = reduce ? 0 : open * 2.2 * Math.sin(t * 3.1)
      const breathe = reduce ? 0 : Math.sin(t * 1.35) * 2.2
      refs.head.current?.setAttribute('transform', `translate(0 ${(breathe * 0.6 + open * 1.2).toFixed(2)}) rotate(${(sway + tilt + nod).toFixed(2)} 300 430)`)
      refs.body.current?.setAttribute('transform', `translate(0 ${breathe.toFixed(2)})`)

      // Mouth: height from loudness, width from tone (darker/lower voice → rounder "oh").
      const ry = 2.5 + open * 17
      const rx = 20 + (1 - round) * 6 - open * 3
      refs.mouth.current?.setAttribute('ry', ry.toFixed(2))
      refs.mouth.current?.setAttribute('rx', rx.toFixed(2))
      refs.tongue.current?.setAttribute('ry', Math.max(0, ry * 0.42).toFixed(2))
      refs.tongue.current?.setAttribute('cy', (406 + ry * 0.55).toFixed(2))
      refs.teeth.current?.setAttribute('opacity', open > 0.25 ? '1' : '0')
      refs.teeth.current?.setAttribute('y', (404 - ry + 1).toFixed(2))
      refs.jaw.current?.setAttribute('transform', `translate(0 ${(open * 9).toFixed(2)})`)
      refs.mustache.current?.setAttribute('transform', `translate(0 ${(-open * 2.5).toFixed(2)}) rotate(${(Math.sin(t * 7) * open * 1.5).toFixed(2)} 300 392)`)
      refs.brows.current?.setAttribute('transform', `translate(0 ${(-brow * 6).toFixed(2)})`)
      refs.cheeks.current?.setAttribute('opacity', (0.5 + open * 0.15 + (listening ? 0.1 : 0)).toFixed(2))

      // Blink every 2.5–6 s (double blink now and then).
      if (now > nextBlink) {
        blinkUntil = now + 130
        nextBlink = now + 2500 + Math.random() * 3500
        if (Math.random() < 0.18) nextBlink = now + 260
      }
      const lid = now < blinkUntil ? 0.08 : 1
      refs.eyeL.current?.setAttribute('transform', `translate(258 318) scale(1 ${lid}) translate(-258 -318)`)
      refs.eyeR.current?.setAttribute('transform', `translate(342 318) scale(1 ${lid}) translate(-342 -318)`)

      if (!reduce) refs.pom.current?.setAttribute('transform', `rotate(${(Math.sin(t * 1.6) * 6 + sway * 2).toFixed(2)} 470 205)`)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, stream])

  // ---------------------------------------------------------------- static geometry
  const beard = useMemo(() => {
    return mirrored([[194, 352], [188, 410], [198, 468], [222, 524], [258, 566], [300, 588]], 30)
  }, [])
  const brim = useMemo(() => scallops([[178, 236], [240, 226], [300, 222], [360, 226], [422, 236]], 24, 0.12), [])
  const hair = useMemo(() => mirrored([[198, 256], [188, 296], [190, 346]], 19, 0.1), [])
  const collar = useMemo(() => scallops([[150, 640], [200, 610], [300, 600], [400, 610], [450, 640]], 26, 0.1), [])
  const bokeh = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: (i * 137) % 600,
        y: 40 + ((i * 89) % 360),
        r: 10 + ((i * 7) % 22),
        c: i % 3 === 0 ? '#ff8a5b' : i % 3 === 1 ? '#ffd27a' : '#fff1c9',
        d: 3 + (i % 5),
      })),
    [],
  )
  const snow = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: (i * 53) % 600, r: 1.5 + (i % 3), d: 9 + (i % 7), delay: -(i * 1.3) })), [])

  return (
    <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Santa Claus">
      <defs>
        <linearGradient id="sb-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d2619" />
          <stop offset="0.55" stopColor="#173a27" />
          <stop offset="1" stopColor="#2a1810" />
        </linearGradient>
        <radialGradient id="sb-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0" stopColor="#ffc56b" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#ff9a4a" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-skin" cx="45%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fbd8bd" />
          <stop offset="0.7" stopColor={SKIN} />
          <stop offset="1" stopColor={SKIN_SHADE} />
        </radialGradient>
        <radialGradient id="sb-cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f07f78" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f07f78" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sb-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#df3341" />
          <stop offset="0.6" stopColor={RED} />
          <stop offset="1" stopColor={RED_DARK} />
        </linearGradient>
        <radialGradient id="sb-fur" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.75" stopColor={FUR} />
          <stop offset="1" stopColor={FUR_SHADE} />
        </radialGradient>
        <filter id="sb-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="sb-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* ---------- background: warm workshop glow, bokeh lights, snow ---------- */}
      <rect width="600" height="800" fill="url(#sb-bg)" />
      <rect width="600" height="800" fill="url(#sb-glow)" />
      <g filter="url(#sb-soft)">
        {bokeh.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.c} opacity="0.35">
            <animate attributeName="opacity" values="0.15;0.5;0.15" dur={`${b.d}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>
      <g opacity="0.75" className="motion-reduce:hidden">
        {snow.map((s, i) => (
          <circle key={i} cx={s.x} cy={-10} r={s.r} fill="#fff">
            <animateTransform attributeName="transform" type="translate" values={`0 0; ${(i % 2 ? 18 : -18)} 410; 0 820`} dur={`${s.d}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>

      {/* ---------- body ---------- */}
      <g ref={refs.body} filter="url(#sb-shadow)">
        <path d="M40 800 C 52 668, 150 600, 300 598 C 450 600, 548 668, 560 800 Z" fill="url(#sb-red)" />
        <path d="M120 800 C 140 720, 180 676, 220 660" stroke={RED_DARK} strokeWidth="8" fill="none" opacity="0.35" strokeLinecap="round" />
        <path d="M480 800 C 460 720, 420 676, 380 660" stroke={RED_DARK} strokeWidth="8" fill="none" opacity="0.35" strokeLinecap="round" />
        <rect x="268" y="610" width="64" height="200" rx="26" fill="url(#sb-fur)" />
        {collar.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="url(#sb-fur)" />
        ))}
        <circle cx="300" cy="700" r="9" fill={GOLD} />
        <circle cx="300" cy="760" r="9" fill={GOLD} />
      </g>

      {/* ---------- head ---------- */}
      <g ref={refs.head}>
        {/* hair behind the face */}
        {hair.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="url(#sb-fur)" />
        ))}
        {/* ears */}
        <ellipse cx="197" cy="332" rx="14" ry="22" fill={SKIN_SHADE} />
        <ellipse cx="403" cy="332" rx="14" ry="22" fill={SKIN_SHADE} />
        {/* face */}
        <ellipse cx="300" cy="330" rx="106" ry="116" fill="url(#sb-skin)" />
        <ellipse cx="300" cy="262" rx="98" ry="16" fill={SKIN_SHADE} opacity="0.55" />

        {/* cheeks */}
        <g ref={refs.cheeks} opacity="0.5">
          <circle cx="232" cy="362" r="34" fill="url(#sb-cheek)" />
          <circle cx="368" cy="362" r="34" fill="url(#sb-cheek)" />
        </g>

        {/* eyes (smiling crease + pupils), blink by scaling */}
        <g ref={refs.eyeL}>
          <ellipse cx="258" cy="318" rx="10" ry="12.5" fill={INK} />
          <circle cx="262" cy="313" r="3.6" fill="#fff" />
          <circle cx="255" cy="322" r="1.6" fill="#fff" opacity="0.7" />
        </g>
        <g ref={refs.eyeR}>
          <ellipse cx="342" cy="318" rx="10" ry="12.5" fill={INK} />
          <circle cx="346" cy="313" r="3.6" fill="#fff" />
          <circle cx="339" cy="322" r="1.6" fill="#fff" opacity="0.7" />
        </g>
        <path d="M236 338 q 22 12 44 0" stroke={SKIN_SHADE} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M320 338 q 22 12 44 0" stroke={SKIN_SHADE} strokeWidth="3.5" fill="none" strokeLinecap="round" />

        {/* glasses */}
        <g fill="none" stroke={GOLD} strokeWidth="5">
          <circle cx="258" cy="320" r="33" />
          <circle cx="342" cy="320" r="33" />
          <path d="M291 316 q 9 -8 18 0" />
          <path d="M225 314 L 198 306" />
          <path d="M375 314 L 402 306" />
        </g>
        <path d="M240 300 q 8 -6 16 -4" stroke="#fff" strokeWidth="3" opacity="0.55" fill="none" strokeLinecap="round" />
        <path d="M324 300 q 8 -6 16 -4" stroke="#fff" strokeWidth="3" opacity="0.55" fill="none" strokeLinecap="round" />

        {/* eyebrows */}
        <g ref={refs.brows}>
          <path d="M226 282 C 236 262, 270 258, 288 274 C 270 270, 246 274, 232 288 Z" fill={FUR} stroke={FUR_SHADE} strokeWidth="2" />
          <path d="M374 282 C 364 262, 330 258, 312 274 C 330 270, 354 274, 368 288 Z" fill={FUR} stroke={FUR_SHADE} strokeWidth="2" />
        </g>

        {/* beard (scalloped cloud) with jaw movement for the lower part */}
        <g ref={refs.jaw}>
          {beard.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y + 4} r={c.r} fill={FUR_SHADE} />
          ))}
          {beard.map((c, i) => (
            <circle key={`b${i}`} cx={c.x} cy={c.y} r={c.r} fill="url(#sb-fur)" />
          ))}
          <path d="M204 372 C 204 470, 252 556, 300 570 C 348 556, 396 470, 396 372 C 370 400, 330 396, 300 394 C 270 396, 230 400, 204 372 Z" fill="url(#sb-fur)" />
          {/* beard texture strokes */}
          <g stroke={FUR_SHADE} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9">
            <path d="M250 460 q 6 30 18 52" />
            <path d="M300 470 q 0 34 0 60" />
            <path d="M350 460 q -6 30 -18 52" />
            <path d="M222 430 q 4 26 16 44" />
            <path d="M378 430 q -4 26 -16 44" />
          </g>
        </g>

        {/* mouth (opens with the voice) */}
        <ellipse ref={refs.mouth} cx="300" cy="404" rx="20" ry="2.5" fill="#5e1418" />
        <rect ref={refs.teeth} x="286" y="392" width="28" height="6" rx="3" fill="#fff" opacity="0" />
        <ellipse ref={refs.tongue} cx="300" cy="408" rx="12" ry="0" fill="#d4575f" />

        {/* nose */}
        <ellipse cx="300" cy="356" rx="22" ry="19" fill="#ee9b85" />
        <ellipse cx="293" cy="349" rx="7" ry="5" fill="#fff" opacity="0.45" />

        {/* moustache */}
        <g ref={refs.mustache}>
          <path d="M300 378 C 284 366, 250 366, 232 382 C 220 393, 214 408, 222 414 C 226 404, 238 398, 252 400 C 272 402, 290 396, 300 388 Z" fill="url(#sb-fur)" stroke={FUR_SHADE} strokeWidth="2" />
          <path d="M300 378 C 316 366, 350 366, 368 382 C 380 393, 386 408, 378 414 C 374 404, 362 398, 348 400 C 328 402, 310 396, 300 388 Z" fill="url(#sb-fur)" stroke={FUR_SHADE} strokeWidth="2" />
        </g>

        {/* hat */}
        <path d="M190 236 C 196 150, 262 92, 344 92 C 410 92, 456 130, 474 196 C 458 168, 430 160, 414 172 C 420 190, 418 214, 410 236 Z" fill="url(#sb-red)" />
        <path d="M414 172 C 430 160, 458 168, 474 196" stroke={RED_DARK} strokeWidth="5" fill="none" opacity="0.5" />
        {brim.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="url(#sb-fur)" />
        ))}
        <rect x="178" y="216" width="244" height="40" rx="20" fill="url(#sb-fur)" />
        <g ref={refs.pom}>
          <circle cx="478" cy="222" r="30" fill="url(#sb-fur)" />
          <circle cx="470" cy="214" r="9" fill="#fff" opacity="0.8" />
        </g>
      </g>
    </svg>
  )
}
