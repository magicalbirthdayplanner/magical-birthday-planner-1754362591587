/**
 * Santa's live stack (docs/MAGICAL_HOLIDAYS_PROVIDER_COMPARISON.md, option A). SERVER ONLY.
 *
 *   Simli        — Santa's face, lip-synced to the voice. Browser connects with a short-lived session token.
 *   OpenAI       — listening + talking (Realtime, speech-to-speech) over WebRTC. The browser sends only its SDP offer;
 *                  this server attaches model, voice and Santa's instructions and returns the SDP answer.
 *
 * No API key ever reaches the browser. Media never passes through our servers.
 * Hard caps: Simli maxSessionLength (video) + OpenAI call hang-up by our server (reaper / end route).
 */
import 'server-only'

type Env = Record<string, string | undefined>

export const SIMLI_API = 'https://api.simli.ai'
export const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_SDP_BYTES = 64 * 1024
const CALL_ID = /^[A-Za-z0-9_-]{1,128}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Placeholder until the custom Santa face exists (a Simli preset, not Santa). Set SIMLI_FACE_ID to the Santa face. */
export const DEFAULT_SANTA_FACE_ID = '3bad681f-1b4a-4507-bc54-fbc675c191b7' // Simli preset "Victor" (older man, grey beard)
/** Simli preset faces usable as placeholders until the custom Santa face exists (docs.simli.com preset-faces). */
export const SIMLI_PLACEHOLDER_FACES = {
  hank: '9fcd5739-bf66-49a5-b525-d02d7f0bc2fc',
  victor: '3bad681f-1b4a-4507-bc54-fbc675c191b7',
  gearwright: 'd9c96b08-b2ca-48ef-b458-5c4471d9fe09',
  fred: 'c1cf7312-5b70-454b-a3c2-a0b0b7e32caf',
} as const
export type SimliPlaceholder = keyof typeof SIMLI_PLACEHOLDER_FACES

export const REALTIME_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'] as const

export type SantaAvatarKind = 'storybook' | 'simli'

export interface SantaRealtimeConfig {
  /** storybook = our animated Santa (no avatar vendor, default); simli = photoreal face. */
  avatar: SantaAvatarKind
  simliApiKey: string | null
  faceId: string
  openaiApiKey: string | null
  model: string
  voice: (typeof REALTIME_VOICES)[number]
}

export function santaRealtimeConfig(env: Env = process.env): SantaRealtimeConfig {
  const face = env.SIMLI_FACE_ID?.trim()
  const voice = env.SANTA_VOICE?.trim() as SantaRealtimeConfig['voice'] | undefined
  const model = env.SANTA_REALTIME_MODEL?.trim()
  return {
    avatar: env.SANTA_AVATAR?.trim() === 'simli' ? 'simli' : 'storybook',
    simliApiKey: env.SIMLI_API_KEY?.trim() || null,
    faceId: face && UUID.test(face) ? face : DEFAULT_SANTA_FACE_ID,
    openaiApiKey: env.SANTA_OPENAI_API_KEY?.trim() || null,
    model: model && /^[a-z0-9.-]{3,64}$/.test(model) ? model : 'gpt-realtime-mini',
    voice: voice && (REALTIME_VOICES as readonly string[]).includes(voice) ? voice : 'cedar',
  }
}

export class SantaUpstreamError extends Error {
  constructor(
    readonly service: 'simli' | 'openai',
    readonly code: 'not_configured' | 'unavailable' | 'rejected' | 'capacity' | 'bad_request',
    message: string,
  ) {
    super(message)
    this.name = 'SantaUpstreamError'
  }
}

// ---------------------------------------------------------------- Simli
export interface AvatarTokenOptions { maxSeconds: number; idleSeconds?: number; /** Override the configured face (placeholder testing). */ faceId?: string }

/** Short-lived Simli session token for one session, capped at maxSeconds (Simli ends the video there). */
export async function mintAvatarToken(opts: AvatarTokenOptions, cfg = santaRealtimeConfig(), fetchImpl: typeof fetch = fetch): Promise<string> {
  if (!cfg.simliApiKey) throw new SantaUpstreamError('simli', 'not_configured', 'SIMLI_API_KEY is not set')
  const body = {
    faceId: opts.faceId && UUID.test(opts.faceId) ? opts.faceId : cfg.faceId,
    // A few seconds of slack so Santa's goodbye (cued before the cap) is never cut mid-word.
    maxSessionLength: Math.max(15, Math.min(3600, Math.round(opts.maxSeconds + 10))),
    // Short: if the browser vanishes (tab closed, phone locked) Simli frees the slot quickly. While a call is live the
    // voice track keeps flowing (silence frames), so this does not cut a quiet child off.
    maxIdleTime: Math.max(20, Math.min(600, Math.round(opts.idleSeconds ?? 30))),
    handleSilence: true,
    streaming_width: 720,
    streaming_height: 1280,
  }
  let res: Response
  try {
    res = await fetchImpl(`${SIMLI_API}/compose/token`, {
      method: 'POST',
      headers: { 'x-simli-api-key': cfg.simliApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    throw new SantaUpstreamError('simli', 'unavailable', 'Simli unreachable')
  }
  const json = (await res.json().catch(() => null)) as { session_token?: string; detail?: unknown } | null
  if (!res.ok || !json?.session_token || json.session_token.length < 10) {
    const detail = typeof json?.detail === 'string' ? json.detail : ''
    const code = res.status === 402 || /minute|credit|quota/i.test(detail) ? 'capacity' : res.status >= 500 ? 'unavailable' : 'rejected'
    throw new SantaUpstreamError('simli', code, `Simli token ${res.status} ${detail}`.trim())
  }
  return json.session_token
}

// ---------------------------------------------------------------- OpenAI Realtime
export function isSdpOffer(s: string): boolean {
  return s.length > 0 && s.length <= MAX_SDP_BYTES && s.startsWith('v=0')
}

export interface RealtimeCallInput {
  offerSdp: string
  instructions: string
  /** Stable hashed id of the parent account (OpenAI safety identifier). Never an email. */
  safetyId: string
}

/** The session OpenAI runs. Everything here is decided by the server; the browser only sends its SDP offer. */
export function realtimeSession(instructions: string, cfg: SantaRealtimeConfig) {
  return {
    type: 'realtime',
    model: cfg.model,
    instructions,
    output_modalities: ['audio'],
    // Default model gpt-realtime-mini doesn't reason, so it never speaks a "preamble" (the gpt-realtime-2.x models add
    // filler like "let me take a look at my list and think…" before the real answer — heard as Santa talking twice,
    // even with reasoning off and a prompt against it; measured 2026-11-22). Reasoning models get the lowest effort.
    ...(cfg.model.startsWith('gpt-realtime-2') ? { reasoning: { effort: 'none' as const } } : {}),
    audio: {
      input: {
        noise_reduction: { type: 'far_field' },
        // Semantic VAD: medium replied ~1 s after the child stopped (low waited ~3 s, which felt laggy) — measured 2026-11-22.
        turn_detection: { type: 'semantic_vad', eagerness: 'medium', interrupt_response: true, create_response: true },
      },
      output: { voice: cfg.voice },
    },
  }
}

/** Create the OpenAI call from the browser's offer. Returns the SDP answer and the call id (for hang-up). */
export async function createRealtimeCall(input: RealtimeCallInput, cfg = santaRealtimeConfig(), fetchImpl: typeof fetch = fetch): Promise<{ answerSdp: string; callId: string }> {
  if (!cfg.openaiApiKey) throw new SantaUpstreamError('openai', 'not_configured', 'SANTA_OPENAI_API_KEY is not set')
  if (!isSdpOffer(input.offerSdp)) throw new SantaUpstreamError('openai', 'bad_request', 'not an SDP offer')
  const form = new FormData()
  form.set('sdp', input.offerSdp)
  form.set('session', JSON.stringify(realtimeSession(input.instructions, cfg)))
  let res: Response
  try {
    res = await fetchImpl(OPENAI_CALLS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.openaiApiKey}`, 'OpenAI-Safety-Identifier': input.safetyId },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    throw new SantaUpstreamError('openai', 'unavailable', 'OpenAI unreachable')
  }
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    // Never forward OpenAI's message (a 401 echoes part of the key).
    const code = res.status === 429 ? 'capacity' : res.status >= 500 ? 'unavailable' : 'rejected'
    throw new SantaUpstreamError('openai', code, `OpenAI calls ${res.status}`)
  }
  const callId = res.headers.get('location')?.split('/').pop() ?? ''
  if (!CALL_ID.test(callId) || !text.startsWith('v=0')) throw new SantaUpstreamError('openai', 'unavailable', 'OpenAI returned no call id / SDP')
  return { answerSdp: text, callId }
}

/** Hang up an OpenAI call. Idempotent: an already-ended call (404) is success. */
export async function hangupRealtimeCall(callId: string, cfg = santaRealtimeConfig(), fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!cfg.openaiApiKey || !CALL_ID.test(callId)) return false
  try {
    const res = await fetchImpl(`${OPENAI_CALLS_URL}/${encodeURIComponent(callId)}/hangup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.openaiApiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}
