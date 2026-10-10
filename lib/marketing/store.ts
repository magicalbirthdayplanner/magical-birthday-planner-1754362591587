/**
 * Persistence for the marketing agent. The interface keeps the pipeline testable (an in-memory store in tests); the
 * Supabase implementation uses the service role — these tables have no client access at all. SERVER ONLY.
 */
import 'server-only'
import type { Database, Json } from '@/lib/db/database.types'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { MarketingPost, Pillar, Platform, PostStatus } from './types'

export type PostRow = Database['public']['Tables']['marketing_posts']['Row']
export type PostInsert = Database['public']['Tables']['marketing_posts']['Insert']
export type PostUpdate = Database['public']['Tables']['marketing_posts']['Update']

export const IMAGE_BUCKET = 'marketing-images'
export const MEDIA_BUCKET = 'marketing-media'

export type MediaRow = Database['public']['Tables']['marketing_media']['Row']
export type MediaInsert = Database['public']['Tables']['marketing_media']['Insert']
export type PlanRow = Database['public']['Tables']['marketing_plans']['Row']
export interface UsageEntry { provider: 'x' | 'ai' | 'image' | 'video'; operation: string; units: number; costUsd: number; ok: boolean; postId?: string | null; detail?: Record<string, unknown>; at?: string }
export interface UsageRow extends Required<Omit<UsageEntry, 'postId' | 'detail'>> { postId: string | null; detail: Record<string, unknown> }

export interface Insights {
  id: number
  computedAt: string
  windowDays: number
  sampleSize: number
  data: Record<string, unknown>
  recommendations: string[]
  pillarMultipliers: Partial<Record<Pillar, number>>
}
export interface Brief { date: string; timezone: string; data: Record<string, unknown>; text: string; emailedAt: string | null; createdAt: string }
export interface Settings { autonomousEnabled: boolean; updatedAt: string | null }
export interface ClaimResult { claimed: boolean; reason: string }

export interface MarketingStore {
  listPosts(opts: { platform?: Platform; since?: string; statuses?: PostStatus[]; limit?: number }): Promise<MarketingPost[]>
  getPost(id: string): Promise<MarketingPost | null>
  insertPost(row: PostInsert): Promise<MarketingPost>
  /** Conditional update: only when the current status is one of `onlyIf` (if given). Returns null when nothing matched. */
  updatePost(id: string, patch: PostUpdate, onlyIf?: PostStatus[]): Promise<MarketingPost | null>
  deletePost(id: string, onlyIf: PostStatus[]): Promise<boolean>
  claimPost(id: string, attempt: string, maxPerDay: number, minGapMinutes: number, windowStart: Date): Promise<ClaimResult>
  addMetricsSnapshot(postId: string, source: 'platform' | 'mbp', metrics: Record<string, unknown>): Promise<void>
  getSettings(): Promise<Settings>
  setAutonomous(enabled: boolean, by: string | null): Promise<Settings>
  latestInsights(): Promise<Insights | null>
  saveInsights(i: Omit<Insights, 'id' | 'computedAt'>): Promise<Insights>
  getBrief(date: string): Promise<Brief | null>
  latestBriefs(limit: number): Promise<Brief[]>
  saveBrief(b: Omit<Brief, 'emailedAt' | 'createdAt'>): Promise<Brief>
  markBriefEmailed(date: string): Promise<void>
  audit(postId: string | null, actor: string | null, action: string, detail?: Record<string, unknown>): Promise<void>
  recentAudit(limit: number): Promise<{ id: number; postId: string | null; action: string; detail: Record<string, unknown>; createdAt: string }[]>
  uploadImage(path: string, bytes: Uint8Array, contentType: string): Promise<void>
  downloadImage(path: string): Promise<Uint8Array>
  signedImageUrl(path: string, seconds?: number): Promise<string | null>
  deleteImage(path: string): Promise<void>
  // ---- X growth engine: budget ledger, media library, weekly plans
  recordUsage(u: UsageEntry): Promise<void>
  usageSince(sinceIso: string): Promise<UsageRow[]>
  listMedia(opts?: { kind?: 'image' | 'video'; status?: 'approved' | 'pending' | 'rejected'; source?: 'template' | 'library' | 'ai'; ids?: string[] }): Promise<MediaRow[]>
  insertMedia(row: MediaInsert): Promise<MediaRow>
  updateMedia(id: string, patch: Partial<MediaInsert>): Promise<void>
  markMediaUsed(ids: string[]): Promise<void>
  uploadMedia(path: string, bytes: Uint8Array, contentType: string): Promise<void>
  downloadMedia(path: string): Promise<Uint8Array>
  signedMediaUrl(path: string, seconds?: number): Promise<string | null>
  getPlan(platform: Platform, weekStart: string): Promise<PlanRow | null>
  savePlan(row: { id?: string; platform: Platform; week_start: string; status: PlanRow['status']; slots: unknown; notes?: unknown }): Promise<PlanRow>
  listPlans(limit: number): Promise<PlanRow[]>
}

/** UTC calendar month of an instant ("YYYY-MM"): the budget month. */
export const usageMonth = (d: Date) => d.toISOString().slice(0, 7)

export function toPost(r: PostRow): MarketingPost {
  return {
    id: r.id,
    platform: r.platform as Platform,
    contentType: r.content_type as MarketingPost['contentType'],
    pillar: r.content_pillar as Pillar,
    topicKey: r.topic_key,
    topic: r.topic,
    hook: r.hook,
    cta: r.cta,
    text: r.text,
    linkUrl: r.link_url,
    imagePath: r.image_path,
    imagePrompt: r.image_prompt,
    imageAlt: r.image_alt,
    imageProvider: r.image_provider,
    imageStatus: r.image_status as MarketingPost['imageStatus'],
    status: r.status as PostStatus,
    origin: r.origin as MarketingPost['origin'],
    autonomous: r.autonomous,
    scheduledAt: r.scheduled_at,
    publishedAt: r.published_at,
    externalPostId: r.external_post_id,
    externalPostUrl: r.external_post_url,
    externalMediaId: r.external_media_id,
    metrics: { impressions: r.impressions, likes: r.likes, reposts: r.reposts, replies: r.replies, quotes: r.quotes, bookmarks: r.bookmarks, profileVisits: r.profile_visits, linkClicks: r.link_clicks },
    metricsUpdatedAt: r.metrics_updated_at,
    attribution: { landingVisits: r.landing_visits_attributed, signups: r.signups_attributed, partiesCreated: r.parties_created_attributed, checkouts: r.checkouts_attributed, purchases: r.purchases_attributed, revenueMinor: r.revenue_attributed_minor, currency: r.revenue_currency },
    attributionUpdatedAt: r.attribution_updated_at,
    similarityScore: r.similarity_score === null ? null : Number(r.similarity_score),
    similarPostId: r.similar_post_id,
    validation: (r.validation ?? {}) as MarketingPost['validation'],
    generation: (r.generation ?? {}) as Record<string, unknown>,
    approvedAt: r.approved_at,
    publishingStartedAt: r.publishing_started_at,
    publishAttempts: r.publish_attempts,
    publishErrorCode: r.publish_error_code,
    publishError: r.publish_error,
    format: r.format as MarketingPost['format'],
    slotRole: r.slot_role,
    category: r.category,
    planId: r.plan_id,
    slotIndex: r.slot_index,
    mediaIds: r.media_ids ?? [],
    poll: (r.poll as MarketingPost['poll']) ?? null,
    threadParts: (r.thread_parts as string[] | null) ?? null,
    externalThreadIds: r.external_thread_ids ?? [],
    businessScore: r.business_score === null ? null : Number(r.business_score),
    estCostUsd: r.est_cost_usd === null ? null : Number(r.est_cost_usd),
    source: r.source as MarketingPost['source'],
    dryRunAt: r.dry_run_at,
    dryRunPayload: r.dry_run_payload as Record<string, unknown> | null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const json = (v: unknown) => v as NonNullable<Json>

export class SupabaseMarketingStore implements MarketingStore {
  private db = getSupabaseAdmin()

  async listPosts(opts: { platform?: Platform; since?: string; statuses?: PostStatus[]; limit?: number }) {
    let q = this.db.from('marketing_posts').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 500)
    if (opts.platform) q = q.eq('platform', opts.platform)
    if (opts.since) q = q.gte('created_at', opts.since)
    if (opts.statuses) q = q.in('status', opts.statuses)
    const { data, error } = await q
    if (error) throw new Error(`marketing_posts list failed: ${error.message}`)
    return (data ?? []).map(toPost)
  }

  async getPost(id: string) {
    const { data, error } = await this.db.from('marketing_posts').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`marketing_posts get failed: ${error.message}`)
    return data ? toPost(data) : null
  }

  async insertPost(row: PostInsert) {
    const { data, error } = await this.db.from('marketing_posts').insert(row).select('*').single()
    if (error || !data) throw new Error(`marketing_posts insert failed: ${error?.message}`)
    return toPost(data)
  }

  async updatePost(id: string, patch: PostUpdate, onlyIf?: PostStatus[]) {
    let q = this.db.from('marketing_posts').update(patch).eq('id', id)
    if (onlyIf) q = q.in('status', onlyIf)
    const { data, error } = await q.select('*').maybeSingle()
    if (error) throw new Error(`marketing_posts update failed: ${error.message}`)
    return data ? toPost(data) : null
  }

  async deletePost(id: string, onlyIf: PostStatus[]) {
    const { data, error } = await this.db.from('marketing_posts').delete().eq('id', id).in('status', onlyIf).select('id')
    if (error) throw new Error(`marketing_posts delete failed: ${error.message}`)
    return (data ?? []).length > 0
  }

  async claimPost(id: string, attempt: string, maxPerDay: number, minGapMinutes: number, windowStart: Date) {
    const { data, error } = await this.db.rpc('marketing_claim_post', { p_post: id, p_attempt: attempt, p_max_per_day: maxPerDay, p_min_gap_minutes: minGapMinutes, p_window_start: windowStart.toISOString() })
    if (error) throw new Error(`marketing_claim_post failed: ${error.message}`)
    const row = Array.isArray(data) ? data[0] : data
    return { claimed: !!row?.claimed, reason: row?.reason ?? 'unknown' }
  }

  async addMetricsSnapshot(postId: string, source: 'platform' | 'mbp', metrics: Record<string, unknown>) {
    const { error } = await this.db.from('marketing_post_metrics').insert({ post_id: postId, source, metrics: json(metrics) })
    if (error) throw new Error(`marketing_post_metrics insert failed: ${error.message}`)
  }

  async getSettings() {
    const { data } = await this.db.from('marketing_settings').select('autonomous_enabled, updated_at').eq('id', 'default').maybeSingle()
    return { autonomousEnabled: !!data?.autonomous_enabled, updatedAt: data?.updated_at ?? null }
  }

  async setAutonomous(enabled: boolean, by: string | null) {
    const { data, error } = await this.db
      .from('marketing_settings')
      .upsert({ id: 'default', autonomous_enabled: enabled, updated_by: by, updated_at: new Date().toISOString() })
      .select('autonomous_enabled, updated_at')
      .single()
    if (error || !data) throw new Error(`marketing_settings update failed: ${error?.message}`)
    return { autonomousEnabled: data.autonomous_enabled, updatedAt: data.updated_at }
  }

  async latestInsights() {
    const { data } = await this.db.from('marketing_insights').select('*').order('computed_at', { ascending: false }).limit(1).maybeSingle()
    return data ? toInsights(data) : null
  }

  async saveInsights(i: Omit<Insights, 'id' | 'computedAt'>) {
    const { data, error } = await this.db
      .from('marketing_insights')
      .insert({ window_days: i.windowDays, sample_size: i.sampleSize, data: json(i.data), recommendations: json(i.recommendations), pillar_multipliers: json(i.pillarMultipliers) })
      .select('*')
      .single()
    if (error || !data) throw new Error(`marketing_insights insert failed: ${error?.message}`)
    return toInsights(data)
  }

  async getBrief(date: string) {
    const { data } = await this.db.from('marketing_briefs').select('*').eq('brief_date', date).maybeSingle()
    return data ? toBrief(data) : null
  }

  async latestBriefs(limit: number) {
    const { data } = await this.db.from('marketing_briefs').select('*').order('brief_date', { ascending: false }).limit(limit)
    return (data ?? []).map(toBrief)
  }

  async saveBrief(b: Omit<Brief, 'emailedAt' | 'createdAt'>) {
    const { data, error } = await this.db
      .from('marketing_briefs')
      .upsert({ brief_date: b.date, timezone: b.timezone, data: json(b.data), text: b.text }, { onConflict: 'brief_date' })
      .select('*')
      .single()
    if (error || !data) throw new Error(`marketing_briefs upsert failed: ${error?.message}`)
    return toBrief(data)
  }

  async markBriefEmailed(date: string) {
    await this.db.from('marketing_briefs').update({ emailed_at: new Date().toISOString() }).eq('brief_date', date)
  }

  async audit(postId: string | null, actor: string | null, action: string, detail: Record<string, unknown> = {}) {
    const { error } = await this.db.from('marketing_audit_log').insert({ post_id: postId, actor_user_id: actor, action, detail: json(detail) })
    if (error) console.warn('marketing audit insert failed', error.message)
  }

  async recentAudit(limit: number) {
    const { data } = await this.db.from('marketing_audit_log').select('id, post_id, action, detail, created_at').order('created_at', { ascending: false }).limit(limit)
    return (data ?? []).map((r) => ({ id: r.id, postId: r.post_id, action: r.action, detail: r.detail as Record<string, unknown>, createdAt: r.created_at }))
  }

  async uploadImage(path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType, upsert: false })
    if (error) throw new Error(`image upload failed: ${error.message}`)
  }

  async downloadImage(path: string) {
    const { data, error } = await this.db.storage.from(IMAGE_BUCKET).download(path)
    if (error || !data) throw new Error(`image download failed: ${error?.message}`)
    return new Uint8Array(await data.arrayBuffer())
  }

  async signedImageUrl(path: string, seconds = 3600) {
    const { data } = await this.db.storage.from(IMAGE_BUCKET).createSignedUrl(path, seconds)
    return data?.signedUrl ?? null
  }

  async deleteImage(path: string) {
    await this.db.storage.from(IMAGE_BUCKET).remove([path])
  }

  async recordUsage(u: UsageEntry) {
    const at = u.at ?? new Date().toISOString()
    const { error } = await this.db.from('marketing_usage').insert({ at, month: at.slice(0, 7), provider: u.provider, operation: u.operation, units: u.units, cost_usd: u.costUsd, ok: u.ok, post_id: u.postId ?? null, detail: json(u.detail ?? {}) })
    if (error) console.warn('marketing usage insert failed', error.message)
  }

  async usageSince(sinceIso: string) {
    const { data, error } = await this.db.from('marketing_usage').select('*').gte('at', sinceIso).order('at').limit(20_000)
    if (error) throw new Error(`marketing_usage read failed: ${error.message}`)
    return (data ?? []).map((r) => ({ provider: r.provider as UsageEntry['provider'], operation: r.operation, units: r.units, costUsd: Number(r.cost_usd), ok: r.ok, postId: r.post_id, detail: r.detail as Record<string, unknown>, at: r.at }))
  }

  async listMedia(opts: { kind?: 'image' | 'video'; status?: 'approved' | 'pending' | 'rejected'; source?: 'template' | 'library' | 'ai'; ids?: string[] } = {}) {
    let q = this.db.from('marketing_media').select('*').order('created_at').limit(2000)
    if (opts.kind) q = q.eq('kind', opts.kind)
    if (opts.status) q = q.eq('privacy_status', opts.status)
    if (opts.source) q = q.eq('source', opts.source)
    if (opts.ids) q = q.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000'])
    const { data, error } = await q
    if (error) throw new Error(`marketing_media list failed: ${error.message}`)
    return data ?? []
  }

  async insertMedia(row: MediaInsert) {
    const { data, error } = await this.db.from('marketing_media').insert(row).select('*').single()
    if (error || !data) throw new Error(`marketing_media insert failed: ${error?.message}`)
    return data
  }

  async updateMedia(id: string, patch: Partial<MediaInsert>) {
    const { error } = await this.db.from('marketing_media').update(patch).eq('id', id)
    if (error) throw new Error(`marketing_media update failed: ${error.message}`)
  }

  async markMediaUsed(ids: string[]) {
    if (!ids.length) return
    const { error } = await this.db.rpc('marketing_media_used', { p_ids: ids })
    if (error) console.warn('marketing_media_used failed', error.message)
  }

  async uploadMedia(path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true })
    if (error) throw new Error(`media upload failed: ${error.message}`)
  }

  async downloadMedia(path: string) {
    const { data, error } = await this.db.storage.from(MEDIA_BUCKET).download(path)
    if (error || !data) throw new Error(`media download failed: ${error?.message}`)
    return new Uint8Array(await data.arrayBuffer())
  }

  async signedMediaUrl(path: string, seconds = 3600) {
    const { data } = await this.db.storage.from(MEDIA_BUCKET).createSignedUrl(path, seconds)
    return data?.signedUrl ?? null
  }

  async getPlan(platform: Platform, weekStart: string) {
    const { data } = await this.db.from('marketing_plans').select('*').eq('platform', platform).eq('week_start', weekStart).maybeSingle()
    return data ?? null
  }

  async savePlan(row: { id?: string; platform: Platform; week_start: string; status: PlanRow['status']; slots: unknown; notes?: unknown }) {
    const { data, error } = await this.db
      .from('marketing_plans')
      .upsert({ ...(row.id ? { id: row.id } : {}), platform: row.platform, week_start: row.week_start, status: row.status, slots: json(row.slots), notes: json(row.notes ?? {}) }, { onConflict: 'platform,week_start' })
      .select('*')
      .single()
    if (error || !data) throw new Error(`marketing_plans upsert failed: ${error?.message}`)
    return data
  }

  async listPlans(limit: number) {
    const { data } = await this.db.from('marketing_plans').select('*').order('week_start', { ascending: false }).limit(limit)
    return data ?? []
  }
}

function toInsights(r: Database['public']['Tables']['marketing_insights']['Row']): Insights {
  return {
    id: r.id,
    computedAt: r.computed_at,
    windowDays: r.window_days,
    sampleSize: r.sample_size,
    data: r.data as Record<string, unknown>,
    recommendations: (r.recommendations as string[]) ?? [],
    pillarMultipliers: (r.pillar_multipliers as Partial<Record<Pillar, number>>) ?? {},
  }
}

function toBrief(r: Database['public']['Tables']['marketing_briefs']['Row']): Brief {
  return { date: r.brief_date, timezone: r.timezone, data: r.data as Record<string, unknown>, text: r.text, emailedAt: r.emailed_at, createdAt: r.created_at }
}

let store: MarketingStore | null = null
let override: MarketingStore | null = null
/** Tests only. */
export function setMarketingStoreOverride(s: MarketingStore | null) {
  override = s
}
export function getMarketingStore(): MarketingStore {
  return override ?? (store ??= new SupabaseMarketingStore())
}
