/**
 * In-memory MarketingStore for unit tests. Mirrors the Supabase implementation, including marketing_claim_post's
 * rules (status, daily limit, minimum gap) — evaluated synchronously, so concurrent callers can't both win.
 */
import { randomUUID } from 'node:crypto'
import { toPost, type Brief, type ClaimResult, type Insights, type MarketingStore, type MediaInsert, type MediaRow, type PlanRow, type PostInsert, type PostRow, type PostUpdate, type Settings, type UsageEntry, type UsageRow } from '@/lib/marketing/store'
import type { MarketingPost, Platform, PostStatus } from '@/lib/marketing/types'

export class MemoryMarketingStore implements MarketingStore {
  rows = new Map<string, PostRow>()
  snapshots: { postId: string; source: string; metrics: Record<string, unknown> }[] = []
  settings: Settings = { autonomousEnabled: false, updatedAt: null }
  insights: Insights[] = []
  briefs = new Map<string, Brief>()
  auditLog: { id: number; postId: string | null; actor: string | null; action: string; detail: Record<string, unknown>; createdAt: string }[] = []
  images = new Map<string, { bytes: Uint8Array; contentType: string }>()
  media = new Map<string, MediaRow>()
  mediaFiles = new Map<string, { bytes: Uint8Array; contentType: string }>()
  plans = new Map<string, PlanRow>()
  usage: UsageRow[] = []
  /** Clock used for created_at/updated_at and the claim's "now". */
  clock: () => Date = () => new Date()

  private now() {
    return this.clock().toISOString()
  }

  async listPosts(opts: { platform?: Platform; since?: string; statuses?: PostStatus[]; limit?: number }) {
    return [...this.rows.values()]
      .filter((r) => (!opts.platform || r.platform === opts.platform) && (!opts.since || r.created_at >= opts.since) && (!opts.statuses || opts.statuses.includes(r.status as PostStatus)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, opts.limit ?? 500)
      .map(toPost)
  }

  async getPost(id: string) {
    const r = this.rows.get(id)
    return r ? toPost(r) : null
  }

  async insertPost(row: PostInsert): Promise<MarketingPost> {
    const now = this.now()
    const r: PostRow = {
      id: row.id ?? randomUUID(), platform: row.platform ?? 'x', content_type: row.content_type ?? 'text', content_pillar: row.content_pillar, topic_key: row.topic_key ?? null, topic: row.topic,
      hook: row.hook ?? null, cta: row.cta ?? null, text: row.text, link_url: row.link_url ?? null, image_path: row.image_path ?? null, image_prompt: row.image_prompt ?? null, image_alt: row.image_alt ?? null,
      image_provider: row.image_provider ?? null, image_status: row.image_status ?? 'none', status: row.status ?? 'draft', origin: row.origin ?? 'agent', autonomous: row.autonomous ?? false,
      scheduled_at: row.scheduled_at ?? null, published_at: row.published_at ?? null, external_post_id: row.external_post_id ?? null, external_post_url: row.external_post_url ?? null, external_media_id: row.external_media_id ?? null,
      impressions: row.impressions ?? null, likes: row.likes ?? null, reposts: row.reposts ?? null, replies: row.replies ?? null, quotes: row.quotes ?? null, bookmarks: row.bookmarks ?? null,
      profile_visits: row.profile_visits ?? null, link_clicks: row.link_clicks ?? null, metrics_updated_at: row.metrics_updated_at ?? null,
      landing_visits_attributed: row.landing_visits_attributed ?? 0, signups_attributed: row.signups_attributed ?? 0, parties_created_attributed: row.parties_created_attributed ?? 0,
      checkouts_attributed: row.checkouts_attributed ?? 0, purchases_attributed: row.purchases_attributed ?? 0, revenue_attributed_minor: row.revenue_attributed_minor ?? 0, revenue_currency: row.revenue_currency ?? null,
      attribution_updated_at: row.attribution_updated_at ?? null, similarity_score: row.similarity_score ?? null, similar_post_id: row.similar_post_id ?? null,
      validation: row.validation ?? {}, generation: row.generation ?? {}, approved_at: row.approved_at ?? null, approved_by: row.approved_by ?? null, created_by: row.created_by ?? null,
      publish_attempt_id: row.publish_attempt_id ?? null, publishing_started_at: row.publishing_started_at ?? null, publish_attempts: row.publish_attempts ?? 0,
      publish_error_code: row.publish_error_code ?? null, publish_error: row.publish_error ?? null, dry_run_at: row.dry_run_at ?? null, dry_run_payload: row.dry_run_payload ?? null,
      format: row.format ?? 'text', slot_role: row.slot_role ?? null, category: row.category ?? null, plan_id: row.plan_id ?? null, slot_index: row.slot_index ?? null,
      media_ids: row.media_ids ?? [], poll: row.poll ?? null, thread_parts: row.thread_parts ?? null, external_thread_ids: row.external_thread_ids ?? [],
      business_score: row.business_score ?? null, est_cost_usd: row.est_cost_usd ?? null, source: row.source ?? 'ai',
      created_at: row.created_at ?? now, updated_at: now,
    }
    if (this.rows.has(r.id)) throw new Error('duplicate id')
    if (r.external_post_id && [...this.rows.values()].some((x) => x.platform === r.platform && x.external_post_id === r.external_post_id)) throw new Error('duplicate external id')
    this.rows.set(r.id, r)
    return toPost(r)
  }

  async updatePost(id: string, patch: PostUpdate, onlyIf?: PostStatus[]) {
    const r = this.rows.get(id)
    if (!r || (onlyIf && !onlyIf.includes(r.status as PostStatus))) return null
    const next = { ...r, ...patch, updated_at: this.now() } as PostRow
    this.rows.set(id, next)
    return toPost(next)
  }

  async deletePost(id: string, onlyIf: PostStatus[]) {
    const r = this.rows.get(id)
    if (!r || !onlyIf.includes(r.status as PostStatus)) return false
    return this.rows.delete(id)
  }

  async claimPost(id: string, attempt: string, maxPerDay: number, minGapMinutes: number, windowStart: Date): Promise<ClaimResult> {
    const r = this.rows.get(id)
    if (!r) return { claimed: false, reason: 'not_found' }
    if (!['approved', 'scheduled'].includes(r.status)) return { claimed: false, reason: `not_publishable:${r.status}` }
    const same = [...this.rows.values()].filter((x) => x.platform === r.platform)
    const ws = windowStart.toISOString()
    const unconfirmed = (x: PostRow) => x.status === 'failed' && x.publish_error_code === 'publish_unconfirmed'
    const count = same.filter((x) => x.status === 'publishing' || (x.status === 'published' && x.published_at! >= ws) || (x.status === 'dry_run' && x.dry_run_at! >= ws) || (unconfirmed(x) && x.publishing_started_at! >= ws)).length
    if (count >= maxPerDay) return { claimed: false, reason: 'daily_limit' }
    const times = same.filter((x) => ['publishing', 'published', 'dry_run'].includes(x.status) || unconfirmed(x)).map((x) => [x.published_at, x.dry_run_at, x.publishing_started_at].filter(Boolean).sort().pop()!).filter(Boolean)
    const last = times.sort().pop()
    if (last && new Date(last).getTime() > this.clock().getTime() - minGapMinutes * 60_000) return { claimed: false, reason: 'min_gap' }
    this.rows.set(id, { ...r, status: 'publishing', publish_attempt_id: attempt, publishing_started_at: this.now(), publish_attempts: r.publish_attempts + 1, publish_error_code: null, publish_error: null })
    return { claimed: true, reason: 'claimed' }
  }

  async addMetricsSnapshot(postId: string, source: 'platform' | 'mbp', metrics: Record<string, unknown>) {
    this.snapshots.push({ postId, source, metrics })
  }
  async getSettings() {
    return { ...this.settings }
  }
  async setAutonomous(enabled: boolean) {
    this.settings = { autonomousEnabled: enabled, updatedAt: this.now() }
    return { ...this.settings }
  }
  async latestInsights() {
    return this.insights[this.insights.length - 1] ?? null
  }
  async saveInsights(i: Omit<Insights, 'id' | 'computedAt'>) {
    const saved = { ...i, id: this.insights.length + 1, computedAt: this.now() }
    this.insights.push(saved)
    return saved
  }
  async getBrief(date: string) {
    return this.briefs.get(date) ?? null
  }
  async latestBriefs(limit: number) {
    return [...this.briefs.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
  }
  async saveBrief(b: Omit<Brief, 'emailedAt' | 'createdAt'>) {
    const saved = { ...b, emailedAt: this.briefs.get(b.date)?.emailedAt ?? null, createdAt: this.now() }
    this.briefs.set(b.date, saved)
    return saved
  }
  async markBriefEmailed(date: string) {
    const b = this.briefs.get(date)
    if (b) b.emailedAt = this.now()
  }
  async audit(postId: string | null, actor: string | null, action: string, detail: Record<string, unknown> = {}) {
    this.auditLog.push({ id: this.auditLog.length + 1, postId, actor, action, detail, createdAt: this.now() })
  }
  async recentAudit(limit: number) {
    return this.auditLog.slice(-limit).reverse()
  }
  async uploadImage(path: string, bytes: Uint8Array, contentType: string) {
    if (this.images.has(path)) throw new Error('exists')
    this.images.set(path, { bytes, contentType })
  }
  async downloadImage(path: string) {
    const i = this.images.get(path)
    if (!i) throw new Error('missing')
    return i.bytes
  }
  async signedImageUrl(path: string) {
    return `memory://${path}`
  }
  async deleteImage(path: string) {
    this.images.delete(path)
  }

  async recordUsage(u: UsageEntry) {
    this.usage.push({ provider: u.provider, operation: u.operation, units: u.units, costUsd: u.costUsd, ok: u.ok, postId: u.postId ?? null, detail: u.detail ?? {}, at: u.at ?? this.now() })
  }
  async usageSince(sinceIso: string) {
    return this.usage.filter((u) => u.at >= sinceIso)
  }
  async listMedia(opts: { kind?: 'image' | 'video'; status?: 'approved' | 'pending' | 'rejected'; source?: 'template' | 'library' | 'ai'; ids?: string[] } = {}) {
    return [...this.media.values()].filter((m) => (!opts.kind || m.kind === opts.kind) && (!opts.status || m.privacy_status === opts.status) && (!opts.source || m.source === opts.source) && (!opts.ids || opts.ids.includes(m.id)))
  }
  async insertMedia(row: MediaInsert) {
    const now = this.now()
    const m: MediaRow = {
      id: row.id ?? randomUUID(), library_key: row.library_key ?? null, kind: row.kind, source: row.source, set_key: row.set_key ?? null, position: row.position ?? 1, template_key: row.template_key ?? null,
      title: row.title, description: row.description ?? null, category: row.category ?? null, tags: row.tags ?? [], storage_path: row.storage_path ?? null, mime_type: row.mime_type ?? null,
      bytes: row.bytes ?? null, width: row.width ?? null, height: row.height ?? null, duration_s: row.duration_s ?? null, alt_text: row.alt_text ?? null, caption_suffix: row.caption_suffix ?? null,
      privacy_status: row.privacy_status ?? 'pending', privacy_notes: row.privacy_notes ?? null, used_count: row.used_count ?? 0, last_used_at: row.last_used_at ?? null,
      performance_score: row.performance_score ?? null, created_at: now, updated_at: now,
    }
    this.media.set(m.id, m)
    return m
  }
  async updateMedia(id: string, patch: Partial<MediaInsert>) {
    const m = this.media.get(id)
    if (m) this.media.set(id, { ...m, ...patch } as MediaRow)
  }
  async markMediaUsed(ids: string[]) {
    for (const id of ids) {
      const m = this.media.get(id)
      if (m) this.media.set(id, { ...m, used_count: m.used_count + 1, last_used_at: this.now() })
    }
  }
  async uploadMedia(path: string, bytes: Uint8Array, contentType: string) {
    this.mediaFiles.set(path, { bytes, contentType })
  }
  async downloadMedia(path: string) {
    const f = this.mediaFiles.get(path)
    if (!f) throw new Error('missing media')
    return f.bytes
  }
  async signedMediaUrl(path: string) {
    return `memory://media/${path}`
  }
  async getPlan(platform: Platform, weekStart: string) {
    return this.plans.get(`${platform}:${weekStart}`) ?? null
  }
  async savePlan(row: { id?: string; platform: Platform; week_start: string; status: PlanRow['status']; slots: unknown; notes?: unknown }) {
    const key = `${row.platform}:${row.week_start}`
    const prev = this.plans.get(key)
    const now = this.now()
    const p: PlanRow = { id: prev?.id ?? row.id ?? randomUUID(), platform: row.platform, week_start: row.week_start, status: row.status, slots: row.slots as PlanRow['slots'], notes: (row.notes ?? {}) as PlanRow['notes'], created_at: prev?.created_at ?? now, updated_at: now }
    this.plans.set(key, p)
    return p
  }
  async listPlans(limit: number) {
    return [...this.plans.values()].sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, limit)
  }

  /** Seed a post directly (tests). */
  seed(row: Partial<PostRow> & Pick<PostRow, 'content_pillar' | 'topic' | 'text'>): MarketingPost {
    const id = row.id ?? randomUUID()
    const now = this.now()
    const base = { id, created_at: row.created_at ?? now } as PostInsert
    void this.insertPost({ ...base, ...(row as PostInsert) })
    return toPost(this.rows.get(id)!)
  }
}
