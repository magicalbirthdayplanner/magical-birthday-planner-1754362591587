'use client'
/**
 * Party Experience data (browser, RLS): activities, timeline, menu and saved host content for the active party,
 * plus the explicit "add to …" actions that connect an activity to the checklist, shopping list, budget and
 * timeline. Every write is an explicit parent action; links use source_activity_id so nothing duplicates.
 */
import useSWR from 'swr'
import { db, type Tables } from '@/lib/db/browser'
import type { Json } from '@/lib/db/database.types'
import { DEFAULT_KIND_MINUTES, parseSupply, type ActivityDetails, type TimelineKind } from '@/lib/experience/model'

export type Activity = Tables<'party_ai_activities'>
export type TimelineItem = Tables<'party_timeline_items'>
export type FoodItemRow = Tables<'party_food_items'>
export type HostContent = Tables<'party_host_content'>

export interface Experience {
  activities: Activity[]
  timeline: TimelineItem[]
  food: FoodItemRow[]
  host: HostContent[]
  /** source_activity_id → what is already linked (to show ✓ states) */
  linked: { tasks: Set<string>; shopping: Map<string, string[]>; budget: Set<string> }
}

export const experienceKey = (partyId: string) => ['experience', partyId] as const

export async function loadExperience(partyId: string): Promise<Experience> {
  const [a, t, f, h, c, s, b] = await Promise.all([
    db.from('party_ai_activities').select('*').eq('party_id', partyId).order('sort_order').order('created_at'),
    db.from('party_timeline_items').select('*').eq('party_id', partyId).order('sort_order'),
    db.from('party_food_items').select('*').eq('party_id', partyId).order('created_at'),
    db.from('party_host_content').select('*').eq('party_id', partyId).order('created_at', { ascending: false }),
    db.from('checklist_items').select('source_activity_id').eq('party_id', partyId).not('source_activity_id', 'is', null),
    db.from('party_shopping_items').select('item, source_activity_id').eq('party_id', partyId).not('source_activity_id', 'is', null),
    db.from('party_budget_lines').select('source_activity_id').eq('party_id', partyId).not('source_activity_id', 'is', null),
  ])
  const shopping = new Map<string, string[]>()
  for (const r of s.data ?? []) shopping.set(r.source_activity_id!, [...(shopping.get(r.source_activity_id!) ?? []), r.item.toLowerCase()])
  return {
    activities: a.data ?? [],
    timeline: t.data ?? [],
    food: f.data ?? [],
    host: h.data ?? [],
    linked: { tasks: new Set((c.data ?? []).map((x) => x.source_activity_id!)), shopping, budget: new Set((b.data ?? []).map((x) => x.source_activity_id!)) },
  }
}

export function useExperience(partyId: string | null | undefined) {
  return useSWR(partyId ? experienceKey(partyId) : null, () => loadExperience(partyId!), { revalidateOnFocus: false })
}

const fail = (e: { message?: string; code?: string } | null) => {
  if (e) throw Object.assign(new Error(e.code === '23505' ? 'You already have an activity with that name.' : 'We couldn’t save that. Please try again.'), { code: e.code })
}

// ---------------------------------------------------------------- activities
export interface ActivityInput {
  name: string
  description: string | null
  duration_min: number | null
  setting: 'indoor' | 'outdoor' | 'either'
  age_min: number | null
  age_max: number | null
  estimated_cost: number | null
  materials: string[]
  category?: string
  difficulty?: string
}

/** Parent-created activity (origin user, approved when planned). */
export async function createActivity(partyId: string, userId: string, input: ActivityInput, status: 'idea' | 'planned', context: { guests: number | null; theme: string | null }) {
  const { data: last } = await db.from('party_ai_activities').select('sort_order').eq('party_id', partyId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await db
    .from('party_ai_activities')
    .insert({ ...input, party_id: partyId, user_id: userId, status, origin: 'user', user_edited: true, approved_at: status === 'planned' ? new Date().toISOString() : null, designed_for_guests: context.guests, designed_for_theme: context.theme, sort_order: (last?.sort_order ?? 0) + 1 })
    .select('id')
    .single()
  fail(error)
  return data!.id
}

/** The parent's edit: marked user_edited so later AI suggestions never silently replace it. */
export async function updateActivity(id: string, patch: Partial<ActivityInput> & { details?: ActivityDetails }) {
  const { error } = await db.from('party_ai_activities').update({ ...patch, details: patch.details as NonNullable<Json> | undefined, user_edited: true }).eq('id', id)
  fail(error)
}

export async function setActivityStatus(id: string, status: 'idea' | 'planned') {
  const { error } = await db.from('party_ai_activities').update({ status, approved_at: status === 'planned' ? new Date().toISOString() : null }).eq('id', id)
  fail(error)
}

/** Removes the activity, its timeline slot, unfinished prep tasks and estimate-only budget lines (supplies stay). */
export async function removeActivity(id: string): Promise<{ tasks_removed: number; budget_lines_removed: number }> {
  const { data, error } = await db.rpc('remove_party_activity', { p_activity: id })
  fail(error)
  return data as { tasks_removed: number; budget_lines_removed: number }
}

// ---------------------------------------------------------------- activity → checklist / shopping / budget / timeline
const daysBefore = (partyDate: string, days: number) => {
  const d = new Date(`${partyDate}T12:00:00`)
  d.setDate(d.getDate() - days)
  const today = new Date().toISOString().slice(0, 10)
  const iso = d.toISOString().slice(0, 10)
  return iso < today ? today : iso
}

/** Prep steps → checklist tasks (stable task keys per activity + step; re-adding is a no-op). */
export async function addPrepToChecklist(a: Activity, partyDate: string, steps: string[]) {
  const rows = steps.map((title, i) => ({ party_id: a.party_id, task_key: `act-${a.id}-${i + 1}`, title: title.slice(0, 200), detail: `For “${a.name}”`, due_date: daysBefore(partyDate, i === 0 ? 3 : 1), category: 'general', is_custom: true, sort_order: 800 + i, source_activity_id: a.id }))
  const { error } = await db.from('checklist_items').upsert(rows, { onConflict: 'party_id,task_key', ignoreDuplicates: true })
  fail(error)
  return rows.length
}

/** Supplies → shopping list (dedupes by item name across the whole list). Returns how many were new. */
export async function addSuppliesToShopping(a: Activity, supplies: string[]) {
  const { data: existing } = await db.from('party_shopping_items').select('item').eq('party_id', a.party_id)
  const have = new Set((existing ?? []).map((x) => x.item.toLowerCase()))
  const rows = supplies
    .map(parseSupply)
    .filter((p) => p.item && !have.has(p.item.toLowerCase()) && have.add(p.item.toLowerCase()))
    .map((p) => ({ party_id: a.party_id, item: p.item, qty: p.qty, category: 'activities', source_activity_id: a.id }))
  if (!rows.length) return 0
  const { error } = await db.from('party_shopping_items').insert(rows)
  fail(error)
  return rows.length
}

/** The activity's estimated cost → a planned "Activities" budget line (never the actual spend). */
export async function addCostToBudget(a: Activity) {
  const amount = Number(a.estimated_cost ?? 0)
  const { data: existing } = await db.from('party_budget_lines').select('id').eq('party_id', a.party_id).eq('source_activity_id', a.id).maybeSingle()
  if (existing) {
    const { error } = await db.from('party_budget_lines').update({ amount }).eq('id', existing.id)
    fail(error)
    return 'updated' as const
  }
  const { error } = await db.from('party_budget_lines').insert({ party_id: a.party_id, category: 'Activities', label: a.name.slice(0, 120), amount, source_activity_id: a.id })
  fail(error)
  return 'added' as const
}

export async function addActivityToTimeline(a: Activity, timeline: TimelineItem[]) {
  if (timeline.some((t) => t.activity_id === a.id)) return false
  // before cake/gifts/closing if those exist, else at the end
  const sorted = [...timeline].sort((x, y) => x.sort_order - y.sort_order)
  const tail = sorted.find((t) => t.kind === 'cake' || t.kind === 'gifts' || t.kind === 'closing')
  const sort = tail ? tail.sort_order : (sorted.at(-1)?.sort_order ?? 0) + 1
  if (tail) await shiftFrom(a.party_id, sorted, tail.sort_order)
  const { error } = await db.from('party_timeline_items').insert({ party_id: a.party_id, kind: 'activity', label: a.name.slice(0, 120), activity_id: a.id, sort_order: sort, origin: 'user' })
  fail(error)
  return true
}

async function shiftFrom(_partyId: string, sorted: TimelineItem[], from: number) {
  for (const t of [...sorted].reverse()) if (t.sort_order >= from) await db.from('party_timeline_items').update({ sort_order: t.sort_order + 1 }).eq('id', t.id)
}

// ---------------------------------------------------------------- timeline
export async function addTimelineStep(partyId: string, timeline: TimelineItem[], kind: TimelineKind, label: string, minutes: number | null) {
  const { error } = await db.from('party_timeline_items').insert({ party_id: partyId, kind, label: label.slice(0, 120), duration_min: minutes ?? DEFAULT_KIND_MINUTES[kind], sort_order: Math.max(0, ...timeline.map((t) => t.sort_order)) + 1, origin: 'user' })
  fail(error)
}

/** Swap with the neighbour (renumbers the whole list so orders stay unique and dense). */
export async function moveTimelineStep(timeline: TimelineItem[], id: string, dir: -1 | 1) {
  const sorted = [...timeline].sort((x, y) => x.sort_order - y.sort_order)
  const i = sorted.findIndex((t) => t.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return
  ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
  await Promise.all(sorted.map((t, k) => (t.sort_order === k + 1 ? null : db.from('party_timeline_items').update({ sort_order: k + 1 }).eq('id', t.id))))
}

export async function setTimelineMinutes(id: string, minutes: number) {
  const { error } = await db.from('party_timeline_items').update({ duration_min: Math.max(0, Math.min(600, Math.round(minutes))) }).eq('id', id)
  fail(error)
}

export async function removeTimelineStep(id: string) {
  const { error } = await db.from('party_timeline_items').delete().eq('id', id)
  fail(error)
}

// ---------------------------------------------------------------- menu & host content
export async function removeFoodItem(id: string) {
  const { error } = await db.from('party_food_items').delete().eq('id', id)
  fail(error)
}

/** Menu line → shopping list (quantity as text). */
export async function addFoodToShopping(f: FoodItemRow) {
  const { error } = await db.from('party_shopping_items').insert({ party_id: f.party_id, item: f.name.slice(0, 120), qty: [f.quantity != null ? Number(f.quantity) : null, f.unit].filter(Boolean).join(' ').slice(0, 40) || null, category: 'food', estimated_cost: f.estimated_cost })
  if (error?.code === '23505') return false
  fail(error)
  return true
}

export async function saveHostContent(id: string, body: string) {
  const { error } = await db.from('party_host_content').update({ body: body.slice(0, 4000), user_edited: true }).eq('id', id)
  fail(error)
}
export async function removeHostContent(id: string) {
  const { error } = await db.from('party_host_content').delete().eq('id', id)
  fail(error)
}
