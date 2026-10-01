import { db, type Tables } from '@/lib/db/browser'
import { generateChecklist, localToday, type ChecklistInput } from '@/lib/planning/checklist'

export type ChecklistItem = Tables<'checklist_items'>

const COLS = 'id, party_id, task_key, title, detail, category, due_date, completed_at, sort_order, is_custom, created_at, updated_at'

export async function listChecklist(partyId: string): Promise<ChecklistItem[]> {
  const { data, error } = await db.from('checklist_items').select(COLS).eq('party_id', partyId).order('due_date', { ascending: true }).order('sort_order')
  if (error) throw error
  return (data ?? []) as ChecklistItem[]
}

/**
 * Create the generated tasks the party doesn't have yet. Existing tasks (and
 * their completion state) are never overwritten — keyed by (party_id, task_key).
 */
export async function ensureChecklist(partyId: string, input: Omit<ChecklistInput, 'today'>): Promise<ChecklistItem[]> {
  const tasks = generateChecklist({ ...input, today: localToday() })
  const now = new Date().toISOString()
  const rows = tasks.map(({ completed, ...t }) => ({ ...t, party_id: partyId, completed_at: completed ? now : null }))
  const { error } = await db.from('checklist_items').upsert(rows, { onConflict: 'party_id,task_key', ignoreDuplicates: true })
  if (error) throw error
  return listChecklist(partyId)
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await db.from('checklist_items').update({ completed_at: done ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw error
}

export async function completeTaskByKey(partyId: string, key: string): Promise<void> {
  await db.from('checklist_items').update({ completed_at: new Date().toISOString() }).eq('party_id', partyId).eq('task_key', key).is('completed_at', null)
}

export async function addCustomTask(partyId: string, title: string, dueDate: string | null): Promise<void> {
  const { error } = await db.from('checklist_items').insert({
    party_id: partyId,
    task_key: `custom-${crypto.randomUUID()}`,
    title: title.trim().slice(0, 200),
    due_date: dueDate,
    is_custom: true,
    category: 'general',
    sort_order: 1000,
  })
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await db.from('checklist_items').delete().eq('id', id)
  if (error) throw error
}
