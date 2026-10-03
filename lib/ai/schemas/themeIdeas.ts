import { z } from 'zod'
import { list, optStr, str, strList } from './shared'

export const ThemeIdeaSchema = z.object({
  name: str(60),
  emoji: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : '🎉'), z.string().transform((s) => Array.from(s).slice(0, 2).join(''))),
  why: optStr(240),
  palette: list(z.string().regex(/^#[0-9a-fA-F]{6}$/), 5),
  decorations: strList(5, 100),
  activities: strList(5, 100),
  ageFit: optStr(120),
})
export const ThemeIdeasSchema = z.object({ themes: list(ThemeIdeaSchema, 5, 3), assumptions: strList(5, 200) })
export type ThemeIdeasModelOutput = z.infer<typeof ThemeIdeasSchema>
export interface ThemeIdeasResult { themes: (z.infer<typeof ThemeIdeaSchema> & { id: string; slug: string })[]; assumptions: string[] }
