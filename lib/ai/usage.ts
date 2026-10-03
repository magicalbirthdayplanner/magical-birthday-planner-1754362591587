/**
 * Reserve → rank → finalize. A pending row is inserted before the provider call (closing double-click races);
 * its rank among the party's/user's counted rows decides whether it may proceed. Everything runs on the user's
 * RLS session via security-definer RPCs scoped to auth.uid() — no service role.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/db/database.types'
import type { AIFeature } from './types'

type DB = SupabaseClient<Database>
const COUNTED = ['pending', 'success']

export async function reserveGeneration(db: DB, partyId: string, feature: AIFeature, inputSummary: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.rpc('ai_reserve', { p_party: partyId, p_feature: feature, p_input_summary: inputSummary as Json })
  return error ? null : (data as string)
}

/** 1-based position of `id` among counted rows (ordered by created_at, id); Infinity if it can't be found. */
async function rankOf(db: DB, id: string, filter: { party?: string; user?: string; since?: string }): Promise<number> {
  let q = db.from('ai_generations').select('id, created_at').in('status', COUNTED).order('created_at').order('id').limit(500)
  if (filter.party) q = q.eq('party_id', filter.party)
  if (filter.user) q = q.eq('user_id', filter.user)
  if (filter.since) q = q.gte('created_at', filter.since)
  const { data } = await q
  const i = (data ?? []).findIndex((r) => r.id === id)
  return i < 0 ? Infinity : i + 1
}

export async function withinLimits(db: DB, id: string, opts: { partyId: string; userId: string; partyCap: number | null; hourlyCap: number | null }) {
  if (opts.partyCap != null && (await rankOf(db, id, { party: opts.partyId })) > opts.partyCap) return false
  if (opts.hourlyCap != null && (await rankOf(db, id, { user: opts.userId, since: new Date(Date.now() - 3_600_000).toISOString() })) > opts.hourlyCap) return false
  return true
}

export async function usedForParty(db: DB, partyId: string): Promise<number> {
  const { count } = await db.from('ai_generations').select('id', { count: 'exact', head: true }).eq('party_id', partyId).in('status', COUNTED)
  return count ?? 0
}

export async function globalCountToday(db: DB): Promise<number> {
  const { data } = await db.rpc('ai_global_count_today')
  return typeof data === 'number' ? data : 0
}

export async function finalizeGeneration(db: DB, id: string, f: { status: 'success' | 'failed' | 'rejected'; provider?: string; model?: string; inputTokens?: number | null; outputTokens?: number | null; durationMs?: number; errorCode?: string | null; result?: unknown }) {
  await db.rpc('ai_finalize', {
    p_id: id, p_status: f.status, p_provider: f.provider ?? '', p_model: f.model ?? '', p_input_tokens: f.inputTokens ?? 0,
    p_output_tokens: f.outputTokens ?? 0, p_duration_ms: f.durationMs ?? 0, p_error_code: (f.errorCode ?? null) as string, p_result: (f.result ?? null) as Json,
  })
}
