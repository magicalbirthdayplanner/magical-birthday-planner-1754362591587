/**
 * POST /api/santa/children {id?, profile} — create or update a child (validated; editing clears approval in the DB).
 * DELETE /api/santa/children?id= — delete a child's details (parent data deletion).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { SantaChildProfileSchema } from '@/lib/santa/persona'
import { MAX_CHILDREN } from '@/lib/santa/server'

export const dynamic = 'force-dynamic'

const Body = z.object({ id: z.string().uuid().optional(), profile: SantaChildProfileSchema }).strict()

export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Santa isn’t available right now.')
  if (!rateLimit(`santa-child:${auth.user.id}`, 60, 3_600_000).ok) return apiError(429, 'rate_limited', 'Too many changes. Please try again later.')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, 'invalid_request', parsed.error.issues[0]?.message ?? 'Please check the details.')
  const { id, profile } = parsed.data
  const { firstName, age, ...rest } = profile
  const admin = getSupabaseAdmin()
  if (id) {
    const { data, error } = await admin.from('santa_children').update({ first_name: firstName, age, profile: rest }).eq('id', id).eq('user_id', auth.user.id).select('id').maybeSingle()
    if (error || !data) return apiError(404, 'not_found', 'Child not found.')
    return NextResponse.json({ id: data.id })
  }
  const { count } = await admin.from('santa_children').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id)
  if ((count ?? 0) >= MAX_CHILDREN) return apiError(400, 'invalid_request', `You can save up to ${MAX_CHILDREN} children.`)
  const { data, error } = await admin.from('santa_children').insert({ user_id: auth.user.id, first_name: firstName, age, profile: rest }).select('id').single()
  if (error || !data) return apiError(500, 'server_error', 'Could not save. Please try again.')
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!hasServiceRole()) return apiError(503, 'not_configured', 'Santa isn’t available right now.')
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!z.string().uuid().safeParse(id).success) return apiError(400, 'invalid_request', 'Missing child.')
  await getSupabaseAdmin().from('santa_children').delete().eq('id', id).eq('user_id', auth.user.id)
  return NextResponse.json({ ok: true })
}
