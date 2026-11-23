/** GET /api/cron/santa (Vercel Cron, every minute): end stale Santa sessions at the provider and settle them. */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { reap } from '@/lib/santa/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 16) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!hasServiceRole()) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  return NextResponse.json(await reap(getSupabaseAdmin()))
}
