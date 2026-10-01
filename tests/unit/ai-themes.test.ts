import { describe, expect, it } from 'vitest'
import { aiThemePrompt, parseAiThemes, slugify } from '@/lib/planning/ai-themes'

const good = { name: 'Galaxy Art Studio', emoji: '🎨', description: 'Paint the stars with glow-in-the-dark crafts and cosmic snacks.', colors: ['#112233', '#445566', '#778899', '#AABBCC'], activities: ['Paint planets', 'Star hunt', 'Rocket relay'], decorations: ['Star garland', 'Moon lanterns', 'Planet balloons'] }

describe('AI theme parsing', () => {
  it('accepts valid themes and assigns stable ids', () => {
    const out = parseAiThemes(JSON.stringify({ themes: [good] }))
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('ai-galaxy-art-studio')
  })
  it('drops malformed entries and garbage', () => {
    expect(parseAiThemes('not json')).toEqual([])
    expect(parseAiThemes(JSON.stringify({ nope: [] }))).toEqual([])
    expect(parseAiThemes(JSON.stringify({ themes: [{ ...good, colors: ['red'] }, good] }))).toHaveLength(1)
  })
  it('slugifies safely', () => {
    expect(slugify('Ünicorn  Dreams!!')).toBe('unicorn-dreams')
  })
  it('does not put the child’s name in the prompt (cache reuse, privacy)', () => {
    const p = aiThemePrompt({ age: 7, interests: ['art'], setting: 'either', guestCount: 20 })
    expect(p).toContain('Child age: 7')
    expect(p).toContain('art')
  })
})
