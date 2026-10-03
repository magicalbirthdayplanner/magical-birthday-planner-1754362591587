'use client'
/**
 * The party's saved plan items — activities, shopping list, budget lines — that the AI assistant adds (and the
 * parent edits). Browser client: everything runs as the signed-in user under RLS (owns_party).
 */
import useSWR from 'swr'
import { db, type Tables } from '@/lib/db/browser'
import type { AIFeature } from '@/lib/ai/types'

export type PlanActivity = Pick<Tables<'party_ai_activities'>, 'id' | 'name' | 'description' | 'duration_min' | 'estimated_cost' | 'materials' | 'details' | 'status'>
export type ShoppingItem = Pick<Tables<'party_shopping_items'>, 'id' | 'item' | 'qty' | 'category' | 'estimated_cost' | 'done'>
export type BudgetLine = Pick<Tables<'party_budget_lines'>, 'id' | 'category' | 'label' | 'amount' | 'actual_amount' | 'source_generation_id'>

export interface PartyPlanItems {
  activities: PlanActivity[]
  shopping: ShoppingItem[]
  budget: BudgetLine[]
}

export const planItemsKey = (partyId: string) => ['ai-party-items', partyId] as const

/** Empty (not an error) when the AI tables aren't there yet, so non-AI screens never break. */
export async function listPlanItems(partyId: string): Promise<PartyPlanItems> {
  const [a, s, b] = await Promise.all([
    db.from('party_ai_activities').select('id, name, description, duration_min, estimated_cost, materials, details, status').eq('party_id', partyId).eq('status', 'planned').order('sort_order').order('created_at'),
    db.from('party_shopping_items').select('id, item, qty, category, estimated_cost, done').eq('party_id', partyId).order('created_at'),
    db.from('party_budget_lines').select('id, category, label, amount, actual_amount, source_generation_id').eq('party_id', partyId).order('created_at'),
  ])
  return { activities: a.data ?? [], shopping: s.data ?? [], budget: b.data ?? [] }
}

export function usePlanItems(partyId: string | null | undefined) {
  return useSWR(partyId ? planItemsKey(partyId) : null, () => listPlanItems(partyId!), { revalidateOnFocus: false })
}

/** Same cleanup as the Activities tab: timeline slot, unfinished prep tasks and estimate-only budget lines go too. */
export async function removeActivity(id: string) {
  const { error } = await db.rpc('remove_party_activity', { p_activity: id })
  if (error) throw error
}
export async function setShoppingDone(id: string, done: boolean) {
  const { error } = await db.from('party_shopping_items').update({ done }).eq('id', id)
  if (error) throw error
}
export async function removeShoppingItem(id: string) {
  const { error } = await db.from('party_shopping_items').delete().eq('id', id)
  if (error) throw error
}
/** What the parent actually spent. Only ever set here, by the parent — never by AI. */
export async function setActualSpend(id: string, actual: number | null) {
  const { error } = await db.from('party_budget_lines').update({ actual_amount: actual }).eq('id', id)
  if (error) throw error
}
export async function removeBudgetLine(id: string) {
  const { error } = await db.from('party_budget_lines').delete().eq('id', id)
  if (error) throw error
}

export interface LastGeneration<R> { generationId: string; result: R; appliedKeys: string[]; createdAt: string }

/** "target:itemId" for every item currently applied (an undo cancels the apply before it). */
export function appliedKeysFrom(applied: unknown): string[] {
  const keys = new Set<string>()
  for (const e of Array.isArray(applied) ? (applied as { itemId?: string; target?: string }[]) : []) {
    if (!e?.itemId || !e.target) continue
    if (e.target.startsWith('undo:')) keys.delete(`${e.target.slice(5)}:${e.itemId}`)
    else keys.add(`${e.target}:${e.itemId}`)
  }
  return [...keys]
}

/** The party's most recent successful result for a feature (owner-only SELECT), so reopening never costs a suggestion. */
export async function lastGeneration<R>(partyId: string, feature: AIFeature): Promise<LastGeneration<R> | null> {
  const { data } = await db
    .from('ai_generations')
    .select('id, result, applied, created_at')
    .eq('party_id', partyId)
    .eq('feature', feature)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.result) return null
  return { generationId: data.id, result: data.result as R, appliedKeys: appliedKeysFrom(data.applied), createdAt: data.created_at }
}
