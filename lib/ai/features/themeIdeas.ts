/** theme_ideas: 5 hybrid themes for /plan/theme; "Use this theme" applies one through /api/ai/apply. */
import 'server-only'
import type { z } from 'zod'
import { BaseBody, itemId, type FeatureSpec } from '../handler'
import { themeIdeasPrompt } from '../prompts/themeIdeas'
import { ThemeIdeasSchema, type ThemeIdeasModelOutput, type ThemeIdeasResult } from '../schemas/themeIdeas'

export const ThemeIdeasBody = BaseBody.strict()
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'theme'

export function postProcessThemes(out: ThemeIdeasModelOutput, scrubbed: boolean): ThemeIdeasResult {
  const seen = new Set<string>()
  const themes = out.themes
    .filter((t) => !seen.has(t.name.toLowerCase()) && seen.add(t.name.toLowerCase()))
    .map((t, i) => ({ ...t, id: itemId('theme', i), slug: slugify(t.name) }))
  const assumptions = scrubbed ? [...out.assumptions, 'Some character or brand names were replaced with generic ideas.'] : out.assumptions
  return { themes, assumptions }
}

export const themeIdeasSpec: FeatureSpec<typeof ThemeIdeasBody, ThemeIdeasResult> = {
  feature: 'theme_ideas',
  body: ThemeIdeasBody,
  result: ThemeIdeasSchema as unknown as z.ZodType<ThemeIdeasResult>,
  maxTokens: 1800,
  prompt: ({ ctx, notes }) => themeIdeasPrompt(ctx, notes),
  post: ({ result, scrubbed }) => postProcessThemes(result as unknown as ThemeIdeasModelOutput, scrubbed),
  summary: (_b, ctx) => ({ childAge: ctx.childAge, interests: ctx.childInterests.length, daysUntilParty: ctx.daysUntilParty }),
}
