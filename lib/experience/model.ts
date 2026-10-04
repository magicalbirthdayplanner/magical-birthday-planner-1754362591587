/**
 * Party Experience domain: the shared shapes and pure calculations used by the Activities tab, the timeline,
 * the AI activity studio and the apply step. Client-safe (no secrets, no server modules). Unit-tested.
 */
import { z } from 'zod'
import { list, num, optStr, pick, str, strList } from '@/lib/ai/schemas/shared'

export const ACTIVITY_CATEGORIES = ['game', 'craft', 'treasure_hunt', 'active', 'calm', 'performance', 'food', 'other'] as const
export const SETTINGS = ['indoor', 'outdoor', 'either'] as const
export const DIFFICULTY = ['easy', 'medium', 'hard'] as const
export const CLEANUP = ['none', 'low', 'medium', 'high'] as const
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]
export type Setting = (typeof SETTINGS)[number]

const category = z.preprocess((v) => {
  const s = typeof v === 'string' ? v.toLowerCase().replace(/[\s-]+/g, '_') : ''
  if ((ACTIVITY_CATEGORIES as readonly string[]).includes(s)) return s
  if (/treasure|scavenger|hunt/.test(s)) return 'treasure_hunt'
  if (/craft|art|paint|make/.test(s)) return 'craft'
  if (/race|relay|run|sport|active|dance/.test(s)) return 'active'
  if (/story|quiet|calm/.test(s)) return 'calm'
  if (/show|perform|music|karaoke/.test(s)) return 'performance'
  if (/cook|bake|decorat.*(cake|cookie|cupcake)|food/.test(s)) return 'food'
  return s ? 'game' : 'other'
}, z.enum(ACTIVITY_CATEGORIES))

/** One fully described activity, as the AI returns it (lenient in, strict out). */
export const ActivityDetailSchema = z.object({
  name: str(80),
  emoji: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : '🎉'), z.string().transform((s) => Array.from(s).slice(0, 2).join(''))),
  description: str(300),
  category,
  age_min: num(0, 18, 4),
  age_max: num(0, 18, 10),
  duration_minutes: num(5, 180, 20),
  indoor_outdoor: pick(SETTINGS, 'either'),
  estimated_cost: num(0, 2000, 0),
  difficulty: pick(DIFFICULTY, 'easy'),
  materials: strList(15, 80),
  preparation_steps: strList(8, 160),
  instructions: list(str(220), 10, 1),
  host_script: optStr(700),
  cleanup_level: pick(CLEANUP, 'low'),
  safety_notes: strList(4, 200),
  variations: strList(3, 200),
  backup_version: optStr(300),
}).transform((a) => ({ ...a, age_min: Math.round(Math.min(a.age_min, a.age_max)), age_max: Math.round(Math.max(a.age_min, a.age_max)), duration_minutes: Math.round(a.duration_minutes), estimated_cost: Math.round(a.estimated_cost * 100) / 100 }))
export type ActivityDetail = z.output<typeof ActivityDetailSchema>

/** What lives in party_ai_activities.details (long-form sections). */
export interface ActivityDetails {
  emoji?: string
  preparation_steps?: string[]
  instructions?: string[]
  host_script?: string
  safety_notes?: string[]
  variations?: string[]
  backup_version?: string
  // legacy keys written by the first AI version (still rendered)
  whyItFits?: string
  setup?: string
  cleanup?: string
}

/** Row → DB columns for party_ai_activities (shared by the apply step and tests). */
export function activityColumns(a: ActivityDetail) {
  return {
    name: a.name,
    description: a.description || null,
    duration_min: a.duration_minutes,
    estimated_cost: a.estimated_cost,
    materials: a.materials.slice(0, 15),
    category: a.category,
    age_min: a.age_min,
    age_max: a.age_max,
    setting: a.indoor_outdoor,
    difficulty: a.difficulty,
    cleanup_level: a.cleanup_level,
    details: {
      emoji: a.emoji,
      preparation_steps: a.preparation_steps,
      instructions: a.instructions,
      host_script: a.host_script || undefined,
      safety_notes: a.safety_notes,
      variations: a.variations,
      backup_version: a.backup_version || undefined,
    } satisfies ActivityDetails,
  }
}

// ---------------------------------------------------------------- AI edits ("Make it yours")
export const ACTIVITY_EDITS = {
  cheaper: 'Make it cheaper: cut the cost clearly, reuse household items.',
  exciting: 'Make it more exciting: add a twist, stakes or a reveal, same core idea.',
  easier: 'Make it easier to prepare and to run.',
  shorter: 'Make it shorter (about two thirds of the time).',
  longer: 'Make it longer (about one and a half times), with an extra round or stage.',
  indoor: 'Make it work indoors in a normal home.',
  outdoor: 'Make it work outdoors (yard or park).',
  less_messy: 'Make it less messy: no glitter, paint spills or loose small pieces; low cleanup.',
  younger: 'Make it work for younger kids: simpler rules, bigger pieces, shorter attention span.',
  older: 'Make it work for older kids: more challenge and independence.',
  guests: 'Adjust it for the current guest count: quantities, teams and timing.',
  theme: 'Adapt it to the party’s current theme while keeping what made it work.',
} as const
export type ActivityEdit = keyof typeof ACTIVITY_EDITS
export const ACTIVITY_EDIT_KEYS = Object.keys(ACTIVITY_EDITS) as ActivityEdit[]

// ---------------------------------------------------------------- timeline
export const TIMELINE_KINDS = ['arrival', 'welcome', 'activity', 'food', 'cake', 'gifts', 'closing', 'other'] as const
export type TimelineKind = (typeof TIMELINE_KINDS)[number]
export const DEFAULT_KIND_MINUTES: Record<TimelineKind, number> = { arrival: 15, welcome: 5, activity: 20, food: 20, cake: 15, gifts: 10, closing: 10, other: 10 }

export interface TimelineRow { id: string; kind: TimelineKind; label: string; duration_min: number | null; sort_order: number; activity_id: string | null }
export interface TimedRow extends TimelineRow { start: number; minutes: number; clock: string }

/** "14:00" + 75 → "3:15 PM"; without a start time → "+1:15". */
export function clockAt(startTime: string | null, offsetMin: number): string {
  if (startTime && /^\d{1,2}:\d{2}/.test(startTime)) {
    const [h, m] = startTime.split(':').map(Number)
    const t = (h * 60 + m + offsetMin) % (24 * 60)
    const hh = Math.floor(t / 60), mm = t % 60
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`
  }
  return `+${Math.floor(offsetMin / 60)}:${String(offsetMin % 60).padStart(2, '0')}`
}

/** Ordered rows → start offsets. Activity rows use the activity's current duration (canonical). */
export function computeTimeline(rows: TimelineRow[], activityMinutes: (id: string) => number | null, startTime: string | null): { rows: TimedRow[]; totalMinutes: number } {
  let t = 0
  const out = [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => {
      const minutes = Math.max(0, Math.round((r.activity_id ? activityMinutes(r.activity_id) : null) ?? r.duration_min ?? DEFAULT_KIND_MINUTES[r.kind]))
      const row = { ...r, start: t, minutes, clock: clockAt(startTime, t) }
      t += minutes
      return row
    })
  return { rows: out, totalMinutes: t }
}

/** A model's minute-offset schedule → ordered rows with durations (gaps become the previous row's length). */
export function offsetsToDurations<T extends { minute: number }>(entries: T[], endMinute: number): (T & { duration: number })[] {
  const sorted = [...entries].sort((a, b) => a.minute - b.minute)
  return sorted.map((e, i) => ({ ...e, duration: Math.max(0, Math.round((sorted[i + 1]?.minute ?? Math.max(endMinute, e.minute)) - e.minute)) }))
}

// ---------------------------------------------------------------- guests & quantities
/** Guests the party is planning for: confirmed RSVPs when they exceed the plan, else the planned count. */
export function effectiveGuests(planned: number | null | undefined, rsvp: { kids: number; adults: number } | null): number | null {
  const confirmed = rsvp ? rsvp.kids + rsvp.adults : 0
  const p = planned && planned > 0 ? planned : null
  if (p == null) return confirmed || null
  return Math.max(p, confirmed)
}

/** True when the party now has materially more/fewer guests than something was designed for (≥3 and ≥15 %). */
export function guestDrift(designedFor: number | null | undefined, now: number | null | undefined): boolean {
  if (!designedFor || !now) return false
  const d = Math.abs(now - designedFor)
  return d >= 3 && d / designedFor >= 0.15
}

/** Scale a per-party quantity to a new guest count (whole units, never below 1 when the source was ≥ 1). */
export function scaleQuantity(qty: number, fromGuests: number, toGuests: number): number {
  if (!fromGuests || fromGuests <= 0) return qty
  const v = Math.ceil((qty * toGuests) / fromGuests)
  return qty >= 1 ? Math.max(1, v) : v
}

/** "Glow sticks × 20" / "20 glow sticks" / "Glow sticks (20)" → item + qty text. */
export function parseSupply(s: string): { item: string; qty: string | null } {
  const t = s.trim().replace(/\s+/g, ' ')
  let m = t.match(/^(.*?)\s*[×x*]\s*(\d+(?:\.\d+)?\s*\w*)$/i)
  if (m && m[1]) return { item: cap(m[1]), qty: m[2] }
  m = t.match(/^(.*?)\s*\((\d+[^)]*)\)$/)
  if (m && m[1]) return { item: cap(m[1]), qty: m[2] }
  m = t.match(/^(\d+(?:\.\d+)?)\s+(?:(packs?|sets?|rolls?|bags?|boxes?|sheets?|bottles?|lbs?|oz)\s+(?:of\s+)?)?(.+)$/i)
  if (m) return { item: cap(m[3]), qty: m[2] ? `${m[1]} ${m[2]}` : m[1] }
  return { item: cap(t), qty: null }
}
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s).slice(0, 120)

// ---------------------------------------------------------------- summaries
export interface ActivityLike { status: string; duration_min: number | null; estimated_cost: number | string | null }
export function activitySummary(rows: ActivityLike[]) {
  const planned = rows.filter((r) => r.status === 'planned')
  return {
    planned: planned.length,
    ideas: rows.length - planned.length,
    minutes: planned.reduce((s, r) => s + (r.duration_min ?? 0), 0),
    estimatedCost: Math.round(planned.reduce((s, r) => s + Number(r.estimated_cost ?? 0), 0) * 100) / 100,
  }
}

export const formatMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`)
export const ageRange = (min: number | null, max: number | null) => (min != null && max != null ? (min === max ? `Age ${min}` : `Ages ${min}–${max}`) : min != null ? `Ages ${min}+` : null)
export const costRange = (n: number | string | null) => {
  const v = Number(n ?? 0)
  if (!v) return 'Free'
  if (v < 10) return `~$${Math.round(v)}`
  const lo = Math.max(1, Math.round(v * 0.85)), hi = Math.round(v * 1.15)
  return `$${lo}–${hi}`
}

/** The party details AI results are built on, computed the same way as the server (lib/ai/context.ts). */
export interface PartyNow { childAge: number | null; guests: number | null; budget: number | null; theme: string | null }
export function partyNow(party: { child_age: number | null; guest_count: number | null; budget: number | string | null; theme: string | null; theme_details: unknown }, guests: { rsvp_status: string | null; child_count: number | null; adult_count: number | null }[] = []): PartyNow {
  const yes = guests.filter((g) => g.rsvp_status === 'CONFIRMED')
  const rsvp = guests.length ? { kids: yes.reduce((s, g) => s + (g.child_count ?? 0), 0), adults: yes.reduce((s, g) => s + (g.adult_count ?? 0), 0) } : null
  const details = (party.theme_details ?? null) as { name?: string } | null
  return {
    childAge: party.child_age ?? null,
    guests: effectiveGuests(party.guest_count, rsvp),
    budget: party.budget != null ? Number(party.budget) : null,
    theme: details?.name ?? (party.theme && !party.theme.startsWith('ai:') ? party.theme : null),
  }
}

/**
 * What changed in the party since a stored AI result was made (from the generation's structured input summary), so
 * a reopened result can offer "Refresh with your new party details". One-off values the parent typed into the
 * planner (overrides) are not party details and are ignored; guest changes count when material (guestDrift).
 */
export function partyDetailsChanged(summary: Record<string, unknown> | null | undefined, now: PartyNow | null): string[] {
  if (!summary || !now) return []
  const overridden = new Set(Array.isArray(summary.overrides) ? (summary.overrides as string[]) : [])
  const num = (v: unknown) => (v == null || v === '' ? null : Number(v))
  const has = (k: string) => k in summary && !overridden.has(k)
  const out: string[] = []
  if (has('childAge') && num(summary.childAge) !== now.childAge) out.push('age')
  const guestsKey = 'guestCount' in summary ? 'guestCount' : 'guests'
  if (has(guestsKey) && guestDrift(num(summary[guestsKey]), now.guests)) out.push('guest count')
  if (has('budget') && num(summary.budget) !== now.budget) out.push('budget')
  if (has('theme') && (summary.theme ?? null) !== now.theme) out.push('theme')
  return out
}
