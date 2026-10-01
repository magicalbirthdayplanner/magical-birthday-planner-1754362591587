/**
 * Checklist generation from party facts. Pure.
 * Due dates count back from the party date; tasks whose ideal date already
 * passed are due "today" (and marked overdue) instead of being dropped.
 */

export interface ChecklistInput {
  partyDate: string // YYYY-MM-DD
  today: string // YYYY-MM-DD (local)
  guestCount?: number | null
  hasVenue?: boolean
  setting?: 'indoor' | 'outdoor' | 'either'
  theme?: string | null
  childName?: string | null
  /** Milestones already achieved when the checklist is generated. */
  hasGuests?: boolean
  invitationShared?: boolean
}

export interface ChecklistTemplate {
  key: string
  title: string
  detail?: string
  category: 'venue' | 'guests' | 'theme' | 'food' | 'decor' | 'day-of' | 'after' | 'general'
  /** Ideal days before the party (negative = after). */
  daysBefore: number
  when?: (i: ChecklistInput) => boolean
}

export interface GeneratedTask {
  task_key: string
  title: string
  detail: string | null
  category: string
  due_date: string
  sort_order: number
  /** Already satisfied by the party's current state (e.g. a theme was chosen before the checklist existed). */
  completed: boolean
}

const first = (name?: string | null) => name?.trim().split(/\s+/)[0] || 'the birthday child'

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  { key: 'choose-venue', title: 'Choose a venue', detail: 'Compare your saved places and book your favorite.', category: 'venue', daysBefore: 42, when: (i) => !i.hasVenue },
  { key: 'pick-theme', title: 'Pick a theme', category: 'theme', daysBefore: 38 },
  { key: 'guest-list', title: 'Make the guest list', detail: 'Add families so you can track RSVPs.', category: 'guests', daysBefore: 35 },
  { key: 'send-invites', title: 'Send invitations', detail: 'Share your RSVP link by text or email.', category: 'guests', daysBefore: 28 },
  { key: 'book-entertainment', title: 'Book entertainment or an activity', category: 'general', daysBefore: 24, when: (i) => (i.guestCount ?? 0) >= 8 },
  { key: 'order-cake', title: 'Order the cake', detail: 'Bakeries often need 1–2 weeks for custom cakes.', category: 'food', daysBefore: 14 },
  { key: 'plan-food', title: 'Plan food and drinks', category: 'food', daysBefore: 12 },
  { key: 'buy-decorations', title: 'Buy decorations', category: 'decor', daysBefore: 10 },
  { key: 'party-favors', title: 'Get party favors', category: 'decor', daysBefore: 7 },
  { key: 'confirm-rsvps', title: 'Follow up on RSVPs', category: 'guests', daysBefore: 5 },
  { key: 'confirm-venue', title: 'Confirm the venue and headcount', category: 'venue', daysBefore: 3 },
  { key: 'rain-plan', title: 'Make a rain plan', detail: 'Pick a backup spot or rent a tent.', category: 'venue', daysBefore: 3, when: (i) => i.setting === 'outdoor' },
  { key: 'pack-bag', title: 'Pack the party bag', detail: 'Candles, lighter, plates, napkins, wipes, trash bags.', category: 'day-of', daysBefore: 1 },
  { key: 'enjoy', title: 'Enjoy the party!', category: 'day-of', daysBefore: 0 },
  { key: 'thank-yous', title: 'Send thank-you notes', category: 'after', daysBefore: -3 },
]

const MS_DAY = 86_400_000
export function parseDay(d: string): number {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}
export function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / MS_DAY)
}
export function localToday(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function generateChecklist(input: ChecklistInput): GeneratedTask[] {
  const party = parseDay(input.partyDate)
  const today = parseDay(input.today)
  return CHECKLIST_TEMPLATES.filter((t) => !t.when || t.when(input)).map((t, idx) => {
    const ideal = party - t.daysBefore * MS_DAY
    const due = t.daysBefore > 0 ? Math.min(Math.max(ideal, today), party) : ideal
    return {
      task_key: t.key,
      title: t.key === 'enjoy' ? `Enjoy ${first(input.childName)}'s party!` : t.title,
      detail: t.detail ?? null,
      category: t.category,
      due_date: formatDay(due),
      sort_order: idx,
      completed:
        (t.key === 'pick-theme' && !!input.theme) ||
        (t.key === 'guest-list' && !!input.hasGuests) ||
        (t.key === 'send-invites' && !!input.invitationShared),
    }
  })
}

export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'done'

export interface TaskLike {
  due_date: string | null
  completed_at: string | null
}

export function bucketFor(task: TaskLike, today: string): Bucket {
  if (task.completed_at) return 'done'
  if (!task.due_date) return 'later'
  const d = daysBetween(today, task.due_date)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 7) return 'week'
  return 'later'
}

/** Groups for the UI: Today (incl. overdue), This week, Later, Completed. */
export function groupTasks<T extends TaskLike>(tasks: T[], today: string) {
  const groups = { today: [] as T[], week: [] as T[], later: [] as T[], done: [] as T[] }
  for (const t of tasks) {
    const b = bucketFor(t, today)
    if (b === 'overdue' || b === 'today') groups.today.push(t)
    else groups[b].push(t)
  }
  const byDue = (a: T, b: T) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
  groups.today.sort(byDue)
  groups.week.sort(byDue)
  groups.later.sort(byDue)
  return groups
}
