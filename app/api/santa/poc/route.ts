/**
 * POST /api/santa/poc — proof of concept for the live Santa call (Simli + OpenAI Realtime). NOT the product route.
 *
 *   {action:'begin', profile, kind, maxSeconds, avatar?} → {avatarToken | null, maxSeconds}  (null = storybook Santa)
 *   {action:'negotiate', profile, kind, maxSeconds, sdp} → {answerSdp, callId}
 *   {action:'end', callId}                           → {ok}
 *
 * Available in development, or in production only with SANTA_POC_ENABLED=true AND a Super Admin session.
 * No ledger, no purchase: the product flow (/api/santa/sessions) replaces this. Nothing about the child is stored.
 */
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/server/admin'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { SantaChildProfileSchema } from '@/lib/santa/persona'
import { sessionInstructions } from '@/lib/santa/instructions'
import { createRealtimeCall, hangupRealtimeCall, mintAvatarToken, santaRealtimeConfig, SantaUpstreamError, SIMLI_PLACEHOLDER_FACES, type SimliPlaceholder } from '@/lib/santa/realtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Kind = z.enum(['visit', 'preview']).default('visit')
const Seconds = z.number().int().min(30).max(600).default(180)
const Avatar = z.enum(['storybook', 'simli']).optional()
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin'), profile: SantaChildProfileSchema, kind: Kind, maxSeconds: Seconds, avatar: Avatar, face: z.enum(Object.keys(SIMLI_PLACEHOLDER_FACES) as [SimliPlaceholder, ...SimliPlaceholder[]]).optional() }),
  z.object({ action: z.literal('negotiate'), profile: SantaChildProfileSchema, kind: Kind, maxSeconds: Seconds, sdp: z.string().min(10).max(64 * 1024) }),
  z.object({ action: z.literal('end'), callId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }),
])

async function guard(req: Request): Promise<{ who: string } | { error: Response }> {
  if (process.env.NODE_ENV !== 'production') return { who: `dev:${clientIp(req)}` }
  if (process.env.SANTA_POC_ENABLED !== 'true') return { error: apiError(404, 'not_found', 'Not found.') }
  const admin = await requireSuperAdmin(req)
  return admin.error ? { error: admin.error } : { who: `user:${admin.auth.user.id}` }
}

export async function POST(req: Request) {
  const g = await guard(req)
  if ('error' in g) return g.error
  const rl = rateLimit(`santa-poc:${g.who}`, 40, 3_600_000)
  if (!rl.ok) return apiError(429, 'rate_limited', 'Too many test calls. Try again later.')

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Please check the child’s details.')
  const b = parsed.data
  const safetyId = createHash('sha256').update(`santa:${g.who}`).digest('hex').slice(0, 32)

  try {
    if (b.action === 'begin') {
      // Storybook Santa needs no avatar vendor: no token.
      const avatar = b.avatar ?? santaRealtimeConfig().avatar
      const avatarToken = avatar === 'simli' ? await mintAvatarToken({ maxSeconds: b.maxSeconds, faceId: b.face ? SIMLI_PLACEHOLDER_FACES[b.face] : undefined }) : null
      return NextResponse.json({ avatarToken, maxSeconds: b.maxSeconds })
    }
    if (b.action === 'negotiate') {
      const { answerSdp, callId } = await createRealtimeCall({ offerSdp: b.sdp, instructions: sessionInstructions(b.profile, b.kind), safetyId })
      // Development backstop only (long-lived `next dev`); the product uses the reaper.
      if (process.env.NODE_ENV !== 'production') setTimeout(() => void hangupRealtimeCall(callId), (b.maxSeconds + 30) * 1000).unref?.()
      return NextResponse.json({ answerSdp, callId })
    }
    return NextResponse.json({ ok: await hangupRealtimeCall(b.callId) })
  } catch (err) {
    if (err instanceof SantaUpstreamError) {
      console.warn('[santa-poc]', err.service, err.code)
      if (err.code === 'not_configured') return apiError(503, 'not_configured', `Santa is not configured yet (${err.service === 'simli' ? 'SIMLI_API_KEY' : 'SANTA_OPENAI_API_KEY'} missing).`)
      if (err.code === 'capacity') return apiError(503, 'quota', 'Santa is very busy right now. Please try again in a few minutes.')
      return apiError(502, 'server_error', 'We couldn’t reach Santa just now. Please try again.')
    }
    throw err
  }
}
