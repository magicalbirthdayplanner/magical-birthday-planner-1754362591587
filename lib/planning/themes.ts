/**
 * Theme recommendations from the existing catalogue (data/themes-data.ts). Pure.
 */
import type { InterestId } from '@/lib/discovery/taxonomy'

export interface ThemeLike {
  id: string
  name: string
  category: string
  ageRange: string
  keywords: string[]
  popularity: number
}

const INTEREST_KEYWORDS: Record<InterestId, string[]> = {
  art: ['art', 'paint', 'craft', 'color', 'rainbow', 'creative', 'artist'],
  sports: ['sport', 'soccer', 'football', 'basketball', 'baseball', 'olympic', 'ninja', 'athlete'],
  science: ['science', 'space', 'robot', 'lab', 'dinosaur', 'astronaut', 'planet', 'stem'],
  animals: ['animal', 'safari', 'zoo', 'farm', 'puppy', 'kitten', 'pet', 'jungle', 'dinosaur', 'ocean'],
  adventure: ['adventure', 'pirate', 'explorer', 'camping', 'treasure', 'jungle', 'ninja'],
  gaming: ['game', 'gaming', 'video', 'minecraft', 'arcade', 'lego'],
  princess: ['princess', 'royal', 'fairy', 'castle', 'tea party', 'unicorn', 'frozen'],
  superhero: ['superhero', 'hero', 'marvel', 'spider', 'batman', 'avengers'],
  music: ['music', 'dance', 'rock', 'pop star', 'disco', 'karaoke'],
  nature: ['nature', 'garden', 'butterfly', 'flower', 'woodland', 'camping', 'bug'],
  dance: ['dance', 'ballet', 'disco', 'music', 'pop star'],
  cooking: ['cook', 'baking', 'chef', 'cupcake', 'candy', 'ice cream', 'sweet'],
}

/** "3-8" | "5+" | "All ages" → [min, max] */
export function parseAgeRange(range: string): [number, number] {
  const r = range.toLowerCase()
  const m = r.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const plus = r.match(/(\d+)\s*\+/)
  if (plus) return [Number(plus[1]), 13]
  return [0, 13]
}

export interface ScoredTheme<T> {
  theme: T
  score: number
  matched: InterestId[]
}

export function recommendThemes<T extends ThemeLike>(themes: T[], opts: { age?: number | null; interests: InterestId[] }, limit = 6): ScoredTheme<T>[] {
  return themes
    .map((theme) => {
      const hay = `${theme.name} ${theme.category} ${theme.keywords.join(' ')}`.toLowerCase()
      // Word-start matching: "craft" must not match "Minecraft", "art" must not match "party".
      const matched = opts.interests.filter((i) => INTEREST_KEYWORDS[i]?.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay)))
      const [min, max] = parseAgeRange(theme.ageRange)
      const ageOk = opts.age == null || (opts.age >= min && opts.age <= max)
      const score = matched.length * 10 + (ageOk ? 5 : -20) + theme.popularity / 2
      return { theme, score, matched }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.theme.name.localeCompare(b.theme.name))
    .slice(0, limit)
}
