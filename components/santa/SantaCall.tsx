'use client'

/**
 * The Santa call screen. OpenAI Realtime (WebRTC) does the listening and talking; Santa's face is either
 *   • photo     — the photoreal Santa portrait animated in the browser (WebGL jaw + blink), no avatar vendor, or
 *   • storybook — our own animated SVG Santa, lip-synced in the browser from the voice (no avatar vendor), or
 *   • simli     — Simli's photoreal face, fed the voice track (when the server returns an avatar token).
 *
 *   1. Microphone (echo cancellation on). No camera: Santa never sees the child.
 *   2. `begin()` (server) → Simli session token + the session's max seconds.
 *   3. Simli first; start() resolves on the first video frame.
 *   4. OpenAI call: our server turns the SDP offer into an answer (keys + Santa's instructions stay server-side).
 *      The model's audio track goes to Simli only; the raw track is never played.
 *   5. Visit phases: private cues over the data channel; a goodbye is requested shortly before the cap.
 *      The hard caps are enforced server-side (Simli max length + OpenAI hang-up), not by this timer.
 *   6. Any end (button, cap, drop, error, tab hidden/closed, unmount) tears everything down once and reports why.
 *
 * No clock is shown. The parent controls are small and out of the child's way.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LogLevel, SimliClient } from 'simli-client'
import { Mic, MicOff, PhoneOff } from 'lucide-react'
import { phaseCue, visitPhase, type VisitPhase } from '@/lib/santa/persona'
import { StorybookSanta, type SantaMode } from './StorybookSanta'
import { playPickup, RING_CYCLE_SECONDS, startRingback } from './ringtone'
import { PhotoSanta } from './PhotoSanta'
import { cn } from '@/lib/utils'

export type SantaEndReason = 'parent_ended' | 'time_up' | 'dropped' | 'provider_error' | 'mic_denied' | 'no_connect'

export interface SantaCallApi {
  /** Server: reserve the session. avatarToken null → storybook Santa (no avatar vendor). */
  begin: () => Promise<{ avatarToken: string | null; maxSeconds: number }>
  /** Server: exchange the browser's SDP offer for OpenAI's answer. */
  negotiate: (offerSdp: string) => Promise<string>
  /** Server: Santa is on screen (first frame + voice connected). */
  connected?: () => void
  /** Server: the session ended (idempotent). */
  ended: (reason: SantaEndReason) => void
}

type Status = 'idle' | 'starting' | 'live' | 'ended'
type RealtimeEvent = { type: string; transcript?: string; response?: { id?: string }; error?: { message?: string; code?: string } }
type Avatar = 'local' | 'simli'
export type SantaLook = 'photo' | 'storybook'

/** simli-client 3.2.0 leaves its audio worklet attached after stop(); detach it first (same as Simli's own sample). */
function detachSimliAudio(simli: SimliClient) {
  const s = simli as unknown as { sourceNode?: AudioNode | null; audioWorklet?: AudioWorkletNode | null }
  try {
    s.sourceNode?.disconnect()
    if (s.audioWorklet) {
      s.audioWorklet.port.onmessage = null
      s.audioWorklet.disconnect()
    }
  } catch {
    /* already detached */
  }
}

/** How long before the end Santa starts his goodbye: 25 s on a 3-minute call, ~5 s on a 30-second preview. */
const goodbyeLead = (maxSeconds: number) => Math.min(25, Math.max(5, Math.round(maxSeconds * 0.15)))

const santaMode = (speaking: boolean, childTalking: boolean): SantaMode => (speaking ? 'speaking' : childTalking ? 'listening' : 'idle')

export function SantaCall({ api, label, onEnded, showCaptions = false, startLabel = 'Start the call with Santa', look = 'photo', goodbye = 'Say a warm, loving goodbye to the child now, in two or three short sentences, then stop.' }: {
  api: SantaCallApi
  /** Small badge, e.g. "Preview". */
  label?: string
  onEnded?: (reason: SantaEndReason, message: string | null) => void
  /** Development/preview aid: show what Santa says. Nothing is stored. */
  showCaptions?: boolean
  startLabel?: string
  /** Which in-browser Santa to show when the server returns no avatar token. */
  look?: SantaLook
  /** What Santa is asked to do shortly before the end (previews: one quick sentence + book a longer call). */
  goodbye?: string
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  const [speaking, setSpeaking] = useState(false)
  const [caption, setCaption] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [avatarReady, setAvatarReady] = useState(false)
  const [avatar, setAvatar] = useState<Avatar>('local')
  const [santaStream, setSantaStream] = useState<MediaStream | null>(null)
  const [childTalking, setChildTalking] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ringRef = useRef<{ stop: () => void; startedAt: number } | null>(null)
  const voiceRef = useRef<HTMLAudioElement>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const sinkRef = useRef<HTMLAudioElement>(null)
  const simliRef = useRef<SimliClient | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const attemptRef = useRef(0)
  const endedRef = useRef(true)
  const liveRef = useRef(false)
  const apiRef = useRef(api)
  apiRef.current = api
  const goodbyeRef = useRef(goodbye)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const responseRef = useRef<{ active: string | null; heardSince: boolean }>({ active: null, heardSince: false })
  goodbyeRef.current = goodbye

  const teardown = useCallback(() => {
    attemptRef.current += 1
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    const dc = dcRef.current
    dcRef.current = null
    dc?.close()
    const pc = pcRef.current
    pcRef.current = null
    pc?.close()
    micRef.current?.getTracks().forEach((t) => t.stop())
    micRef.current = null
    if (sinkRef.current) sinkRef.current.srcObject = null
    if (voiceRef.current) voiceRef.current.srcObject = null
    ringRef.current?.stop()
    ringRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setSantaStream(null)
    setChildTalking(false)
    const simli = simliRef.current
    simliRef.current = null
    if (simli) {
      detachSimliAudio(simli)
      simli.stop().catch(() => {})
    }
    setSpeaking(false)
    setAvatarReady(false)
    responseRef.current = { active: null, heardSince: false }
  }, [])

  const finish = useCallback(
    (reason: SantaEndReason, msg: string | null = null) => {
      if (endedRef.current) return
      endedRef.current = true
      liveRef.current = false
      teardown()
      setStatus('ended')
      setMessage(msg)
      setConfirmEnd(false)
      apiRef.current.ended(reason)
      onEndedRef.current?.(reason, msg)
    },
    // Stable on purpose: a parent re-render (new inline onEnded) must never re-run the unmount effect below, which
    // would end a live call.
    [teardown],
  )

  const send = (event: unknown) => {
    const dc = dcRef.current
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(event))
  }

  const cue = (phase: VisitPhase) => send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: phaseCue(phase) }] } })

  const schedulePhases = (maxSeconds: number) => {
    const at = (seconds: number, fn: () => void) => timersRef.current.push(setTimeout(fn, Math.max(0, seconds) * 1000))
    let last: VisitPhase = 'welcome'
    for (let s = 5; s < maxSeconds; s += 5) {
      const p = visitPhase(s, maxSeconds)
      if (p !== last) {
        last = p
        at(s, () => cue(p))
      }
    }
    // Make sure the goodbye happens even if the child is chatting away or silent.
    at(maxSeconds - goodbyeLead(maxSeconds), () => {
      cue('goodbye')
      responseRef.current.heardSince = true // our own goodbye is allowed to follow an answer
      send({ type: 'response.create', response: { instructions: goodbyeRef.current } })
    })
    at(maxSeconds + 3, () => finish('time_up'))
  }

  const start = useCallback(async () => {
    teardown()
    const attempt = attemptRef.current
    const cancelled = () => attemptRef.current !== attempt
    endedRef.current = false
    setMessage(null)
    setCaption('')
    setStatus('starting')
    // Created inside the tap so iOS lets it run (used to lip-sync the storybook Santa).
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        audioCtxRef.current = new Ctx()
        void audioCtxRef.current.resume()
        // It rings, like a real call, until Santa picks up.
        ringRef.current = { stop: startRingback(audioCtxRef.current), startedAt: performance.now() }
      }
    } catch {
      audioCtxRef.current = null
    }
    try {
      let mic: MediaStream
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      } catch {
        finish('mic_denied', 'Santa needs to hear you! Please allow the microphone in your browser, then try again.')
        return
      }
      if (cancelled()) return mic.getTracks().forEach((t) => t.stop())
      micRef.current = mic
      // Muted while it rings, so the ring tone can't reach Santa's ears and start him talking early.
      mic.getAudioTracks().forEach((t) => (t.enabled = false))

      const { avatarToken, maxSeconds } = await apiRef.current.begin()
      if (cancelled()) return

      const mode: Avatar = avatarToken ? 'simli' : 'local'
      setAvatar(mode)
      if (avatarToken) {
        const simli = new SimliClient(avatarToken, videoRef.current!, audioRef.current!, null, LogLevel.ERROR)
        simli.on('error', () => simliRef.current === simli && finish('provider_error', 'Santa’s connection to the North Pole was interrupted.'))
        simli.on('stop', () => simliRef.current === simli && finish('time_up'))
        simli.on('speaking', () => setSpeaking(true))
        simli.on('silent', () => setSpeaking(false))
        simliRef.current = simli
        await simli.start()
        if (cancelled()) return
      }
      setAvatarReady(true)

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      pc.ontrack = (e) => {
        if (pcRef.current !== pc || e.track.kind !== 'audio') return
        const stream = e.streams[0] ?? new MediaStream([e.track])
        if (mode === 'local') {
          // We play Santa's voice ourselves and analyse it for the mouth.
          const v = voiceRef.current
          if (v) {
            v.srcObject = stream
            v.play().catch(() => {})
          }
          setSantaStream(stream)
          return
        }
        const sink = sinkRef.current
        if (sink) {
          sink.muted = true
          sink.srcObject = stream
          sink.play().catch(() => {})
        }
        simliRef.current?.listenToMediastreamTrack(e.track)
      }
      pc.onconnectionstatechange = () => {
        if (pcRef.current === pc && pc.connectionState === 'failed') {
          finish('dropped', 'The call dropped. You can reconnect and Santa will carry on.')
        }
      }
      mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic))
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onopen = () => {
        // Let it ring at least two full rings, then Santa "picks up": ring stops, a soft chime, his face appears and he
        // speaks first (his first line is in the server-side instructions).
        const rang = ringRef.current ? (performance.now() - ringRef.current.startedAt) / 1000 : 99
        const wait = Math.max(0, RING_CYCLE_SECONDS * 2 - 0.4 - rang)
        timersRef.current.push(setTimeout(() => {
          if (cancelled() || dcRef.current !== dc) return
          ringRef.current?.stop()
          ringRef.current = null
          if (audioCtxRef.current) playPickup(audioCtxRef.current)
          micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current))
          send({ type: 'response.create' })
          apiRef.current.connected?.()
          schedulePhases(maxSeconds)
          liveRef.current = true
          setStatus('live')
        }, wait * 1000))
      }
      dc.onmessage = (e) => {
        let ev: RealtimeEvent
        try {
          ev = JSON.parse(e.data as string)
        } catch {
          return
        }
        // Guard: Santa must never start a second answer on top of one he is still giving without the child having
        // spoken in between (seen rarely right after the greeting: Santa repeated "Ho, ho, ho! Hello…"). Cancel it.
        if (ev.type === 'response.created' && ev.response?.id) {
          const r = responseRef.current
          if (r.active && !r.heardSince) send({ type: 'response.cancel', response_id: ev.response.id })
          else responseRef.current = { active: ev.response.id, heardSince: false }
        }
        if (ev.type === 'response.done' && ev.response?.id && ev.response.id === responseRef.current.active) responseRef.current = { active: null, heardSince: false }
        if (ev.type === 'input_audio_buffer.speech_started') responseRef.current.heardSince = true
        if (ev.type === 'input_audio_buffer.speech_started') {
          simliRef.current?.ClearBuffer() // barge-in
          setChildTalking(true)
        }
        if (ev.type === 'input_audio_buffer.speech_stopped') setChildTalking(false)
        if (mode === 'local' && ev.type === 'output_audio_buffer.started') setSpeaking(true)
        if (mode === 'local' && (ev.type === 'output_audio_buffer.stopped' || ev.type === 'output_audio_buffer.cleared')) setSpeaking(false)
        if (showCaptions && ev.type === 'response.output_audio_transcript.done' && ev.transcript) setCaption(ev.transcript)
        if (ev.type === 'error') console.warn('Santa voice error', ev.error?.code)
      }
      dc.onclose = () => dcRef.current === dc && finish('dropped', 'The call dropped. You can reconnect and Santa will carry on.')

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const answer = await apiRef.current.negotiate(offer.sdp ?? '')
      if (cancelled()) return
      await pc.setRemoteDescription({ type: 'answer', sdp: answer })
    } catch (err) {
      if (cancelled()) return
      const text = err instanceof Error ? err.message : ''
      finish(liveRef.current ? 'dropped' : 'no_connect', text && !/^[A-Z_]+:/.test(text) ? text : 'We couldn’t reach Santa just now. Please try again in a moment.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teardown, finish, showCaptions])

  useEffect(() => {
    const onHide = () => finish('dropped')
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      if (!endedRef.current) finish('dropped')
    }
  }, [finish])

  const toggleMute = () => {
    const next = !muted
    if (liveRef.current) micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
    mutedRef.current = next
    setMuted(next)
  }

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-[560px] flex-col overflow-hidden bg-[#0f2a1d] text-white">
      <div className="relative flex-1">
        {/* While connecting: Santa's portrait, softly blurred, so the screen is never empty. */}
        {avatar === 'simli' ? (
          <div aria-hidden className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-md" style={{ backgroundImage: 'url(/brands/holidays/art/santa-portrait.webp)' }} />
        ) : (
          (() => {
            const Look = look === 'photo' ? PhotoSanta : StorybookSanta
            return <Look stream={santaStream} audioContext={audioCtxRef.current} mode={santaMode(speaking, childTalking)} className={cn('absolute inset-0 h-full w-full transition-all duration-700', status === 'live' ? 'opacity-100' : 'scale-110 opacity-45 blur-md')} />
          })()
        )}
        {status !== 'live' && <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/60" />}
        <video ref={videoRef} autoPlay playsInline muted={false} className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', avatar === 'simli' && status === 'live' ? 'opacity-100' : 'opacity-0')} />
        <audio ref={audioRef} autoPlay />
        <audio ref={sinkRef} muted autoPlay hidden />
        <audio ref={voiceRef} autoPlay hidden />

        {status !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            {status === 'starting' && (
              <>
                <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#e9ac26]/40" />
                  <span className="absolute inset-3 animate-ping rounded-full bg-[#e9ac26]/30 [animation-delay:400ms]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brands/holidays/art/santa-live.webp" alt="" className="relative h-24 w-24 rounded-full object-cover object-[50%_28%] ring-4 ring-white" />
                </div>
                <p className="text-2xl font-extrabold" role="status">Calling Santa…</p>
                <p className="text-sm font-semibold text-white/70">Ringing the North Pole</p>
              </>
            )}
            {status === 'idle' && (
              <button onClick={start} className="rounded-full bg-[#d62634] px-8 py-4 text-lg font-extrabold shadow-lg active:scale-[0.98]">
                {startLabel}
              </button>
            )}
            {status === 'ended' && (
              <>
                <p className="text-lg font-bold" role="status">{message ?? 'Santa had to get back to the workshop. Merry Christmas!'}</p>
                <button onClick={start} className="rounded-full bg-white/15 px-6 py-3 font-bold">Call again</button>
              </>
            )}
          </div>
        )}

        {label && <span className="absolute left-3 top-3 rounded-full bg-[#e9ac26] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#3b1d00]">{label}</span>}
        {status === 'live' && (
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold" aria-live="polite">
            <span className={cn('h-2 w-2 rounded-full', speaking ? 'bg-[#e9ac26]' : 'bg-emerald-400')} />
            {speaking ? 'Santa is talking' : 'Santa is listening'}
          </span>
        )}
        {showCaptions && caption && status === 'live' && (
          <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/50 p-3 text-sm leading-snug">{caption}</p>
        )}
      </div>

      {status === 'live' && (
        <div className="flex items-center justify-center gap-6 bg-[#0d2619] px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
          <button onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} className={cn('flex h-14 w-14 items-center justify-center rounded-full', muted ? 'bg-white text-[#0f2a1d]' : 'bg-white/15')}>
            {muted ? <MicOff /> : <Mic />}
          </button>
          {confirmEnd ? (
            <div className="flex items-center gap-2">
              <button onClick={() => finish('parent_ended')} className="rounded-full bg-[#d62634] px-5 py-3 font-extrabold">End Santa’s visit</button>
              <button onClick={() => setConfirmEnd(false)} className="rounded-full bg-white/15 px-4 py-3 font-bold">Keep talking</button>
            </div>
          ) : (
            <button onClick={() => setConfirmEnd(true)} aria-label="End the call (grown-ups)" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d62634]">
              <PhoneOff />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
