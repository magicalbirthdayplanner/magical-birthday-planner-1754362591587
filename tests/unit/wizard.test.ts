import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT, WIZARD_STEPS, dateSuggestions, firstIncompleteStep, parseDraft, validateStep } from '@/lib/planning/wizard'

const today = '2026-10-01' // Thursday
const complete = {
  ...EMPTY_DRAFT,
  childName: 'Ava',
  childAge: 7,
  partyDate: '2026-10-13',
  zip: '48084',
  zipPlace: { city: 'Troy', state: 'MI', lat: 42.56, lng: -83.18 },
  guestCount: 20,
  budget: 500,
  setting: 'either' as const,
  interests: ['art' as const],
}

describe('wizard validation', () => {
  it('has the nine questions from the product spec, in order', () => {
    expect(WIZARD_STEPS).toEqual(['name', 'age', 'date', 'zip', 'guests', 'budget', 'vibe', 'interests', 'theme'])
  })

  it('accepts a complete draft', () => {
    for (const s of WIZARD_STEPS) expect(validateStep(s, complete, today), s).toBeNull()
  })

  it.each([
    ['name', { childName: '  ' }],
    ['name', { childName: 'x'.repeat(41) }],
    ['age', { childAge: null }],
    ['age', { childAge: 40 }],
    ['date', { partyDate: '' }],
    ['date', { partyDate: '2026-09-30' }],
    ['date', { partyDate: '2029-01-01' }],
    ['zip', { zip: '4808' }],
    ['zip', { zipPlace: null }],
    ['guests', { guestCount: 0 }],
    ['guests', { guestCount: 1000 }],
    ['budget', { budget: null, budgetUnsure: false }],
  ] as const)('rejects bad %s', (step, patch) => {
    expect(validateStep(step, { ...complete, ...patch }, today)).not.toBeNull()
  })

  it('treats budget as optional when the parent is not sure', () => {
    expect(validateStep('budget', { ...complete, budget: null, budgetUnsure: true }, today)).toBeNull()
  })

  it('resumes at the first incomplete step', () => {
    expect(firstIncompleteStep(EMPTY_DRAFT, today)).toBe(0)
    expect(firstIncompleteStep({ ...complete, zipPlace: null }, today)).toBe(3)
    expect(firstIncompleteStep(complete, today)).toBe(8)
  })

  it('parses drafts defensively', () => {
    expect(parseDraft(null)).toBeNull()
    expect(parseDraft('{bad')).toBeNull()
    const d = parseDraft(JSON.stringify({ childName: 'Ava', interests: ['art', 'hacking'], setting: 'moon', guestCount: 'x' }))!
    expect(d.interests).toEqual(['art'])
    expect(d.setting).toBe('either')
    expect(d.guestCount).toBe(EMPTY_DRAFT.guestCount)
  })

  it('suggests upcoming Saturdays', () => {
    const s = dateSuggestions(today)
    expect(s[0]).toEqual({ label: 'This Saturday', date: '2026-10-03' })
    expect(s[1].date).toBe('2026-10-10')
    expect(dateSuggestions('2026-10-03')[0].date).toBe('2026-10-10') // on a Saturday → next one
  })
})
