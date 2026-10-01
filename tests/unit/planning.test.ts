import { describe, expect, it } from 'vitest'
import { bucketFor, daysBetween, generateChecklist, groupTasks } from '@/lib/planning/checklist'
import { countdownLabel, daysUntil, nextAction, partyProgress, type ProgressInput } from '@/lib/planning/progress'
import { parseAgeRange, recommendThemes } from '@/lib/planning/themes'
import { classicThemes } from '@/data/themes-data'

describe('generateChecklist', () => {
  const base = { partyDate: '2026-12-12', today: '2026-10-01', guestCount: 20, childName: 'Ava Smith' }

  it('builds a countdown-aware plan from party facts', () => {
    const tasks = generateChecklist(base)
    const byKey = Object.fromEntries(tasks.map((t) => [t.task_key, t]))
    expect(byKey['choose-venue'].due_date).toBe('2026-10-31')
    expect(byKey['order-cake'].due_date).toBe('2026-11-28')
    expect(byKey['enjoy'].title).toBe("Enjoy Ava's party!")
    expect(byKey['enjoy'].due_date).toBe('2026-12-12')
    expect(byKey['thank-yous'].due_date).toBe('2026-12-15')
    expect(byKey['rain-plan']).toBeUndefined()
  })

  it('adapts to venue, setting and guest count', () => {
    const keys = (x: Parameters<typeof generateChecklist>[0]) => generateChecklist(x).map((t) => t.task_key)
    expect(keys({ ...base, hasVenue: true })).not.toContain('choose-venue')
    expect(keys({ ...base, setting: 'outdoor' })).toContain('rain-plan')
    expect(keys({ ...base, guestCount: 4 })).not.toContain('book-entertainment')
  })

  it('pulls overdue tasks to today when the party is soon', () => {
    const tasks = generateChecklist({ ...base, today: '2026-12-08' })
    const venue = tasks.find((t) => t.task_key === 'choose-venue')!
    expect(venue.due_date).toBe('2026-12-08')
    for (const t of tasks.filter((t) => t.task_key !== 'thank-yous')) expect(t.due_date <= '2026-12-12').toBe(true)
  })

  it('groups into Today / This week / Later / Completed', () => {
    const today = '2026-10-01'
    const g = groupTasks(
      [
        { id: 1, due_date: '2026-09-28', completed_at: null },
        { id: 2, due_date: '2026-10-01', completed_at: null },
        { id: 3, due_date: '2026-10-05', completed_at: null },
        { id: 4, due_date: '2026-11-05', completed_at: null },
        { id: 5, due_date: '2026-10-02', completed_at: '2026-10-01T10:00:00Z' },
      ],
      today,
    )
    expect(g.today.map((t) => t.id)).toEqual([1, 2])
    expect(g.week.map((t) => t.id)).toEqual([3])
    expect(g.later.map((t) => t.id)).toEqual([4])
    expect(g.done.map((t) => t.id)).toEqual([5])
    expect(bucketFor({ due_date: '2026-09-30', completed_at: null }, today)).toBe('overdue')
  })

  it('counts days across DST boundaries', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1)
  })
})

describe('progress & next action', () => {
  const base: ProgressInput = {
    today: '2026-10-01', partyDate: '2026-10-13', hasVenue: false, savedVenueCount: 0, hasTheme: false,
    guestCount: 0, invitationShared: false, checklistDone: 0, checklistTotal: 10,
  }

  it('walks the parent through the key milestones in order', () => {
    expect(nextAction(base)).toMatchObject({ kind: 'venue', href: '/discover' })
    expect(nextAction({ ...base, savedVenueCount: 2 })).toMatchObject({ kind: 'venue', href: '/discover/saved' })
    expect(nextAction({ ...base, hasVenue: true })).toMatchObject({ kind: 'theme' })
    expect(nextAction({ ...base, hasVenue: true, hasTheme: true })).toMatchObject({ kind: 'guests' })
    expect(nextAction({ ...base, hasVenue: true, hasTheme: true, guestCount: 3 })).toMatchObject({ kind: 'invite' })
    expect(nextAction({ ...base, hasVenue: true, hasTheme: true, guestCount: 3, invitationShared: true, nextChecklistTitle: 'Order the cake' }))
      .toMatchObject({ kind: 'checklist', title: 'Order the cake' })
  })

  it('computes a 0–100 progress score', () => {
    expect(partyProgress(base)).toBe(10)
    expect(partyProgress({ ...base, hasVenue: true, hasTheme: true, guestCount: 5, invitationShared: true, checklistDone: 10 })).toBe(100)
    expect(partyProgress({ ...base, hasVenue: true, hasTheme: true, checklistDone: 3 })).toBe(49)
  })

  it('counts down', () => {
    expect(daysUntil('2026-10-13', '2026-10-01')).toBe(12)
    expect(countdownLabel(12)).toBe('12 days')
    expect(countdownLabel(1)).toBe('Tomorrow')
    expect(countdownLabel(0)).toBe('Today!')
  })
})

describe('theme recommendations', () => {
  it('parses age ranges', () => {
    expect(parseAgeRange('3-8')).toEqual([3, 8])
    expect(parseAgeRange('5+')).toEqual([5, 13])
    expect(parseAgeRange('All ages')).toEqual([0, 13])
  })

  it('recommends catalogue themes for an art-loving 7-year-old', () => {
    const recs = recommendThemes(classicThemes, { age: 7, interests: ['art'] })
    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].matched).toContain('art')
    const ids = new Set(classicThemes.map((t) => t.id))
    for (const r of recs) expect(ids.has(r.theme.id)).toBe(true)
  })

  it('still recommends popular age-appropriate themes with no interests', () => {
    expect(recommendThemes(classicThemes, { age: 4, interests: [] }).length).toBeGreaterThan(0)
  })
})

describe('theme interest matching', () => {
  it('matches whole words only (no "Minecraft" for craft, no "party" for art)', () => {
    const themes = [
      { id: 'mc', name: 'Minecraft Block Building', category: 'gaming', ageRange: '6-12', keywords: ['minecraft', 'blocks'], popularity: 9 },
      { id: 'pool', name: 'Swimming Pool Party', category: 'sports', ageRange: '4-12', keywords: ['pool', 'party'], popularity: 8 },
      { id: 'paint', name: 'Little Artists Studio', category: 'creative', ageRange: '3-10', keywords: ['painting', 'art'], popularity: 7 },
    ]
    const recs = recommendThemes(themes, { age: 7, interests: ['art'] })
    expect(recs.find((r) => r.theme.id === 'paint')?.matched).toEqual(['art'])
    expect(recs.find((r) => r.theme.id === 'mc')?.matched ?? []).toEqual([])
    expect(recs.find((r) => r.theme.id === 'pool')?.matched ?? []).toEqual([])
  })
})

describe('state-aware checklist generation', () => {
  it('pre-completes milestones the party already has', () => {
    const tasks = generateChecklist({ partyDate: '2026-12-12', today: '2026-10-01', theme: 'dinosaur-adventure', hasGuests: true })
    const byKey = Object.fromEntries(tasks.map((t) => [t.task_key, t]))
    expect(byKey['pick-theme'].completed).toBe(true)
    expect(byKey['guest-list'].completed).toBe(true)
    expect(byKey['send-invites'].completed).toBe(false)
    expect(byKey['order-cake'].completed).toBe(false)
  })
})
