/**
 * Call sounds, synthesised with Web Audio (no audio files, nothing to download).
 *   ringback — the classic double "ring-ring" you hear while a call connects (400 + 450 Hz, 0.4 s on / 0.2 s off /
 *              0.4 s on / 2 s off), softened with short fades and a touch of sleigh-bell sparkle.
 *   pickup   — a soft two-note chime when Santa answers.
 * Use an AudioContext created inside the user's tap (iOS).
 */

export const RING_CYCLE_SECONDS = 3.0

function tone(ctx: AudioContext, out: AudioNode, freqs: number[], start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.015)
  g.gain.setValueAtTime(gain, start + dur - 0.03)
  g.gain.linearRampToValueAtTime(0, start + dur)
  g.connect(out)
  for (const f of freqs) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    o.connect(g)
    o.start(start)
    o.stop(start + dur + 0.02)
  }
}

/** A bright, quickly-decaying bell. */
function bell(ctx: AudioContext, out: AudioNode, freq: number, start: number, gain: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
  g.connect(out)
  for (const [mult, level] of [[1, 1], [2.76, 0.35], [5.4, 0.15]] as const) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    og.gain.value = level
    o.frequency.value = freq * mult
    o.connect(og).connect(g)
    o.start(start)
    o.stop(start + 1)
  }
}

/** Start the ringback; returns stop(). Schedules a few cycles ahead and keeps topping up. */
export function startRingback(ctx: AudioContext, volume = 0.16): () => void {
  const out = ctx.createGain()
  out.gain.value = volume
  out.connect(ctx.destination)
  let next = ctx.currentTime + 0.05
  let stopped = false
  const schedule = () => {
    while (next < ctx.currentTime + RING_CYCLE_SECONDS * 2) {
      tone(ctx, out, [400, 450], next, 0.4, 0.55)
      tone(ctx, out, [400, 450], next + 0.6, 0.4, 0.55)
      bell(ctx, out, 2093, next + 0.02, 0.05) // a little sleigh-bell sparkle on each ring
      bell(ctx, out, 2637, next + 0.62, 0.04)
      next += RING_CYCLE_SECONDS
    }
  }
  schedule()
  const timer = setInterval(() => !stopped && schedule(), 500)
  return () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    const t = ctx.currentTime
    out.gain.cancelScheduledValues(t)
    out.gain.setValueAtTime(out.gain.value, t)
    out.gain.linearRampToValueAtTime(0, t + 0.08)
    setTimeout(() => out.disconnect(), 200)
  }
}

/** Soft "Santa picked up" chime. */
export function playPickup(ctx: AudioContext, volume = 0.18) {
  const out = ctx.createGain()
  out.gain.value = volume
  out.connect(ctx.destination)
  const t = ctx.currentTime + 0.02
  bell(ctx, out, 1568, t, 0.5)
  bell(ctx, out, 2093, t + 0.12, 0.45)
  setTimeout(() => out.disconnect(), 1500)
}
