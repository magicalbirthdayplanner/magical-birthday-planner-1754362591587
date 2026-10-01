/** Server-side analytics & operational metrics. Never throws, never blocks a response. SERVER ONLY. */
import 'server-only'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import type { Json } from '@/lib/db/database.types'

export interface ServerEventContext {
  userId?: string | null
  partyId?: string | null
  path?: string
}

export function logMetric(name: string, props: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test') return
  // Structured log line: picked up by Vercel/hosting log drains.
  console.info(JSON.stringify({ level: 'info', type: 'metric', name, ...props }))
}

export function trackServer(event: string, properties: Record<string, unknown>, ctx: ServerEventContext = {}): void {
  logMetric(event, { ...properties, userId: ctx.userId ?? undefined })
  if (!hasServiceRole()) return
  void getSupabaseAdmin()
    .from('analytics_events')
    .insert({
      event: event.slice(0, 64),
      user_id: ctx.userId ?? null,
      party_id: ctx.partyId ?? null,
      properties: properties as NonNullable<Json>,
      source: 'server',
      path: ctx.path ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('analytics insert failed', error.message)
    })
}
