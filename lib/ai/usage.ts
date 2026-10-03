/**
 * Reserve → rank → finalize. A pending row is inserted before the provider call (closing double-click races);
 * its rank among the party's/user's counted rows decides whether it may proceed. Reserve and ranking run on the
 * user's RLS session (ai_reserve is scoped to auth.uid()); finalize is service-role only so a user can never
 * flip their own in-flight generation to failed and "un-count" it.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/db/database.types'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { AIFeature } from './types'

type DB = SupabaseClient<Database>
/** Per-party caps: what the parent got (failed calls don't use up a party's suggestions). */
const PARTY_COUNTED = ['pending', 'success']
/** Per-user hourly/daily caps: anything that reached the provider costs tokens, including failures and cancels. */
const USER_COUNTED = ['pending', 'success', 'failed']

export async function reserveGeneration(db: DB, partyId: string, feature: AIFeature, inputSummary: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.rpc('ai_reserve', { p_party: partyId, p_feature: feature, p_input_summary: inputSummary as Json })
  return error ? null : (data as string)
}

/** 1-based position of `id` among counted rows (ordered by created_at, id); Infinity if it can't be found. */
async function rankOf(db: DB, id: string, statuses: string[], filter: { party?: string; user?: string; since?: string }): Promise<number> {
  let q = db.from('ai_generations').select('id, created_at').in('status', statuses).order('created_at').order('id').limit(500)
  if (filter.party) q = q.eq('party_id', filter.party)
  if (filter.user) q = q.eq('user_id', filter.user)
  if (filter.since) q = q.gte('created_at', filter.since)
  const { data } = await q
  const i = (data ?? []).findIndex((r) => r.id === id)
  return i < 0 ? Infinity : i + 1
}

/** null = within every cap; otherwise which cap this generation exceeds. */
export async function limitExceeded(db: DB, id: string, opts: { partyId: string; userId: string; partyCap: number | null; hourlyCap: number | null; dailyCap: number | null }): Promise<null | 'party' | 'hourly' | 'daily'> {
  if (opts.partyCap != null && (await rankOf(db, id, PARTY_COUNTED, { party: opts.partyId })) > opts.partyCap) return 'party'
  if (opts.hourlyCap != null && (await rankOf(db, id, USER_COUNTED, { user: opts.userId, since: new Date(Date.now() - 3_600_000).toISOString() })) > opts.hourlyCap) return 'hourly'
  if (opts.dailyCap != null && (await rankOf(db, id, USER_COUNTED, { user: opts.userId, since: new Date(Date.now() - 86_400_000).toISOString() })) > opts.dailyCap) return 'daily'
  return null
}

export async function usedForParty(db: DB, partyId: string): Promise<number> {
  const { count } = await db.from('ai_generations').select('id', { count: 'exact', head: true }).eq('party_id', partyId).in('status', PARTY_COUNTED)
  return count ?? 0
}

export async function globalCountToday(db: DB): Promise<number> {
  const { data } = await db.rpc('ai_global_count_today')
  return typeof data === 'number' ? data : 0
}

/** Service role only (see migration 0900). `userId` must own the pending row. */
export async function finalizeGeneration(userId: string, id: string, f: { status: 'success' | 'failed' | 'rejected'; provider?: string; model?: string; inputTokens?: number | null; outputTokens?: number | null; durationMs?: number; errorCode?: string | null; result?: unknown }) {
  await getSupabaseAdmin().rpc('ai_finalize', {
    p_id: id, p_user: userId, p_status: f.status, p_provider: f.provider ?? '', p_model: f.model ?? '', p_input_tokens: f.inputTokens ?? 0,
    p_output_tokens: f.outputTokens ?? 0, p_duration_ms: f.durationMs ?? 0, p_error_code: (f.errorCode ?? null) as string, p_result: (f.result ?? null) as Json,
  })
}
