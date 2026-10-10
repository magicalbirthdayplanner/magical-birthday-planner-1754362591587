/**
 * Media library: reuse before generate.
 *  - library  — curated, privacy-reviewed campaign assets (videos, carousels, single images) seeded from
 *               data/marketing/media-library.json; reused with new captions after a cool-down.
 *  - template — branded cards rendered from the post's own validated text (free).
 *  - ai       — generated images (optional, paid, budget-gated).
 * Only `privacy_status = approved` media can ever be attached to a post. SERVER ONLY.
 */
import 'server-only'
import { renderCard, type CardSpec } from './images/templates'
import type { MediaInput } from './providers/types'
import type { MarketingStore, MediaRow } from './store'

export const MEDIA_COOLDOWN_DAYS = 14

export interface LibraryPick { ids: string[]; rows: MediaRow[]; kind: 'video' | 'carousel' | 'image' }

/** Library sets: a video, a carousel (rows sharing set_key, ordered by position) or a single image. */
function groupSets(rows: MediaRow[]) {
  const sets = new Map<string, MediaRow[]>()
  for (const r of rows) {
    const k = r.set_key ?? r.id
    sets.set(k, [...(sets.get(k) ?? []), r].sort((a, b) => a.position - b.position))
  }
  return [...sets.values()]
}

/**
 * The least-used approved library set of a kind that hasn't been used in the cool-down window and isn't already
 * claimed by another queued post (`exclude`). Prefers matching categories/tags.
 */
export async function pickLibraryMedia(store: MarketingStore, opts: { kind: 'video' | 'carousel' | 'image'; now: Date; exclude?: Set<string>; prefer?: string[]; cooldownDays?: number }): Promise<LibraryPick | null> {
  const rows = (await store.listMedia({ status: 'approved', source: 'library', kind: opts.kind === 'video' ? 'video' : 'image' })).filter((r) => r.storage_path)
  const cutoff = opts.now.getTime() - (opts.cooldownDays ?? MEDIA_COOLDOWN_DAYS) * 86_400_000
  const sets = groupSets(rows).filter((set) => {
    const isCarousel = set.length > 1
    if (opts.kind === 'carousel' ? !isCarousel : opts.kind === 'image' ? isCarousel : false) return false
    return set.every((r) => !opts.exclude?.has(r.id) && (!r.last_used_at || new Date(r.last_used_at).getTime() < cutoff))
  })
  if (!sets.length) return null
  const prefer = new Set((opts.prefer ?? []).map((p) => p.toLowerCase()))
  const rank = (set: MediaRow[]) => {
    const head = set[0]
    const match = prefer.size && (prefer.has((head.category ?? '').toLowerCase()) || head.tags.some((t) => prefer.has(t.toLowerCase()))) ? 0 : 1
    return [match, head.used_count, head.last_used_at ?? '', -(head.performance_score ?? 0)] as const
  }
  sets.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)]
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1
    return 0
  })
  const pick = sets[0].slice(0, 4)
  return { ids: pick.map((r) => r.id), rows: pick, kind: opts.kind }
}

/** Render branded template card(s) for a post and store them as approved template media. */
export async function renderTemplateMedia(store: MarketingStore, postId: string, specs: Omit<CardSpec, 'seed'>[], render: typeof renderCard = renderCard): Promise<string[]> {
  const ids: string[] = []
  const many = specs.length > 1
  for (let i = 0; i < specs.length && i < 4; i++) {
    const spec = { ...specs[i], seed: `${postId}:${i}`, size: many ? ('square' as const) : specs[i].size, badge: many ? `${i + 1}/${specs.length}` : null }
    const img = await render(spec)
    const path = `templates/${postId}/${i + 1}.png`
    await store.uploadMedia(path, img.bytes, 'image/png')
    const row = await store.insertMedia({
      kind: 'image',
      source: 'template',
      set_key: many ? `post:${postId}` : null,
      position: i + 1,
      template_key: spec.template,
      title: spec.headline.slice(0, 120),
      storage_path: path,
      mime_type: 'image/png',
      bytes: img.bytes.byteLength,
      width: img.width,
      height: img.height,
      alt_text: [spec.headline, ...(spec.bullets ?? [])].join('. ').slice(0, 400),
      privacy_status: 'approved',
      privacy_notes: 'Rendered from the post’s validated text by the brand template (no photos, no people).',
    })
    ids.push(row.id)
  }
  return ids
}

/** Bytes for a post's media, in order. Rejected/pending media are never loaded. */
export async function loadMedia(store: MarketingStore, ids: string[]): Promise<{ inputs: MediaInput[]; rows: MediaRow[] }> {
  if (!ids.length) return { inputs: [], rows: [] }
  const rows = (await store.listMedia({ ids })).filter((r) => r.privacy_status === 'approved' && r.storage_path)
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is MediaRow => !!r)
  const inputs: MediaInput[] = []
  for (const r of ordered) inputs.push({ bytes: await store.downloadMedia(r.storage_path!), mimeType: r.mime_type ?? 'image/png', altText: r.alt_text })
  return { inputs, rows: ordered }
}

/** Media checks before publishing: approved, ≤ 4 images or exactly one video, sizes within X limits. */
export function mediaIssues(rows: MediaRow[], expected: number): string[] {
  const issues: string[] = []
  if (rows.length !== expected) issues.push('Some media is missing or not approved for publishing.')
  const videos = rows.filter((r) => r.kind === 'video')
  if (videos.length > 1 || (videos.length === 1 && rows.length > 1)) issues.push('A post can carry one video or up to four images.')
  if (rows.length > 4) issues.push('More than four images.')
  for (const r of rows) {
    if (r.privacy_status !== 'approved') issues.push(`Media "${r.title}" is not privacy-approved.`)
    if (r.kind === 'image' && (r.bytes ?? 0) > 5 * 1024 * 1024) issues.push(`Image "${r.title}" is over 5 MB.`)
    if (r.kind === 'video' && (r.duration_s ?? 0) > 140) issues.push(`Video "${r.title}" is longer than 2:20.`)
  }
  return issues
}
