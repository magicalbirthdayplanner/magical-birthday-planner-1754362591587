/** Party-creation wizard: steps, validation and draft persistence. Pure. */
import type { InterestId, Setting } from '@/lib/discovery/taxonomy'
import { INTEREST_IDS } from '@/lib/discovery/taxonomy'
import { normalizeZip } from '@/lib/geo/zip'
import { daysBetween } from './checklist'

export const WIZARD_STEPS = ['name', 'age', 'date', 'zip', 'guests', 'budget', 'vibe', 'interests', 'theme'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export interface WizardDraft {
  childName: string
  childAge: number | null
  partyDate: string
  zip: string
  zipPlace: { city: string | null; state: string | null; lat: number; lng: number } | null
  guestCount: number
  budget: number | null
  budgetUnsure: boolean
  setting: Setting
  interests: InterestId[]
  theme: string | null
}

export const EMPTY_DRAFT: WizardDraft = {
  childName: '',
  childAge: null,
  partyDate: '',
  zip: '',
  zipPlace: null,
  guestCount: 15,
  budget: null,
  budgetUnsure: false,
  setting: 'either',
  interests: [],
  theme: null,
}

export const MIN_AGE = 1
export const MAX_AGE = 14

/** Returns an error message for the step, or null when it is complete. */
export function validateStep(step: WizardStep, d: WizardDraft, today: string): string | null {
  switch (step) {
    case 'name': {
      const n = d.childName.trim()
      if (!n) return 'Please enter a name.'
      if (n.length > 40) return 'Please keep the name under 40 characters.'
      return null
    }
    case 'age':
      return d.childAge != null && d.childAge >= MIN_AGE && d.childAge <= MAX_AGE ? null : 'Please choose an age.'
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.partyDate)) return 'Please pick a date.'
      const delta = daysBetween(today, d.partyDate)
      if (delta < 0) return 'Please pick a date that hasn’t passed.'
      if (delta > 730) return 'Please pick a date within the next two years.'
      return null
    }
    case 'zip':
      if (!normalizeZip(d.zip)) return 'Please enter a 5-digit US ZIP code.'
      if (!d.zipPlace) return 'We need to find that ZIP first.'
      return null
    case 'guests':
      return Number.isInteger(d.guestCount) && d.guestCount >= 1 && d.guestCount <= 200 ? null : 'Please enter between 1 and 200 guests.'
    case 'budget':
      if (d.budgetUnsure) return null
      return d.budget != null && d.budget >= 0 && d.budget <= 100_000 ? null : 'Pick a budget, or choose “Not sure yet”.'
    case 'vibe':
      return ['indoor', 'outdoor', 'either'].includes(d.setting) ? null : 'Please choose one.'
    case 'interests':
    case 'theme':
      return null
  }
}

export function firstIncompleteStep(d: WizardDraft, today: string): number {
  const i = WIZARD_STEPS.findIndex((s) => validateStep(s, d, today) !== null)
  return i === -1 ? WIZARD_STEPS.length - 1 : i
}

export function parseDraft(raw: string | null): WizardDraft | null {
  if (!raw) return null
  try {
    const x = JSON.parse(raw) as Partial<WizardDraft>
    const allowed = new Set<string>(INTEREST_IDS)
    return {
      ...EMPTY_DRAFT,
      childName: typeof x.childName === 'string' ? x.childName.slice(0, 40) : '',
      childAge: typeof x.childAge === 'number' ? x.childAge : null,
      partyDate: typeof x.partyDate === 'string' ? x.partyDate : '',
      zip: typeof x.zip === 'string' ? x.zip.slice(0, 10) : '',
      zipPlace: x.zipPlace && typeof x.zipPlace.lat === 'number' ? x.zipPlace : null,
      guestCount: typeof x.guestCount === 'number' ? x.guestCount : EMPTY_DRAFT.guestCount,
      budget: typeof x.budget === 'number' ? x.budget : null,
      budgetUnsure: !!x.budgetUnsure,
      setting: x.setting === 'indoor' || x.setting === 'outdoor' ? x.setting : 'either',
      interests: Array.isArray(x.interests) ? (x.interests.filter((i) => allowed.has(i)) as InterestId[]) : [],
      theme: typeof x.theme === 'string' ? x.theme : null,
    }
  } catch {
    return null
  }
}

/** Quick date suggestions: upcoming Saturdays + "in a month". */
export function dateSuggestions(today: string): { label: string; date: string }[] {
  const [y, m, d] = today.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const toIso = (dt: Date) => dt.toISOString().slice(0, 10)
  const dow = base.getUTCDay()
  const daysToSat = (6 - dow + 7) % 7 || 7
  const sat = (weeks: number) => toIso(new Date(base.getTime() + (daysToSat + 7 * weeks) * 86_400_000))
  return [
    { label: 'This Saturday', date: sat(0) },
    { label: 'Next Saturday', date: sat(1) },
    { label: 'In 2 weeks', date: sat(2) },
    { label: 'In a month', date: sat(4) },
  ]
}

export const BUDGET_PRESETS = [250, 500, 750, 1000, 1500, 2500]
export const GUEST_PRESETS = [8, 12, 15, 20, 30, 40]
