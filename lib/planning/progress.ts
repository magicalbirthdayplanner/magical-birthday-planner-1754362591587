/**
 * Party progress and "what should I do next?". Pure.
 */
import { daysBetween } from './checklist'

export interface ProgressInput {
  today: string
  partyDate: string
  hasVenue: boolean
  savedVenueCount: number
  hasTheme: boolean
  guestCount: number
  invitationShared: boolean
  checklistDone: number
  checklistTotal: number
  nextChecklistTitle?: string | null
}

export type NextActionKind = 'venue' | 'theme' | 'guests' | 'invite' | 'checklist' | 'done'

export interface NextAction {
  kind: NextActionKind
  title: string
  href: string
  cta: string
}

const MILESTONES = { details: 10, venue: 20, theme: 10, guests: 15, invite: 15 }
const CHECKLIST_SHARE = 30

export function partyProgress(i: ProgressInput): number {
  let pts = MILESTONES.details
  if (i.hasVenue) pts += MILESTONES.venue
  if (i.hasTheme) pts += MILESTONES.theme
  if (i.guestCount > 0) pts += MILESTONES.guests
  if (i.invitationShared) pts += MILESTONES.invite
  if (i.checklistTotal > 0) pts += CHECKLIST_SHARE * (i.checklistDone / i.checklistTotal)
  return Math.max(0, Math.min(100, Math.round(pts)))
}

export function nextAction(i: ProgressInput): NextAction {
  if (!i.hasVenue) {
    return i.savedVenueCount > 0
      ? { kind: 'venue', title: 'Choose a venue', href: '/discover/saved', cta: 'Compare saved places' }
      : { kind: 'venue', title: 'Choose a venue', href: '/discover', cta: 'Find a venue' }
  }
  if (!i.hasTheme) return { kind: 'theme', title: 'Pick a theme', href: '/plan/theme', cta: 'Browse themes' }
  if (i.guestCount === 0) return { kind: 'guests', title: 'Add your guests', href: '/guests', cta: 'Add guests' }
  if (!i.invitationShared) return { kind: 'invite', title: 'Send invitations', href: '/plan/invite', cta: 'Create invitation' }
  if (i.checklistDone < i.checklistTotal && i.nextChecklistTitle) {
    return { kind: 'checklist', title: i.nextChecklistTitle, href: '/plan/checklist', cta: 'Open checklist' }
  }
  return { kind: 'done', title: 'You’re all set', href: '/plan', cta: 'Review your party' }
}

/** Days until the party (0 = today, negative = past). */
export function daysUntil(partyDate: string, today: string): number {
  return daysBetween(today, partyDate)
}

export function countdownLabel(days: number): string {
  if (days > 1) return `${days} days`
  if (days === 1) return 'Tomorrow'
  if (days === 0) return 'Today!'
  return 'Party’s over'
}

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
