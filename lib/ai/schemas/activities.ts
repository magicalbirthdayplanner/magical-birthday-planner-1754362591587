import { z } from 'zod'
import { list, num, optStr, pick, str, strList } from './shared'

export const ActivityIdeaSchema = z.object({
  name: str(80),
  description: optStr(300),
  whyItFits: optStr(200),
  durationMin: num(5, 240, 20),
  estimatedCost: num(0, 2000, 0),
  materials: strList(10, 60),
  setup: optStr(300),
  instructions: strList(8, 200),
  cleanup: optStr(200),
  ageSuitability: optStr(120),
  difficulty: pick(['easy', 'medium', 'hard'] as const, 'easy'),
  setting: pick(['indoor', 'outdoor', 'either'] as const, 'either'),
})
export const ActivitiesAISchema = z.object({ activities: list(ActivityIdeaSchema, 6, 2), assumptions: strList(5, 200) })
export type ActivitiesModelOutput = z.infer<typeof ActivitiesAISchema>
export interface ActivitiesResult { activities: (z.infer<typeof ActivityIdeaSchema> & { id: string })[]; assumptions: string[] }
