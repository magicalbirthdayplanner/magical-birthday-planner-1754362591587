import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/server/admin'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { reportError } from '@/lib/observability/telemetry'
import { adminContext, deletePost, postAction, type ActionResult } from '@/lib/marketing/admin'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Id = z.string().uuid()
const Body = z
  .object({
    action: z.enum(['approve', 'schedule', 'publish_now', 'cancel', 'edit', 'regenerate', 'link_external']),
    at: z.string().max(40).optional(),
    text: z.string().max(4000).optional(),
    url: z.string().max(300).optional(),
    confirmNotPosted: z.boolean().optional(),
  })
  .strict()

function respond(r: ActionResult) {
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: { code: r.status === 404 ? 'not_found' : 'invalid_request', message: r.message }, detail: r.detail }, { status: r.status })
}

/** POST /api/admin/marketing/posts/:id { action, … } — approve · schedule · publish_now · cancel · edit · regenerate · link_external. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  const { id } = await props.params
  if (!Id.safeParse(id).success) return apiError(404, 'not_found', 'Not found.')
  if (!rateLimit(`admin-marketing-post:${auth.user.id}`, 60, 10 * 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests. Try again in a few minutes.')
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return apiError(400, 'invalid_request', 'Invalid request.')
  }
  try {
    return respond(await postAction(adminContext(auth.user.id), id, body))
  } catch (e) {
    reportError(e, { area: 'api', op: `marketing_post_${body.action}`, level: 'error' })
    return apiError(500, 'server_error', 'Something went wrong.')
  }
}

/** DELETE /api/admin/marketing/posts/:id — delete a draft or cancelled post (and its image). */
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  const { id } = await props.params
  if (!Id.safeParse(id).success) return apiError(404, 'not_found', 'Not found.')
  try {
    return respond(await deletePost(adminContext(auth.user.id), id))
  } catch (e) {
    reportError(e, { area: 'api', op: 'marketing_post_delete', level: 'error' })
    return apiError(500, 'server_error', 'Something went wrong.')
  }
}
