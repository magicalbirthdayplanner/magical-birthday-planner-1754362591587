import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { apiError } from '@/lib/server/http'
import { reportDbError } from '@/lib/observability/telemetry'
import { eventDetail, eventLabel, type EventRow } from '@/lib/admin/insights'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIMIT = 1500

/**
 * GET /api/admin/insights/timeline?userId=… | ?device=… → one person's or one browser's full activity, oldest first
 * (Super Admin only). For a user it also includes everything their browsers did BEFORE they signed in, their AI
 * requests (feature, outcome, error) and the emails sent to them.
 */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const params = new URL(req.url).searchParams
  const userId = params.get('userId')
  const device = params.get('device')
  if (!(userId && UUID.test(userId)) && !(device && UUID.test(device))) return apiError(400, 'invalid_request', 'Pass a userId or device.')
  const admin = getSupabaseAdmin()
  const cols = 'event, user_id, anonymous_id, party_id, properties, path, created_at'
  try {
    let devices: string[] = device ? [device] : []
    if (userId) {
      const { data, error: e } = await admin.from('analytics_events').select('anonymous_id').eq('user_id', userId).not('anonymous_id', 'is', null).limit(5000)
      if (e) throw e
      devices = [...new Set((data ?? []).map((r) => r.anonymous_id as string))]
    }
    const queries = [
      devices.length ? admin.from('analytics_events').select(cols).in('anonymous_id', devices).order('created_at', { ascending: false }).limit(LIMIT) : null,
      userId ? admin.from('analytics_events').select(cols).eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT) : null,
    ].filter(Boolean)
    const results = await Promise.all(queries)
    const seen = new Set<string>()
    const rows: EventRow[] = []
    for (const r of results) {
      if (r!.error) throw r!.error
      for (const e of (r!.data ?? []) as EventRow[]) {
        const key = `${e.created_at}|${e.event}|${e.anonymous_id}|${e.path}|${JSON.stringify(e.properties)}`
        if (!seen.has(key)) {
          seen.add(key)
          rows.push(e)
        }
      }
    }
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at))

    let ai: { feature: string; status: string; error_code: string | null; provider: string | null; model: string | null; duration_ms: number | null; created_at: string }[] = []
    let emails: { email_type: string | null; subject: string | null; status: string | null; error_message: string | null; created_at: string | null }[] = []
    if (userId) {
      const [{ data: a }, { data: u }] = await Promise.all([
        admin.from('ai_generations').select('feature, status, error_code, provider, model, duration_ms, created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(500),
        admin.auth.admin.getUserById(userId),
      ])
      ai = a ?? []
      const email = u?.user?.email
      const { data: m } = await admin
        .from('email_logs')
        .select('email_type, subject, status, error_message, created_at')
        .or(email ? `user_id.eq.${userId},recipient_email.eq.${email.replace(/[,()]/g, '')}` : `user_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(200)
      emails = m ?? []
    }

    return NextResponse.json({
      devices: devices.length,
      truncated: results.some((r) => (r!.data?.length ?? 0) >= LIMIT),
      events: rows.map((e) => ({ at: e.created_at, event: e.event, label: eventLabel(e.event), detail: eventDetail(e), path: e.path, signedIn: !!e.user_id, device: e.anonymous_id ? e.anonymous_id.slice(0, 6) : null })),
      ai,
      emails,
    })
  } catch (err) {
    reportDbError('admin_insights_timeline', err as { code?: string })
    return apiError(500, 'server_error', 'Could not load the activity.')
  }
}
