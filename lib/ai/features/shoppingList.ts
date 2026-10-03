/**
 * P2-C Shopping list (Plus+). Deterministic: gather candidates from the party's own data, normalise + dedupe in
 * code; the model only categorises item names (it cannot add items).
 */
import 'server-only'
import type { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { SYSTEM_PROMPT } from '../prompts/system'
import { cleanText } from '../safety'
import { ShoppingCategorizeSchema, type ShoppingCategorizeOutput, type ShoppingCategory, type ShoppingListResult } from '../schemas/shoppingList'

export const ShoppingBody = BaseBody.strict()
interface Candidate { item: string; qty: string; category: ShoppingCategory | null; estimatedCost: number; source: string; onList: boolean }

/** "Paper Plates (x20)!" → "paper plate" */
export function normalizeItem(s: string): string {
  return s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(\d+|x\d+|pack|packs|of|set|sets|a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map((w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')
}
const CATS = new Set(['food', 'decorations', 'activities', 'favors', 'other'])
const asCat = (c: unknown): ShoppingCategory | null => (typeof c === 'string' && CATS.has(c) ? (c as ShoppingCategory) : null)

export async function loadCandidates(db: Parameters<NonNullable<FeatureSpec<typeof ShoppingBody, ShoppingListResult>['load']>>[0], partyId: string): Promise<Candidate[]> {
  const [list, acts, party, gens] = await Promise.all([
    db.from('party_shopping_items').select('item, qty, category, estimated_cost').eq('party_id', partyId).limit(200),
    db.from('party_ai_activities').select('name, materials').eq('party_id', partyId).limit(30),
    db.from('parties').select('theme_details').eq('id', partyId).maybeSingle(),
    db.from('ai_generations').select('feature, result').eq('party_id', partyId).eq('status', 'success').in('feature', ['party_planner', 'food']).order('created_at', { ascending: false }).limit(4),
  ])
  const c: Candidate[] = []
  for (const r of list.data ?? []) c.push({ item: r.item, qty: r.qty ?? '', category: asCat(r.category), estimatedCost: Number(r.estimated_cost ?? 0), source: 'your list', onList: true })
  for (const a of acts.data ?? []) for (const m of a.materials ?? []) c.push({ item: m, qty: '', category: 'activities', estimatedCost: 0, source: a.name, onList: false })
  const decos = ((party.data?.theme_details ?? {}) as { decorations?: unknown }).decorations
  if (Array.isArray(decos)) for (const d of decos) if (typeof d === 'string') c.push({ item: d, qty: '', category: 'decorations', estimatedCost: 0, source: 'theme', onList: false })
  for (const g of gens.data ?? []) {
    const items = ((g.result ?? {}) as { shoppingList?: { item?: string; qty?: string; category?: string; estimatedCost?: number }[] }).shoppingList ?? []
    for (const s of items) if (s.item) c.push({ item: s.item, qty: s.qty ?? '', category: asCat(s.category), estimatedCost: Number(s.estimatedCost ?? 0), source: g.feature === 'food' ? 'food plan' : 'party plan', onList: false })
  }
  return c.slice(0, 200)
}

export function mergeCandidates(cands: Candidate[]): Candidate[] & { sources?: never } {
  const byKey = new Map<string, Candidate & { sources: Set<string> }>()
  for (const c of cands) {
    const key = normalizeItem(c.item)
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev) byKey.set(key, { ...c, item: cleanText(c.item, 80).text, sources: new Set([c.source]) })
    else {
      prev.sources.add(c.source)
      prev.onList ||= c.onList
      prev.category ??= c.category
      prev.estimatedCost = Math.max(prev.estimatedCost, c.estimatedCost)
      if (!prev.qty && c.qty) prev.qty = c.qty
    }
  }
  return [...byKey.values()].map((c) => ({ ...c, sources: [...c.sources] })) as unknown as Candidate[]
}

export const shoppingListSpec: FeatureSpec<typeof ShoppingBody, ShoppingListResult> = {
  feature: 'shopping_list',
  body: ShoppingBody,
  result: ShoppingCategorizeSchema as unknown as z.ZodType<ShoppingListResult>,
  maxTokens: 1200,
  load: (db, partyId) => loadCandidates(db, partyId).then(mergeCandidates),
  prompt: ({ extra }) => {
    const items = (extra as Candidate[]).filter((c) => !c.category).map((c) => c.item)
    return {
      system: SYSTEM_PROMPT,
      user: `Categorise each party shopping item into exactly one of: food, decorations, activities, favors, other. Do not add, remove or rename items.
Return JSON exactly: {"categories":[{"item":"","category":"food"}]}
Items: ${JSON.stringify(items.length ? items : ['(none)'])}`,
    }
  },
  post: ({ result, extra }) => {
    const cats = new Map((result as unknown as ShoppingCategorizeOutput).categories.map((c) => [normalizeItem(c.item), c.category]))
    const merged = extra as (Candidate & { sources: string[] })[]
    const order: ShoppingCategory[] = ['food', 'decorations', 'activities', 'favors', 'other']
    const items = merged
      .map((c) => ({ ...c, category: c.category ?? cats.get(normalizeItem(c.item)) ?? 'other' }))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.item.localeCompare(b.item))
      .map((c, i) => ({ id: itemId('shop', i), item: c.item, qty: c.qty, category: c.category, estimatedCost: Math.round(c.estimatedCost * 100) / 100, sources: c.sources, onList: c.onList }))
    return {
      items,
      groups: order.map((category) => ({ category, count: items.filter((x) => x.category === category).length })).filter((g) => g.count),
      estimatedTotal: Math.round(items.reduce((s, x) => s + x.estimatedCost, 0) * 100) / 100,
    }
  },
  summary: () => ({}),
}
