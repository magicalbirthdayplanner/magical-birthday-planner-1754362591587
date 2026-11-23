'use client'

/**
 * Loudness (0..1) and "tone" (share of low frequencies, 0..1) of Santa's voice, read with a Web Audio analyser.
 * Values live in refs, updated every animation frame, so avatars can read them without re-rendering.
 * The analyser is NOT connected to the speakers: playback stays on the caller's <audio> element.
 */
import { useEffect, useRef } from 'react'

export function useVoiceLevel(stream: MediaStream | null, audioContext: AudioContext | null) {
  const level = useRef(0)
  const tone = useRef(0.5)
  useEffect(() => {
    level.current = 0
    if (!stream || !audioContext) return
    let src: MediaStreamAudioSourceNode | null = null
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.35
    try {
      src = audioContext.createMediaStreamSource(stream)
      src.connect(analyser)
    } catch {
      return
    }
    const time = new Float32Array(analyser.fftSize)
    const freq = new Uint8Array(analyser.frequencyBinCount)
    const binHz = audioContext.sampleRate / analyser.fftSize
    let raf = 0
    const tick = () => {
      analyser.getFloatTimeDomainData(time)
      let sum = 0
      for (let i = 0; i < time.length; i++) sum += time[i] * time[i]
      level.current = Math.min(1, Math.max(0, (Math.sqrt(sum / time.length) - 0.008) * 9))
      analyser.getByteFrequencyData(freq)
      let low = 0
      let high = 0
      for (let i = 1; i < freq.length; i++) {
        const hz = i * binHz
        if (hz < 900) low += freq[i]
        else if (hz < 3500) high += freq[i]
      }
      tone.current = low + high > 0 ? low / (low + high) : 0.5
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      level.current = 0
      try {
        src?.disconnect()
      } catch {
        /* already disconnected */
      }
    }
  }, [stream, audioContext])
  return { level, tone }
}

/** Speech-like fake loudness for design previews (no audio). */
export function demoLevel(t: number): number {
  const syll = Math.max(0, Math.sin(t * 10.5) * 0.6 + Math.sin(t * 6.3) * 0.4)
  return Math.sin(t * 0.9) > -0.6 ? syll : 0
}
