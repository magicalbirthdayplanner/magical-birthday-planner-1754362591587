import { z } from 'zod'
import { list, num, optStr, str, strList } from './shared'

export const TIMELINE_ADJUST = ['relaxed', 'more_games', 'less_prep'] as const
export const TimelineAISchema = z.object({
  entries: list(z.object({ minute: num(0, 600), label: str(120), notes: optStr(160) }), 20, 3),
  prepTasks: list(z.object({ title: str(120), daysBeforeParty: num(0, 30, 1), notes: optStr(200) }), 8),
  assumptions: strList(5, 200),
})
export type TimelineModelOutput = z.infer<typeof TimelineAISchema>
export interface TimelineResult {
  durationMinutes: number
  entries: { id: string; minute: number; time: string; label: string; notes: string }[]
  prepTasks: { id: string; title: string; notes: string; daysBeforeParty: number; dueDate: string | null; late: boolean }[]
  assumptions: string[]
}
