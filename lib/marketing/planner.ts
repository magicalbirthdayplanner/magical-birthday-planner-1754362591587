/**
 * Weekly content planning — no AI, no API calls: 7 days × 8 slots (default) with a role, format, pillar, topic, media
 * plan (reuse library media / free branded template / none) and link decision for every slot. Captions are written
 * later in daily batches (batch.ts). Learning weights (insights) can shift roles and formats; the budget decides how
 * many link posts ($0.20 each on X) the week can afford.
 */
import type { BudgetSnapshot } from './budget'
import type { MarketingConfig } from './config'
import type { TemplateKey } from './images/templates'
import { pickLibraryMedia } from './media'
import type { MarketingStore, PlanRow } from './store'
import { selectTopic, toStrategyPost, type StrategyPost } from './strategy'
import { addDays, localDate, weekday, zonedToUtc } from './time'
import type { Pillar, PostFormat, SlotRole } from './types'

export interface PlanSlot {
  index: number
  date: string
  time: string
  at: string
  role: SlotRole
  pillar: Pillar
  category: string
  format: PostFormat
  topicKey: string
  topicAngle: string
  link: boolean
  thread: boolean
  media: { source: 'none' | 'template' | 'library'; kind?: 'video' | 'carousel' | 'image'; template?: TemplateKey; libraryIds?: string[]; libraryNote?: string }
  status: 'planned' | 'generated' | 'library' | 'skipped'
  postId?: string | null
  note?: string
}

export interface PlanWeights { roles?: Partial<Record<SlotRole, number>>; formats?: Partial<Record<PostFormat, number>> }

/** The recommended day, in posting order (morning → night). */
export const DAILY_ROLES: SlotRole[] = ['founder_story', 'parent_tip', 'conversation', 'visual', 'educational', 'product', 'poll', 'soft_conversion']
/** 5–7 posts a day: keep these first. */
const ROLE_PRIORITY: SlotRole[] = ['founder_story', 'parent_tip', 'product', 'soft_conversion', 'conversation', 'educational', 'poll', 'visual']

/** Monday (local) of the week containing `date`. */
export function weekStartOf(date: string): string {
  const back = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }[weekday(date)] ?? 0
  return addDays(date, -back)
}

/**
 * Compact days (3–4 posts): founder story in the morning and the soft conversion in the evening every day, plus a
 * rotating engagement pair (a poll every other day, questions, tips, product, carousels, visuals).
 */
const COMPACT_PAIRS: [SlotRole, SlotRole][] = [
  ['poll', 'parent_tip'], ['conversation', 'product'], ['poll', 'educational'], ['conversation', 'visual'],
  ['poll', 'product'], ['conversation', 'parent_tip'], ['poll', 'educational'],
]
export function compactRoles(day: number, perDay: number): SlotRole[] {
  const [a, b] = COMPACT_PAIRS[day % COMPACT_PAIRS.length]
  if (perDay <= 1) return ['founder_story']
  if (perDay === 2) return ['founder_story', a]
  if (perDay === 3) return ['founder_story', a, 'soft_conversion']
  if (perDay === 4) return ['founder_story', a, b, 'soft_conversion']
  return DAILY_ROLES.filter((r) => ROLE_PRIORITY.slice(0, perDay).includes(r))
}

function rolesForDay(day: number, perDay: number, weights: PlanWeights): SlotRole[] {
  let roles = perDay >= DAILY_ROLES.length ? [...DAILY_ROLES] : compactRoles(day, perDay)
  // Learning: on alternate days, swap up to two weak roles (< 0.75) for strong ones (≥ 1.25); never 3 of a role a day.
  const w = (r: SlotRole) => weights.roles?.[r] ?? 1
  const strong = [...new Set(roles)].filter((r) => w(r) >= 1.25).sort((a, b) => w(b) - w(a))
  const weak = roles.filter((r) => w(r) < 0.75).sort((a, b) => w(a) - w(b))
  if (day % 2 === 0 && strong.length) {
    let swaps = 0
    for (const r of weak) {
      if (swaps >= 2) break
      const to = strong.find((s) => roles.filter((x) => x === s).length < 2)
      if (!to) break
      roles = roles.map((x, i) => (i === roles.indexOf(r) ? to : x))
      swaps++
    }
  }
  return roles
}

interface SlotShape { pillar: Pillar; category: string; format: PostFormat; template?: TemplateKey; library?: 'video' | 'carousel' | 'image'; thread?: boolean }

function shape(role: SlotRole, day: number, weights: PlanWeights, budgetGreen: boolean): SlotShape {
  const fw = (f: PostFormat) => weights.formats?.[f] ?? 1
  const video = fw('video') >= 0.75
  const imageOk = fw('image') >= 0.75
  switch (role) {
    case 'founder_story': {
      const pillar: Pillar = day === 1 || day === 4 ? 'ai_thinking' : 'founder_journey'
      if (day === 3 && budgetGreen && fw('thread') >= 0.75) return { pillar, category: 'founder_stories', format: 'thread', thread: true }
      return day % 3 === 2 && imageOk ? { pillar, category: 'founder_stories', format: 'image', template: 'founder_quote' } : { pillar, category: pillar === 'ai_thinking' ? 'ai_content' : 'founder_stories', format: 'text' }
    }
    case 'parent_tip':
      return day % 2 === 0 && imageOk ? { pillar: 'useful_tips', category: 'planning_tips', format: 'image', template: day % 4 === 0 ? 'tip' : 'checklist' } : { pillar: 'useful_tips', category: 'planning_tips', format: 'text' }
    case 'conversation':
      return { pillar: 'community_question', category: 'questions', format: 'text' }
    case 'visual':
      if (day === 5 && video) return { pillar: 'parent_pain', category: 'videos', format: 'video', library: 'video' }
      return day % 2 === 0 ? { pillar: 'parent_pain', category: 'visuals', format: 'image', library: 'image', template: 'pain_point' } : { pillar: 'parent_pain', category: 'visuals', format: 'image', template: day % 3 === 0 ? 'inspiration' : 'this_or_that' }
    case 'educational':
      return fw('carousel') < 0.75
        ? { pillar: 'useful_tips', category: 'planning_tips', format: 'image', template: 'tip' }
        : { pillar: 'useful_tips', category: 'carousels', format: 'carousel', library: day % 2 === 0 ? 'carousel' : undefined, template: day % 3 === 1 ? 'venue_compare' : day % 3 === 2 ? 'ai_tip' : 'checklist' }
    case 'product':
      if ((day === 0 || day === 2 || day === 4) && video) return { pillar: 'product_education', category: 'videos', format: 'video', library: 'video' }
      return { pillar: 'product_education', category: day % 3 === 0 ? 'venue_content' : 'product_features', format: 'image', template: 'product_feature' }
    case 'poll':
      return { pillar: 'community_question', category: 'polls', format: 'poll' }
    case 'soft_conversion':
      return day % 2 === 0 && imageOk ? { pillar: 'launch_invitation', category: 'ctas', format: 'image', template: 'product_feature' } : { pillar: 'launch_invitation', category: 'ctas', format: 'text' }
  }
}

/** How many $0.20 link posts the remaining budget can absorb this week (never more than one a day). */
export function affordableLinks(budget: BudgetSnapshot | null, cfg: MarketingConfig, slots: number): number {
  if (!budget) return 0
  const premium = Math.max(0, budget.prices.post_create_url - budget.prices.post_create)
  const room = budget.x.budget - budget.x.reserve - budget.x.projected
  const byBudget = premium ? Math.floor(Math.max(0, room) / premium) : 7
  return Math.max(0, Math.min(byBudget, Math.ceil(slots * cfg.urlShare), 7))
}

export async function planWeek(store: MarketingStore, cfg: MarketingConfig, opts: { weekStart: string; now?: Date; budget?: BudgetSnapshot | null; weights?: PlanWeights; force?: boolean; platform?: 'x' }): Promise<PlanRow> {
  const platform = opts.platform ?? 'x'
  const existing = await store.getPlan(platform, opts.weekStart)
  if (existing && !opts.force && existing.status !== 'cancelled') return existing
  const now = opts.now ?? new Date()
  const weights = opts.weights ?? {}
  const budgetGreen = !opts.budget || opts.budget.x.status === 'GREEN'
  const recent = await store.listPosts({ platform, since: new Date(now.getTime() - 30 * 86_400_000).toISOString(), limit: 1000 })
  const history: StrategyPost[] = recent.map(toStrategyPost)
  const times = cfg.postTimes.slice(0, cfg.postsPerDay)
  const slots: PlanSlot[] = []
  // Media similarity: nothing already queued or used in the last 14 days is planned again.
  const usedMedia = new Set<string>(recent.filter((p) => p.status !== 'cancelled' && now.getTime() - new Date(p.publishedAt ?? p.createdAt).getTime() < 14 * 86_400_000).flatMap((p) => p.mediaIds))
  let links = affordableLinks(opts.budget ?? null, cfg, cfg.postsPerDay * 7)
  const today = localDate(now, cfg.timezone)

  for (let day = 0; day < 7; day++) {
    const date = addDays(opts.weekStart, day)
    const roles = rolesForDay(day, times.length, weights)
    for (let i = 0; i < times.length; i++) {
      const role = roles[i]
      const at = zonedToUtc(date, times[i], cfg.timezone)
      const s = shape(role, day, weights, budgetGreen)
      const plannedHistory = slots.map((x): StrategyPost => ({ id: `plan-${x.index}`, pillar: x.pillar, topicKey: x.topicKey, status: 'scheduled', hasLink: x.link, hasImage: x.media.source !== 'none', at: x.at }))
      const preferVenue = s.category === 'venue_content'
      const topic = selectTopic(s.pillar, [...history, ...plannedHistory], at, preferVenue ? (day % 2 ? 'age-fit-venues' : 'venue-discovery') : null)
      let media: PlanSlot['media'] = { source: 'none' }
      if (s.library) {
        const pick = await pickLibraryMedia(store, { kind: s.library, now: at, exclude: usedMedia, prefer: [s.category, s.pillar, role] })
        if (pick) {
          pick.ids.forEach((id) => usedMedia.add(id))
          media = { source: 'library', kind: s.library, libraryIds: pick.ids, libraryNote: [pick.rows[0].title, pick.rows[0].description].filter(Boolean).join(' — ').slice(0, 400) }
        }
      }
      let format = s.format
      if (media.source === 'none' && s.template) media = { source: 'template', kind: format === 'carousel' ? 'carousel' : 'image', template: s.template }
      if (media.source === 'none' && (format === 'video' || format === 'carousel' || format === 'image')) {
        // No reusable media left: fall back to a free branded card.
        format = 'image'
        media = { source: 'template', kind: 'image', template: s.pillar === 'product_education' ? 'product_feature' : 'pain_point' }
      }
      const link = role === 'soft_conversion' && links > 0 && !slots.some((x) => x.date === date && x.link)
      if (link) links--
      slots.push({
        index: slots.length,
        date,
        time: times[i],
        at: at.toISOString(),
        role,
        pillar: s.pillar,
        category: s.category,
        format,
        topicKey: topic.key,
        topicAngle: topic.angle,
        link,
        thread: !!s.thread,
        media,
        status: date < today ? 'skipped' : 'planned',
        note: date < today ? 'In the past when planned.' : undefined,
      })
    }
  }
  return store.savePlan({ id: existing?.id, platform, week_start: opts.weekStart, status: 'planned', slots, notes: { weights, links: slots.filter((x) => x.link).length, budgetStatus: opts.budget?.x.status ?? null, generatedAt: now.toISOString() } })
}

export const planSlots = (p: PlanRow | null): PlanSlot[] => ((p?.slots as unknown as PlanSlot[]) ?? [])
