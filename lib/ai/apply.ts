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

type DB = SupabaseClient<Database>
export type ApplyOutcome =
  | { status: 'applied'; message: string; undo: boolean }
  | { status: 'duplicate' | 'already'; message: string }
  | { status: 'error'; code: 'not_found' | 'invalid_input' | 'provider_error'; message: string }

const ItemId = z.string().regex(/^(?:[a-z]+-\d{1,3}|theme)$/) // "theme" = the party plan's single theme
const Target = z.enum(['checklist', 'activities', 'shopping_list', 'theme', 'budget'])
/** "Add all": several items of one generation into one target (never the theme — there is only one). */
export const ApplyManyBody = z.object({ generationId: z.string().uuid(), target: Target.exclude(['theme']), itemIds: z.array(ItemId).min(1).max(40) }).strict()

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
    food: { shopping_list: arr(result.shoppingList) }, // ids food-n
    shopping_list: { shopping_list: arr(result.items) },
    budget_optimizer: { budget: [...arr(result.suggestions), ...arr(result.missing)] },
    timeline: { checklist: arr(result.prepTasks) }, // prep tasks carry a server-computed dueDate
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
    const name = e.title ?? s(item.name, 120)
    const { data, error } = await db
      .from('party_ai_activities')
      .insert({ party_id: partyId, user_id: userId, name, description: (e.notes ?? (s(item.description, 1000) || s(item.whyItFits, 1000))) || null, duration_min: n(item.durationMin, 0, 600), estimated_cost: n(item.estimatedCost), materials: (Array.isArray(item.materials) ? item.materials : []).map((m) => s(m, 60)).filter(Boolean).slice(0, 12), details: pickDetails(item), source_generation_id: gen.id, source_item_id: req.itemId })
      .select('id')
      .single()
    if (isUnique(error)) return { status: 'duplicate', message: 'That activity is already in your plan.' }
    if (error) return { status: 'error', code: 'provider_error', message: 'We couldn’t add that activity. Please try again.' }
    rowId = data.id
    message = 'Added to your activities.'
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
  const table = { checklist: 'checklist_items', activities: 'party_ai_activities', shopping_list: 'party_shopping_items', budget: 'party_budget_lines' } as const
  if (req.target === 'theme') {
    await db.from('parties').update({ theme: (entry.undo?.previousTheme as string | null) ?? null, theme_details: (entry.undo?.previousDetails as Json) ?? null }).eq('id', gen.party_id)
  } else if (req.target === 'budget' && entry.undo?.previousAmount != null && entry.rowId) {
    await db.from('party_budget_lines').update({ amount: entry.undo.previousAmount as number }).eq('id', entry.rowId)
  } else if (entry.rowId && req.target in table) {
    await db.from(table[req.target as keyof typeof table]).delete().eq('id', entry.rowId).eq('party_id', gen.party_id)
  }
  await db.rpc('ai_mark_applied', { p_id: gen.id, p_entry: { itemId: req.itemId, target: `undo:${req.target}`, at: new Date().toISOString() } as unknown as Json })
  return true
}
