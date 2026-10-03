import { NextResponse } from 'next/server'
import { reportDbError } from '@/lib/observability/telemetry'
import { z } from 'zod'
import { ADMIN_PLANS, OVERRIDE_DURATIONS, requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getUserPlan } from '@/lib/billing/server'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

const SetBody = z.object({ userId: z.string().uuid(), plan: z.enum(ADMIN_PLANS), duration: z.enum(['24h', '7d', '30d', 'none']) }).strict()
const RemoveBody = z.object({ userId: z.string().uuid() }).strict()

/**
 * POST /api/admin/override { userId, plan, duration } — set/replace an admin plan override.
 * DELETE /api/admin/override { userId } — remove it (normal billing/trial state resumes).
 * Super Admin only. Never touches billing tables; every change is audited.
 */
export async function POST(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  if (!rateLimit(`admin-override:${auth.user.id}`, 60, 60_000).ok) return apiError(429, 'rate_limited', 'Too many changes. Try again shortly.')
  let body: z.infer<typeof SetBody>
  try {
    body = SetBody.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Choose a user, plan and duration.')
  }
  const admin = getSupabaseAdmin()
  const { data: target } = await admin.from('users').select('id, email').eq('id', body.userId).maybeSingle()
  if (!target) return apiError(404, 'not_found', 'User not found.')
  const before = await getUserPlan(admin, body.userId)
  const ms = OVERRIDE_DURATIONS[body.duration]
  const expiresAt = ms == null ? null : new Date(Date.now() + ms).toISOString()
  const { error: upErr } = await admin
    .from('plan_overrides')
    .upsert({ user_id: body.userId, plan: body.plan, expires_at: expiresAt, set_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (upErr) {
    reportDbError('admin_override_save', upErr)
    return apiError(500, 'server_error', 'Could not save the override.')
  }
  await admin.rpc('recompute_entitlement', { p_user: body.userId })
  await admin.from('admin_audit_log').insert({
    admin_user_id: auth.user.id,
    target_user_id: body.userId,
    target_email: target.email,
    action: before.override ? 'override_changed' : 'override_set',
    old_plan: before.plan,
    new_plan: body.plan,
    override_expires_at: expiresAt,
  })
  return NextResponse.json({ user: { id: body.userId, ...(await getUserPlan(admin, body.userId)) } })
}

export async function DELETE(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  let body: z.infer<typeof RemoveBody>
  try {
    body = RemoveBody.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Choose a user.')
  }
  const admin = getSupabaseAdmin()
  const { data: target } = await admin.from('users').select('id, email').eq('id', body.userId).maybeSingle()
  if (!target) return apiError(404, 'not_found', 'User not found.')
  const before = await getUserPlan(admin, body.userId)
  if (!before.override) return NextResponse.json({ user: { id: body.userId, ...before } })
  await admin.from('plan_overrides').delete().eq('user_id', body.userId)
  await admin.rpc('recompute_entitlement', { p_user: body.userId })
  const after = await getUserPlan(admin, body.userId)
  await admin.from('admin_audit_log').insert({ admin_user_id: auth.user.id, target_user_id: body.userId, target_email: target.email, action: 'override_removed', old_plan: before.plan, new_plan: after.plan })
  return NextResponse.json({ user: { id: body.userId, ...after } })
}
