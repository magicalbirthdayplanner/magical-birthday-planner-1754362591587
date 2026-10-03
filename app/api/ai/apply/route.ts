import { NextResponse } from 'next/server'
import { getAuthedRequest } from '@/lib/server/auth'
import { rateLimit } from '@/lib/server/rate-limit'
import { aiError } from '@/lib/ai/errors'
import { readJsonBody } from '@/lib/ai/handler'
import { ApplyBody, ApplyManyBody, applyItem, undoItem } from '@/lib/ai/apply'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * POST /api/ai/apply { generationId, itemId, target, edits? } — the item is read from the stored generation.
 * POST /api/ai/apply { generationId, target, itemIds[] } — "Add all" (duplicates are skipped, never overwritten).
 */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return aiError('unauthenticated')
  if (!rateLimit(`ai-apply:${auth.user.id}`, 60, 60_000).ok) return aiError('high_demand', {}, 'Slow down a little — try again in a moment.')
  const raw = await readJsonBody(req)
  const many = ApplyManyBody.safeParse(raw)
  if (many.success) {
    let added = 0, skipped = 0
    for (const itemId of new Set(many.data.itemIds)) {
      const r = await applyItem(auth.supabase, auth.user.id, { generationId: many.data.generationId, target: many.data.target, itemId })
      if (r.status === 'applied') added++
      else if (r.status === 'error' && r.code !== 'invalid_input') return aiError(r.code === 'not_found' ? 'not_found' : 'provider_error', { added }, r.message)
      else skipped++
    }
    return NextResponse.json({ status: 'applied_many', added, skipped }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const one = ApplyBody.safeParse(raw)
  if (!one.success) return aiError('invalid_input')
  const r = await applyItem(auth.supabase, auth.user.id, one.data)
  if (r.status === 'error') return aiError(r.code === 'not_found' ? 'not_found' : r.code === 'invalid_input' ? 'invalid_input' : 'provider_error', {}, r.message)
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}

const UndoBody = ApplyBody.pick({ generationId: true, itemId: true, target: true }).strict()

/** DELETE /api/ai/apply { generationId, itemId, target } — undo the last apply of that item (once). */
export async function DELETE(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return aiError('unauthenticated')
  const body = UndoBody.safeParse(await readJsonBody(req))
  if (!body.success) return aiError('invalid_input')
  const ok = await undoItem(auth.supabase, body.data)
  return ok ? NextResponse.json({ status: 'undone' }) : aiError('not_found', {}, 'Nothing to undo.')
}
