/**
 * Apply one saved AI suggestion item to the party. The item is loaded from the stored generation (never from the
 * client); optional edits are re-validated; writes go through the user's RLS session; duplicates are no-ops.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Json } from '@/lib/db/database.types'
import { cleanText } from './safety'
import type { ApplyTarget } from './types'
import { activityColumns, ActivityDetailSchema, TIMELINE_KINDS, type TimelineKind } from '@/lib/experience/model'
import { FOOD_CATEGORIES } from './schemas/food'

type DB = SupabaseClient<Database>
export type ApplyOutcome =
  | { status: 'applied'; message: string; undo: boolean }
  | { status: 'duplicate' | 'already'; message: string }
  | { status: 'error'; code: 'not_found' | 'invalid_input' | 'provider_error'; message: string }

const ItemId = z.string().regex(/^(?:[a-z]+-\d{1,3}|theme)$/) // "theme" = the party plan's single theme
const Target = z.enum(['checklist', 'activities', 'activity_update', 'shopping_list', 'theme', 'budget', 'timeline', 'food', 'host'])
/** "Add all": several items of one generation into one target (never the theme or an activity revision — there is only one). */
export const ApplyManyBody = z.object({ generationId: z.string().uuid(), target: Target.exclude(['theme', 'activity_update']), itemIds: z.array(ItemId).min(1).max(40) }).strict()

export const ApplyBody = z.object({
  generationId: z.string().uuid(),
  itemId: ItemId,
  target: Target,
  edits: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      notes: z.string().trim().max(500).optional(),
      amount: z.number().min(0).max(100000).optional(),
      qty: z.string().trim().max(40).optional(),
      /** host content: the parent's edited text */
      body: z.string().trim().min(1).max(4000).optional(),
      /** activities: save as an idea instead of adding to the party plan */
      status: z.enum(['idea', 'planned']).optional(),
    })
    .strict()
    .optional(),
}).strict()
export type ApplyRequest = z.infer<typeof ApplyBody>

type Item = Record<string, unknown> & { id: string }
const arr = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]) : [])

/** Where each feature keeps the items each target can take. */
export function findItem(feature: string, result: Record<string, unknown>, target: ApplyTarget, itemId: string): Item | null {
  const pools: Record<string, Partial<Record<ApplyTarget, Item[]>>> = {
    party_planner: {
      activities: arr(result.activities),
      shopping_list: arr(result.shoppingList),
      budget: arr((result.budget as { lines?: unknown })?.lines),
      // the plan's theme carries the plan's decorations and activity names, so the Theme page shows them too
      theme: result.theme ? [{ decorations: result.decorations, activities: arr(result.activities).map((a) => a.name), ...(result.theme as object), id: 'theme' } as Item] : [],
    },
    theme_ideas: { theme: arr(result.themes) },
    checklist: { checklist: arr(result.tasks) },
    activities: { activities: arr(result.activities) },
    food: { shopping_list: arr(result.shoppingList), food: arr(result.items), budget: arr(result.budget) }, // ids food-n / dish-n / fbud-1
    shopping_list: { shopping_list: arr(result.items) },
    budget_optimizer: { budget: [...arr(result.suggestions), ...arr(result.missing)] },
    timeline: { checklist: arr(result.prepTasks), timeline: arr(result.entries) }, // prep tasks carry a server-computed dueDate
    activity_studio: result.activity ? { activities: [result.activity as Item], activity_update: result.targetActivityId ? [result.activity as Item] : [] } : {},
    host_content: { host: arr(result.items) },
    party_experience: {
      theme: result.theme ? [result.theme as Item] : [],
      activities: arr(result.activities),
      timeline: arr(result.timeline),
      food: arr(result.food),
      shopping_list: arr(result.shopping),
      host: arr(result.host),
      checklist: arr(result.checklist),
      budget: arr((result.budget as { lines?: unknown })?.lines),
    },
  }
  return pools[feature]?.[target]?.find((i) => i.id === itemId) ?? null
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? cleanText(v, max).text : '')
const n = (v: unknown, min = 0, max = 100000) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)
const slug = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
const isUnique = (e: { code?: string } | null) => e?.code === '23505'

export async function applyItem(db: DB, userId: string, req: ApplyRequest): Promise<ApplyOutcome> {
  const { data: gen } = await db.from('ai_generations').select('id, party_id, feature, status, result, applied').eq('id', req.generationId).maybeSingle()
  if (!gen || gen.status !== 'success' || !gen.result) return { status: 'error', code: 'not_found', message: 'That suggestion is no longer available.' }
  const applied = (Array.isArray(gen.applied) ? gen.applied : []) as { itemId?: string; target?: string }[]
  const last = applied.filter((a) => a.itemId === req.itemId && (a.target === req.target || a.target === `undo:${req.target}`)).at(-1)
  if (last?.target === req.target) return { status: 'already', message: 'Already added.' } // undone items can be added again
  const item = findItem(gen.feature, gen.result as Record<string, unknown>, req.target, req.itemId)
  if (!item) return { status: 'error', code: 'not_found', message: 'That suggestion is no longer available.' }
  const partyId = gen.party_id
  const e = req.edits ?? {}
  let rowId: string | null = null
  let undo: Record<string, unknown> = {}
  let message = 'Added.'

  if (req.target === 'checklist') {
    const title = e.title ?? s(item.title, 200)
    if (!title) return { status: 'error', code: 'invalid_input', message: 'That task needs a title.' }
    const { data: existing } = await db.from('checklist_items').select('id, title').eq('party_id', partyId)
    if ((existing ?? []).some((x) => x.title.trim().toLowerCase() === title.toLowerCase())) return { status: 'duplicate', message: 'That task is already on your checklist.' }
    const due = typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : null
    const { data, error } = await db.from('checklist_items').insert({ party_id: partyId, user_id: userId, task_key: `ai-${slug(title)}`, title, detail: (e.notes ?? s(item.notes, 500)) || null, due_date: due, category: 'general', is_custom: true, sort_order: 900 }).select('id').single()
    if (isUnique(error)) return { status: 'duplicate', message: 'That task is already on your checklist.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that task. Please try again.' }
    rowId = data.id
    message = 'Added to your checklist.'
  } else if (req.target === 'activities') {
    const r = gen.result as { designedForGuests?: number | null; designedForTheme?: string | null }
    const detailed = Array.isArray(item.instructions) && typeof item.duration_minutes === 'number'
    const parsed = detailed ? ActivityDetailSchema.safeParse(item) : null
    if (parsed && !parsed.success) return { status: 'error', code: 'not_found', message: 'That suggestion is no longer available.' }
    const base = parsed?.success
      ? activityColumns(parsed.data)
      : { name: s(item.name, 120), description: (s(item.description, 1000) || s(item.whyItFits, 1000)) || null, duration_min: n(item.durationMin, 0, 600), estimated_cost: n(item.estimatedCost), materials: (Array.isArray(item.materials) ? item.materials : []).map((m) => s(m, 60)).filter(Boolean).slice(0, 12), details: pickDetails(item) }
    const status = e.status ?? 'planned'
    const { data: last } = await db.from('party_ai_activities').select('sort_order').eq('party_id', partyId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await db
      .from('party_ai_activities')
      .insert({
        ...base, name: e.title ?? base.name, description: e.notes ?? base.description, details: base.details as NonNullable<Json>,
        party_id: partyId, user_id: userId, status, origin: 'ai', approved_at: status === 'planned' ? new Date().toISOString() : null,
        designed_for_guests: r.designedForGuests ?? null, designed_for_theme: r.designedForTheme?.slice(0, 80) ?? null, sort_order: (last?.sort_order ?? 0) + 1,
        source_generation_id: gen.id, source_item_id: req.itemId,
      })
      .select('id')
      .single()
    if (isUnique(error)) return { status: 'duplicate', message: 'That activity is already in your party.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that activity. Please try again.' }
    rowId = data.id
    message = status === 'idea' ? 'Saved to your activity ideas.' : 'Added to your activities.'
  } else if (req.target === 'activity_update') {
    // Replace an existing activity's content with the AI revision the parent chose (same row, same links).
    const r = gen.result as { targetActivityId?: string | null; designedForGuests?: number | null; designedForTheme?: string | null }
    const parsed = ActivityDetailSchema.safeParse(item)
    if (!r.targetActivityId || !parsed.success) return { status: 'error', code: 'not_found', message: 'That suggestion is no longer available.' }
    const { data: prev } = await db.from('party_ai_activities').select('name, description, duration_min, estimated_cost, materials, category, age_min, age_max, setting, difficulty, cleanup_level, details, user_edited, designed_for_guests, designed_for_theme').eq('id', r.targetActivityId).eq('party_id', partyId).maybeSingle()
    if (!prev) return { status: 'error', code: 'not_found', message: 'That activity is no longer in your party.' }
    const cols = activityColumns(parsed.data)
    const { error } = await db.from('party_ai_activities').update({ ...cols, details: cols.details as NonNullable<Json>, user_edited: false, designed_for_guests: r.designedForGuests ?? null, designed_for_theme: r.designedForTheme?.slice(0, 80) ?? null }).eq('id', r.targetActivityId)
    if (isUnique(error)) return { status: 'duplicate', message: 'Another activity already has that name.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t update that activity. Please try again.' }
    rowId = r.targetActivityId
    undo = { previous: prev }
    message = 'Activity updated.'
  } else if (req.target === 'timeline') {
    const label = e.title ?? s(item.label, 120)
    if (!label) return { status: 'error', code: 'invalid_input', message: 'That timeline step needs a name.' }
    const kind: TimelineKind = (TIMELINE_KINDS as readonly string[]).includes(String(item.kind)) ? (item.kind as TimelineKind) : 'other'
    const [{ data: rows }, { data: acts }] = await Promise.all([
      db.from('party_timeline_items').select('label, sort_order, activity_id').eq('party_id', partyId),
      db.from('party_ai_activities').select('id, name').eq('party_id', partyId).eq('status', 'planned'),
    ])
    if ((rows ?? []).some((x) => x.label.trim().toLowerCase() === label.toLowerCase())) return { status: 'duplicate', message: 'That’s already on your timeline.' }
    // An activity step links to the party's own activity of that name (its duration then follows the activity).
    const taken = new Set((rows ?? []).map((x) => x.activity_id).filter(Boolean))
    const act = kind === 'activity' || kind === 'other' ? (acts ?? []).find((a) => !taken.has(a.id) && (label.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(label.toLowerCase()))) : undefined
    const sort = Math.max(0, ...(rows ?? []).map((x) => x.sort_order)) + 1
    const { data, error } = await db.from('party_timeline_items').insert({ party_id: partyId, user_id: userId, kind: act ? 'activity' : kind, label, duration_min: act ? null : n(item.duration, 0, 600), sort_order: sort, activity_id: act?.id ?? null, origin: 'ai', source_generation_id: gen.id, source_item_id: req.itemId }).select('id').single()
    if (isUnique(error)) return { status: 'duplicate', message: 'That activity is already on your timeline.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that to your timeline. Please try again.' }
    rowId = data.id
    message = 'Added to your timeline.'
  } else if (req.target === 'food') {
    const r = gen.result as { guests?: number | null; designedForGuests?: number | null }
    const name = e.title ?? s(item.name, 120)
    const cat = (FOOD_CATEGORIES as readonly string[]).includes(String(item.category)) ? String(item.category) : 'other'
    const { data, error } = await db
      .from('party_food_items')
      .insert({ party_id: partyId, user_id: userId, name, category: cat, quantity: n(item.quantity, 0, 10000), unit: s(item.unit, 30) || null, estimated_cost: n(item.estimated_cost), dietary_tags: (Array.isArray(item.dietary_tags) ? item.dietary_tags : []).map((t) => s(t, 40)).filter(Boolean).slice(0, 5), notes: (e.notes ?? s(item.notes, 300)) || null, designed_for_guests: r.guests ?? r.designedForGuests ?? null, origin: 'ai', source_generation_id: gen.id, source_item_id: req.itemId })
      .select('id')
      .single()
    if (isUnique(error)) return { status: 'duplicate', message: 'That’s already on your menu.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that to your menu. Please try again.' }
    rowId = data.id
    message = 'Added to your menu.'
  } else if (req.target === 'host') {
    const KINDS = ['welcome', 'activity_intro', 'cake', 'closing', 'thank_you_all', 'thank_you_guest', 'reminder']
    const kind = KINDS.includes(String(item.kind)) ? String(item.kind) : 'welcome'
    const body = e.body ?? s(item.body, 4000)
    if (!body) return { status: 'error', code: 'invalid_input', message: 'That message is empty.' }
    const { data, error } = await db
      .from('party_host_content')
      .insert({ party_id: partyId, user_id: userId, kind, title: s(item.title, 120) || null, body, activity_id: typeof item.activityId === 'string' ? item.activityId : null, guest_id: typeof item.guestId === 'string' ? item.guestId : null, origin: 'ai', user_edited: !!e.body, source_generation_id: gen.id, source_item_id: req.itemId })
      .select('id')
      .single()
    if (error) return { status: 'error', code: error.code === '23503' ? 'not_found' : 'provider_error', message: error.code === '23503' ? 'That guest or activity is no longer in your party.' : 'We couldn’t save that. Please try again.' }
    rowId = data.id
    message = 'Saved to your party.'
  } else if (req.target === 'shopping_list') {
    const name = e.title ?? s(item.item, 120)
    const cat = ['food', 'decorations', 'activities', 'favors', 'other'].includes(String(item.category)) ? String(item.category) : 'other'
    const { data, error } = await db
      .from('party_shopping_items')
      .insert({ party_id: partyId, user_id: userId, item: name, qty: (e.qty ?? s(item.qty, 40)) || null, category: cat, estimated_cost: n(item.estimatedCost), source_generation_id: gen.id, source_item_id: req.itemId })
      .select('id')
      .single()
    if (isUnique(error)) return { status: 'duplicate', message: 'That’s already on your shopping list.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that item. Please try again.' }
    rowId = data.id
    message = 'Added to your shopping list.'
  } else if (req.target === 'budget') {
    const category = e.title ?? s(item.category, 60)
    const amount = e.amount ?? n(item.newAmount ?? item.amount)
    if (!category || amount == null) return { status: 'error', code: 'invalid_input', message: 'That budget line needs a category and an amount.' }
    const label = item.label ? s(item.label, 120) : null
    const { data: existing } = await db.from('party_budget_lines').select('id, category, label, amount').eq('party_id', partyId)
    const match = (existing ?? []).find((x) => x.category.toLowerCase() === category.toLowerCase() && (x.label ?? '').toLowerCase() === (label ?? '').toLowerCase())
    if (match) {
      if (Number(match.amount) === amount) return { status: 'duplicate', message: 'Your budget already has that line.' }
      const { error } = await db.from('party_budget_lines').update({ amount }).eq('id', match.id)
      if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t update your budget. Please try again.' }
      rowId = match.id
      undo = { previousAmount: Number(match.amount) }
      message = `Budget updated: ${category} $${amount}.`
    } else {
      const { data, error } = await db.from('party_budget_lines').insert({ party_id: partyId, user_id: userId, category, label, amount, source_generation_id: gen.id, source_item_id: req.itemId }).select('id').single()
      if (isUnique(error)) return { status: 'duplicate', message: 'Your budget already has that line.' }
      if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that budget line. Please try again.' }
      rowId = data.id
      message = 'Added to your budget.'
    }
  } else {
    // theme: same shape ThemeScreen saves for AI themes (theme 'ai:<slug>' + theme_details)
    const name = e.title ?? s(item.name, 60)
    const { data: prev } = await db.from('parties').select('theme, theme_details').eq('id', partyId).single()
    const list = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map((x) => s(x, max)).filter(Boolean)
    const details = { name, emoji: s(item.emoji, 8) || '🎉', description: s(item.description, 240) || s(item.why, 240), why: s(item.why, 240), food: list(item.food, 100).slice(0, 5), invitationIdea: s(item.invitationIdea, 200), colors: arr(item.palette).length ? (item.palette as string[]).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 6) : [], activities: (Array.isArray(item.activities) ? item.activities : []).map((x) => s(x, 100)).filter(Boolean).slice(0, 5), decorations: (Array.isArray(item.decorations) ? item.decorations : []).map((x) => s(x, 100)).filter(Boolean).slice(0, 5) }
    if (prev?.theme === `ai:${slug(name)}`) return { status: 'duplicate', message: 'That’s already your theme.' }
    const { error } = await db.from('parties').update({ theme: `ai:${slug(name)}`, theme_details: details as Json }).eq('id', partyId)
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t save that theme. Please try again.' }
    await db.from('checklist_items').update({ completed_at: new Date().toISOString() }).eq('party_id', partyId).eq('task_key', 'pick-theme').is('completed_at', null)
    undo = { previousTheme: prev?.theme ?? null, previousDetails: prev?.theme_details ?? null }
    message = `${details.emoji} ${name} it is!`
  }

  await db.rpc('ai_mark_applied', { p_id: gen.id, p_entry: { itemId: req.itemId, target: req.target, rowId, undo, at: new Date().toISOString() } as unknown as Json })
  return { status: 'applied', message, undo: true }
}

function pickDetails(item: Item): NonNullable<Json> {
  const keep: Record<string, unknown> = {}
  for (const k of ['whyItFits', 'setup', 'instructions', 'cleanup', 'ageSuitability', 'difficulty', 'setting']) {
    const v = item[k]
    if (typeof v === 'string') keep[k] = s(v, 600)
    else if (Array.isArray(v)) keep[k] = v.map((x) => s(x, 200)).filter(Boolean).slice(0, 10)
  }
  return keep as NonNullable<Json>
}

/** Undo the most recent apply of this item (cheap targets only). */
export async function undoItem(db: DB, req: { generationId: string; itemId: string; target: ApplyTarget }): Promise<boolean> {
  const { data: gen } = await db.from('ai_generations').select('id, party_id, applied').eq('id', req.generationId).maybeSingle()
  if (!gen) return false
  const entry = ((Array.isArray(gen.applied) ? gen.applied : []) as { itemId: string; target: string; rowId: string | null; undo?: Record<string, unknown> }[])
    .filter((a) => a.itemId === req.itemId && (a.target === req.target || a.target === `undo:${req.target}`))
    .at(-1)
  // Nothing applied, or already undone: a second Undo must not restore stale values over newer edits.
  if (!entry || entry.target !== req.target) return false
  const table = { checklist: 'checklist_items', activities: 'party_ai_activities', shopping_list: 'party_shopping_items', budget: 'party_budget_lines', timeline: 'party_timeline_items', food: 'party_food_items', host: 'party_host_content' } as const
  if (req.target === 'activity_update') {
    if (entry.rowId && entry.undo?.previous) await db.from('party_ai_activities').update(entry.undo.previous as Database['public']['Tables']['party_ai_activities']['Update']).eq('id', entry.rowId).eq('party_id', gen.party_id)
  } else if (req.target === 'theme') {
    await db.from('parties').update({ theme: (entry.undo?.previousTheme as string | null) ?? null, theme_details: (entry.undo?.previousDetails as Json) ?? null }).eq('id', gen.party_id)
  } else if (req.target === 'budget' && entry.undo?.previousAmount != null && entry.rowId) {
    await db.from('party_budget_lines').update({ amount: entry.undo.previousAmount as number }).eq('id', entry.rowId)
  } else if (entry.rowId && req.target in table) {
    await db.from(table[req.target as keyof typeof table]).delete().eq('id', entry.rowId).eq('party_id', gen.party_id)
  }
  await db.rpc('ai_mark_applied', { p_id: gen.id, p_entry: { itemId: req.itemId, target: `undo:${req.target}`, at: new Date().toISOString() } as unknown as Json })
  return true
}
