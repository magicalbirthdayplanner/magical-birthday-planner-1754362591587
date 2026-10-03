import { z } from 'zod'
import { list, num, optStr, pick, str, strList } from './shared'

export const ChecklistTaskSchema = z.object({
  title: str(120),
  notes: optStr(300),
  daysBeforeParty: num(0, 120, 7),
  priority: pick(['high', 'medium', 'low'] as const, 'medium'),
  effort: pick(['quick', 'medium', 'big'] as const, 'quick'),
})
export const ChecklistAISchema = z.object({ tasks: list(ChecklistTaskSchema, 15, 1), assumptions: strList(6, 200) })
export type ChecklistModelOutput = z.infer<typeof ChecklistAISchema>
export interface ChecklistResult {
  tasks: (z.infer<typeof ChecklistTaskSchema> & { id: string; dueDate: string | null; late: boolean })[]
  assumptions: string[]
  skipped: number
}
