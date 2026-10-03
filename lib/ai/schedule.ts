/** Server-side date math for AI output: the model gives offsets, the server makes real, clamped dates. */
import { daysUntil } from './context'

export function dueDateFor(partyDate: string | null, daysBeforeParty: number, today = new Date()): { dueDate: string | null; late: boolean } {
  if (!partyDate) return { dueDate: null, late: false }
  const left = daysUntil(partyDate, today)
  if (left == null) return { dueDate: null, late: false }
  const offset = Math.max(0, Math.round(daysBeforeParty))
  const late = offset > left // would have been due before today
  const daysFromToday = Math.max(0, left - offset)
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + daysFromToday * 86_400_000)
  return { dueDate: t.toISOString().slice(0, 10), late }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
/** True if `title` is already on the checklist (exact or near-exact). */
export function alreadyListed(title: string, existing: { title: string }[]): boolean {
  const t = norm(title)
  return existing.some((e) => {
    const x = norm(e.title)
    return x === t || (x.length > 8 && (t.includes(x) || x.includes(t)))
  })
}
export const BOOK_VENUE = /\b(book|reserve|choose|find|pick|tour|visit)\b.*\b(venue|location|place|space|hall|studio)\b/i
export const BOOK_ACTIVITY = /\b(book|hire|reserve|find)\b.*\b(entertain\w*|activity|activities|performer|magician|clown|instructor)\b/i
/** Venues that already provide the activity (an art studio IS the entertainment). */
export const ACTIVITY_VENUE = /(studio|play|trampoline|museum|bowling|arcade|gym|climb|pottery|art|science|zoo|farm|laser|skating|class)/i
