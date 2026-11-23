/**
 * Santa calls & previews — server orchestration over the ledger RPCs (migration 20251122002400). SERVER ONLY.
 * Paid calls: the signed-in parent; ownership re-checked here. Free previews: anonymous, authorised by a random
 * per-session secret the browser holds (only its hash is stored), limited per client (daily-salted IP hash).
 */
import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'
import { SantaChildProfileSchema, SANTA_PROMPT_VERSION, type SantaChildProfile } from './persona'
import { SANTA_NOTICE_VERSION } from './consent'
import { sessionInstructions } from './instructions'
import { createRealtimeCall, hangupRealtimeCall, mintAvatarToken, santaRealtimeConfig } from './realtime'

type Admin = SupabaseClient<Database>
type SessionRow = Database['public']['Tables']['santa_sessions']['Row']

export const MAX_CHILDREN = 6

export type StartError = 'calls_disabled' | 'previews_disabled' | 'session_in_progress' | 'child_not_found' | 'consent_required' | 'not_approved' | 'capacity' | 'daily_cap' | 'no_credit' | 'preview_limit'

/** Parent-facing copy for ledger refusals. */
export const START_ERROR_COPY: Record<StartError, { status: number; message: string }> = {
  calls_disabled: { status: 503, message: 'Santa is taking a short break at the workshop. Please try again in a little while.' },
  previews_disabled: { status: 503, message: 'Free previews are paused right now — but you can still book a real call with Santa.' },
  session_in_progress: { status: 409, message: 'A call with Santa is already open. End it first, or wait a minute and try again.' },
  child_not_found: { status: 404, message: 'We couldn’t find that child’s details.' },
  consent_required: { status: 403, message: 'Please confirm the parent notice first.' },
  not_approved: { status: 403, message: 'Please check and approve your child’s details first.' },
  capacity: { status: 503, message: 'Santa is talking to lots of children right now! Please try again in a few minutes.' },
  daily_cap: { status: 503, message: 'Santa is very busy today. Please try again a little later.' },
  no_credit: { status: 402, message: 'Add some time with Santa to start the call.' },
  preview_limit: { status: 429, message: 'You’ve used today’s free previews. Book a real call and Santa will talk for longer!' },
}

const errorCode = (message: string | undefined): StartError | null => (Object.keys(START_ERROR_COPY) as StartError[]).find((c) => message?.includes(c)) ?? null

export const safetyIdFor = (who: string) => createHash('sha256').update(`santa:${who}`).digest('hex').slice(0, 32)
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Daily-salted hash of the client address: limits previews without storing an IP. */
export function clientHash(ip: string, now = new Date()): string {
  const salt = process.env.SANTA_PREVIEW_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'santa'
  return sha256(`${salt}|${now.toISOString().slice(0, 10)}|${ip}`)
}

export function profileFromRow(row: { first_name: string; age: number; profile: unknown }): SantaChildProfile | null {
  const p = SantaChildProfileSchema.safeParse({ ...(row.profile as object), firstName: row.first_name, age: row.age })
  return p.success ? p.data : null
}

const providerLabel = () => (santaRealtimeConfig().avatar === 'simli' ? 'simli_openai' : 'openai')

async function withAvatar(admin: Admin, session: SessionRow) {
  try {
    const avatarToken = santaRealtimeConfig().avatar === 'simli' ? await mintAvatarToken({ maxSeconds: session.max_seconds }) : null
    return avatarToken
  } catch (err) {
    await endSession(admin, session.id, 'failed', 'provider_error')
    throw err
  }
}

// ---------------------------------------------------------------- paid call
/**
 * Stale sessions (never connected / ran past their cap) hold concurrency slots. The daily cron cleans up too (Vercel
 * Hobby allows only daily crons), so every new start first clears any stale ones — usually a single empty query.
 */
async function reapStale(admin: Admin) {
  try {
    await reap(admin)
  } catch {
    /* never block a start on cleanup */
  }
}

export async function startCall(admin: Admin, userId: string, childId: string) {
  await reapStale(admin)
  const { data, error } = await admin.rpc('santa_start_session', {
    p_user: userId, p_child: childId, p_notice_version: SANTA_NOTICE_VERSION, p_provider: providerLabel(), p_prompt_version: SANTA_PROMPT_VERSION,
  })
  if (error) return { ok: false as const, error: errorCode(error.message) }
  const session = data as unknown as SessionRow
  return { ok: true as const, session, avatarToken: await withAvatar(admin, session) }
}

// ---------------------------------------------------------------- free preview (no sign-up)
export async function startPreview(admin: Admin, ip: string) {
  await reapStale(admin)
  const token = randomBytes(24).toString('base64url')
  const { data, error } = await admin.rpc('santa_start_preview', { p_client_hash: clientHash(ip), p_token_hash: sha256(token), p_provider: providerLabel(), p_prompt_version: SANTA_PROMPT_VERSION })
  if (error) return { ok: false as const, error: errorCode(error.message) }
  const session = data as unknown as SessionRow
  return { ok: true as const, session, previewToken: token, avatarToken: await withAvatar(admin, session) }
}

async function previewSession(admin: Admin, sessionId: string, token: string) {
  const { data: s } = await admin.from('santa_sessions').select('id, kind, status, preview_token_hash').eq('id', sessionId).maybeSingle()
  if (!s || s.kind !== 'preview' || !s.preview_token_hash) return null
  const a = Buffer.from(s.preview_token_hash)
  const b = Buffer.from(sha256(token))
  return a.length === b.length && timingSafeEqual(a, b) ? s : null
}

// ---------------------------------------------------------------- shared lifecycle
async function connect(admin: Admin, sessionId: string, offerSdp: string, profile: SantaChildProfile, kind: 'visit' | 'preview', safetyId: string) {
  try {
    const { answerSdp, callId } = await createRealtimeCall({ offerSdp, instructions: sessionInstructions(profile, kind), safetyId })
    const { error } = await admin.rpc('santa_attach_session', { p_session: sessionId, p_provider_session: callId })
    if (error) {
      await hangupRealtimeCall(callId)
      return { ok: false as const }
    }
    // Time counts from the moment OpenAI accepted the call — never from a browser report.
    await admin.rpc('santa_mark_connected', { p_session: sessionId, p_at: new Date().toISOString() })
    return { ok: true as const, answerSdp }
  } catch (err) {
    await endSession(admin, sessionId, 'failed', 'provider_error')
    throw err
  }
}

/** Paid call: exchange the browser's SDP offer for OpenAI's answer, with the child's approved details. */
export async function negotiate(admin: Admin, userId: string, sessionId: string, offerSdp: string) {
  const { data: s } = await admin.from('santa_sessions').select('id, user_id, child_id, kind, status').eq('id', sessionId).maybeSingle()
  if (!s || s.user_id !== userId || s.kind !== 'call' || s.status !== 'reserved' || !s.child_id) return { ok: false as const }
  const { data: child } = await admin.from('santa_children').select('first_name, age, profile').eq('id', s.child_id).eq('user_id', userId).maybeSingle()
  const profile = child ? profileFromRow(child) : null
  if (!profile) return { ok: false as const }
  return connect(admin, sessionId, offerSdp, profile, 'visit', safetyIdFor(userId))
}

/** Preview: the name (optional) is used for this call only and never stored. */
export async function negotiatePreview(admin: Admin, sessionId: string, token: string, offerSdp: string, firstName: string | null, ip: string) {
  const s = await previewSession(admin, sessionId, token)
  if (!s || s.status !== 'reserved') return { ok: false as const }
  const profile = SantaChildProfileSchema.safeParse({ firstName: firstName || 'friend', age: 6 })
  if (!profile.success) return { ok: false as const }
  return connect(admin, sessionId, offerSdp, profile.data, 'preview', safetyIdFor(`preview:${clientHash(ip)}`))
}

export async function endPreview(admin: Admin, sessionId: string, token: string, reason: string) {
  const s = await previewSession(admin, sessionId, token)
  if (!s) return false
  await endSession(admin, sessionId, reason === 'no_connect' || reason === 'mic_denied' || reason === 'provider_error' ? 'failed' : 'ended', reason)
  return true
}

export async function markConnected(admin: Admin, userId: string, sessionId: string) {
  const { data: s } = await admin.from('santa_sessions').select('user_id').eq('id', sessionId).maybeSingle()
  if (!s || s.user_id !== userId) return false
  await admin.rpc('santa_mark_connected', { p_session: sessionId, p_at: new Date().toISOString() })
  return true
}

const ENDED_REASONS = new Set(['parent_ended', 'time_up', 'dropped', 'provider_error', 'no_connect', 'reaped', 'mic_denied'])

/** End at OpenAI (hang up) and settle in the ledger. Idempotent. */
export async function endSession(admin: Admin, sessionId: string, status: 'ended' | 'failed', reason: string) {
  const { data: s } = await admin.from('santa_sessions').select('provider_session_id').eq('id', sessionId).maybeSingle()
  if (s?.provider_session_id) await hangupRealtimeCall(s.provider_session_id)
  const r = ENDED_REASONS.has(reason) ? reason : 'dropped'
  const { data } = await admin.rpc('santa_end_session', { p_session: sessionId, p_status: status, p_ended_at: new Date().toISOString(), p_reason: r, p_billed_seconds: null as never, p_cost_cents: null as never })
  return data
}

export async function endOwnSession(admin: Admin, userId: string, sessionId: string, reason: string) {
  const { data: s } = await admin.from('santa_sessions').select('user_id').eq('id', sessionId).maybeSingle()
  if (!s || s.user_id !== userId) return false
  const failed = reason === 'no_connect' || reason === 'mic_denied' || reason === 'provider_error'
  await endSession(admin, sessionId, failed ? 'failed' : 'ended', reason)
  return true
}

/** Cron: end stale sessions at the provider and settle them. */
export async function reap(admin: Admin) {
  const { data: stale } = await admin.rpc('santa_stale_sessions')
  let ended = 0
  for (const s of (stale ?? []) as Array<{ id: string; status: string }>) {
    await endSession(admin, s.id, s.status === 'active' ? 'ended' : 'failed', s.status === 'active' ? 'reaped' : 'no_connect')
    ended++
  }
  return { ended }
}

export { SANTA_NOTICE_VERSION }
