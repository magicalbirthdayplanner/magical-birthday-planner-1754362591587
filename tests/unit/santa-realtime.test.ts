import { describe, expect, it, vi } from 'vitest'
import { createRealtimeCall, DEFAULT_SANTA_FACE_ID, hangupRealtimeCall, mintAvatarToken, realtimeSession, santaRealtimeConfig, SantaUpstreamError } from '@/lib/santa/realtime'
import { sessionInstructions } from '@/lib/santa/instructions'
import { SantaChildProfileSchema } from '@/lib/santa/persona'

const cfg = santaRealtimeConfig({ SIMLI_API_KEY: 'simli-key', SANTA_OPENAI_API_KEY: 'sk-test' })
const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n'

describe('config', () => {
  it('defaults: preset face, mini realtime model, cedar voice; rejects junk overrides', () => {
    expect(santaRealtimeConfig({})).toMatchObject({ avatar: 'storybook', simliApiKey: null, openaiApiKey: null, faceId: DEFAULT_SANTA_FACE_ID, model: 'gpt-realtime-mini', voice: 'cedar' })
    expect(santaRealtimeConfig({ SIMLI_FACE_ID: 'not-a-uuid', SANTA_VOICE: 'robot', SANTA_REALTIME_MODEL: 'x y' })).toMatchObject({ faceId: DEFAULT_SANTA_FACE_ID, voice: 'cedar', model: 'gpt-realtime-mini' })
  })
})

describe('avatar choice', () => {
  it('storybook Santa by default (no avatar vendor); simli only when asked', () => {
    expect(santaRealtimeConfig({ SIMLI_API_KEY: 'k' }).avatar).toBe('storybook')
    expect(santaRealtimeConfig({ SANTA_AVATAR: 'simli' }).avatar).toBe('simli')
    expect(santaRealtimeConfig({ SANTA_AVATAR: 'other' }).avatar).toBe('storybook')
  })
})

describe('Simli token', () => {
  it('sends the key only in the header and caps the session length', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ session_token: 'trinity2_abcdefghijk', warnings: [] }), { status: 200 }))
    expect(await mintAvatarToken({ maxSeconds: 600 }, cfg, f as unknown as typeof fetch)).toBe('trinity2_abcdefghijk')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.simli.ai/compose/token')
    expect((init.headers as Record<string, string>)['x-simli-api-key']).toBe('simli-key')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ faceId: DEFAULT_SANTA_FACE_ID, maxSessionLength: 610, maxIdleTime: 30, handleSilence: true })
    expect(JSON.stringify(body)).not.toContain('simli-key')
  })

  it('maps failures without leaking upstream text', async () => {
    await expect(mintAvatarToken({ maxSeconds: 60 }, santaRealtimeConfig({}))).rejects.toMatchObject({ code: 'not_configured' })
    const out = vi.fn(async () => new Response(JSON.stringify({ detail: 'No minutes left' }), { status: 400 }))
    await expect(mintAvatarToken({ maxSeconds: 60 }, cfg, out as unknown as typeof fetch)).rejects.toMatchObject({ service: 'simli', code: 'capacity' })
    const down = vi.fn(async () => { throw new TypeError('fetch failed') })
    await expect(mintAvatarToken({ maxSeconds: 60 }, cfg, down as unknown as typeof fetch)).rejects.toBeInstanceOf(SantaUpstreamError)
  })
})

describe('OpenAI realtime call', () => {
  const profile = SantaChildProfileSchema.parse({ firstName: 'Emma', age: 6, loves: ['dinosaurs'] })

  it('server decides model, voice and instructions; returns the SDP answer and call id', async () => {
    const f = vi.fn(async () => new Response('v=0\r\nanswer', { status: 201, headers: { Location: '/v1/realtime/calls/rtc_abc123' } }))
    const r = await createRealtimeCall({ offerSdp: OFFER, instructions: sessionInstructions(profile, 'visit'), safetyId: 'h' }, cfg, f as unknown as typeof fetch)
    expect(r).toEqual({ answerSdp: 'v=0\r\nanswer', callId: 'rtc_abc123' })
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    const form = init.body as FormData
    expect(form.get('sdp')).toBe(OFFER)
    const session = JSON.parse(form.get('session') as string)
    expect(session).toMatchObject({ model: 'gpt-realtime-mini', audio: { output: { voice: 'cedar' } } })
    expect(session.instructions).toContain('Your very first words in this call must be: "Ho, ho, ho! Hello, Emma!')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
  })

  it('refuses non-SDP input and missing call ids; never forwards OpenAI error text', async () => {
    await expect(createRealtimeCall({ offerSdp: 'hello', instructions: 'x', safetyId: 'h' }, cfg)).rejects.toMatchObject({ code: 'bad_request' })
    const noLoc = vi.fn(async () => new Response('v=0', { status: 201 }))
    await expect(createRealtimeCall({ offerSdp: OFFER, instructions: 'x', safetyId: 'h' }, cfg, noLoc as unknown as typeof fetch)).rejects.toMatchObject({ code: 'unavailable' })
    const unauthorized = vi.fn(async () => new Response('{"error":{"message":"Incorrect API key sk-te****"}}', { status: 401 }))
    const err = await createRealtimeCall({ offerSdp: OFFER, instructions: 'x', safetyId: 'h' }, cfg, unauthorized as unknown as typeof fetch).catch((e) => e)
    expect(err.message).not.toContain('sk-te')
  })

  it('semantic turn detection (medium eagerness: ~1 s after the child stops) and barge-in', () => {
    expect(realtimeSession('x', cfg).audio.input.turn_detection).toMatchObject({ type: 'semantic_vad', eagerness: 'medium', interrupt_response: true })
  })

  it('uses a non-reasoning model by default (no filler "preambles"); reasoning models get effort none', () => {
    expect(realtimeSession('x', cfg)).not.toHaveProperty('reasoning')
    expect(realtimeSession('x', santaRealtimeConfig({ SANTA_REALTIME_MODEL: 'gpt-realtime-2.1-mini' }))).toMatchObject({ reasoning: { effort: 'none' } })
  })

  it('hang-up treats an already-ended call as success', async () => {
    const gone = vi.fn(async () => new Response('', { status: 404 }))
    expect(await hangupRealtimeCall('rtc_abc', cfg, gone as unknown as typeof fetch)).toBe(true)
    expect(await hangupRealtimeCall('bad id!', cfg)).toBe(false)
  })
})
