import { z } from 'zod'
import { shouldBlockAISuggestions } from '@/lib/profanity-filter'

export const AiThemeSchema = z.object({
  name: z.string().min(2).max(60),
  emoji: z.string().min(1).max(8),
  description: z.string().min(10).max(240),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(5),
  activities: z.array(z.string().min(2).max(80)).min(1).max(4),
  decorations: z.array(z.string().min(2).max(80)).min(1).max(4),
})
export type AiTheme = z.infer<typeof AiThemeSchema> & { id: string }

export const AiThemesResponseSchema = z.object({ themes: z.array(z.unknown()).min(1).max(8) })

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

/** Validate and clean model output: drop anything malformed or unsafe. */
export function parseAiThemes(raw: string): AiTheme[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  const outer = AiThemesResponseSchema.safeParse(data)
  if (!outer.success) return []
  const out: AiTheme[] = []
  for (const t of outer.data.themes) {
    const r = AiThemeSchema.safeParse(t)
    if (!r.success) continue
    const text = [r.data.name, r.data.description, ...r.data.activities, ...r.data.decorations].join(' ')
    if (shouldBlockAISuggestions(text)) continue
    out.push({ ...r.data, id: `ai-${slugify(r.data.name)}` })
  }
  return out
}

export function aiThemePrompt(input: { age: number | null; interests: string[]; setting: string; guestCount: number | null }) {
  return [
    'You are a children’s party stylist. Suggest 4 distinct, original birthday party themes for parents to choose from.',
    `Child age: ${input.age ?? 'unknown'}. Interests: ${input.interests.join(', ') || 'none given'}. Setting: ${input.setting}. Guests: ${input.guestCount ?? 'unknown'}.`,
    'Keep themes age-appropriate, inclusive, and achievable on a normal family budget. Avoid trademarked characters and brand names.',
    'Respond ONLY with JSON: {"themes":[{"name":string,"emoji":string,"description":string (max 200 chars),"colors":[4 hex colors like "#AABBCC"],"activities":[3 short strings],"decorations":[3 short strings]}]}',
  ].join('\n')
}
