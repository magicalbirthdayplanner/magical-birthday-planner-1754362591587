import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { rateLimit } from '@/lib/server/rate-limit'
import { aiError } from '@/lib/ai/errors'
import { ApplyBody, applyItem, undoItem } from '@/lib/ai/apply'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** POST /api/ai/apply { generationId, itemId, target, edits? } — the item is read from the stored generation. */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return aiError('unauthenticated')
  if (!rateLimit(`ai-apply:${auth.user.id}`, 60, 60_000).ok) return aiError('high_demand', {}, 'Slow down a little — try again in a moment.')
  let body: z.infer<typeof ApplyBody>
  try {
    body = ApplyBody.parse(await req.json())
  } catch {
    return aiError('invalid_input')
  }
  const r = await applyItem(auth.supabase, auth.user.id, body)
  if (r.status === 'error') return aiError(r.code === 'not_found' ? 'not_found' : r.code === 'invalid_input' ? 'invalid_input' : 'provider_error', {}, r.message)
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}

const UndoBody = ApplyBody.pick({ generationId: true, itemId: true, target: true }).strict()

/** DELETE /api/ai/apply { generationId, itemId, target } — undo the last apply of that item. */
export async function DELETE(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return aiError('unauthenticated')
  let body: z.infer<typeof UndoBody>
  try {
    body = UndoBody.parse(await req.json())
  } catch {
    return aiError('invalid_input')
  }
  const ok = await undoItem(auth.supabase, body)
  return ok ? NextResponse.json({ status: 'undone' }) : aiError('not_found', {}, 'Nothing to undo.')
}
