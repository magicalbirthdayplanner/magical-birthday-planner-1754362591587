/**
 * Wall-clock helpers in the marketing time zone (IANA, DST-safe, no dependencies). Slots are local "HH:MM" times.
 */

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]))
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, s: +o.second }
}

/** Offset of `tz` from UTC at instant `d`, in minutes (EDT = -240). */
function offsetMinutes(d: Date, tz: string): number {
  const p = parts(d, tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s)
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000)
}

/** Local calendar date ("YYYY-MM-DD") of an instant. */
export function localDate(d: Date, tz: string): string {
  const p = parts(d, tz)
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** Local hour (0–23) of an instant. */
export function localHour(d: Date, tz: string): number {
  return parts(d, tz).h
}

/** The UTC instant of local `date` + `time` in `tz` (two passes handle DST changes). */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, min)
  let t = guess - offsetMinutes(new Date(guess), tz) * 60_000
  t = guess - offsetMinutes(new Date(t), tz) * 60_000
  return new Date(t)
}

export function startOfLocalDay(d: Date, tz: string): Date {
  return zonedToUtc(localDate(d, tz), '00:00', tz)
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Every slot (UTC) from today's local date for `days` days. */
export function slotsFrom(now: Date, times: string[], tz: string, days = 14): Date[] {
  const today = localDate(now, tz)
  const out: Date[] = []
  for (let i = 0; i < days; i++) for (const t of times) out.push(zonedToUtc(addDays(today, i), t, tz))
  return out.sort((a, b) => a.getTime() - b.getTime())
}

/**
 * The next free publishing slot at least `leadMinutes` from now. A slot is taken when a scheduled/published post sits
 * within 30 minutes of it; a local day is full once it holds `perDay` posts.
 */
export function nextFreeSlot(now: Date, opts: { times: string[]; perDay: number; tz: string; taken: Date[]; leadMinutes?: number }): Date | null {
  const times = opts.times.slice(0, opts.perDay)
  const earliest = now.getTime() + (opts.leadMinutes ?? 30) * 60_000
  for (const slot of slotsFrom(now, times, opts.tz)) {
    if (slot.getTime() < earliest) continue
    const day = localDate(slot, opts.tz)
    const sameDay = opts.taken.filter((t) => localDate(t, opts.tz) === day)
    if (sameDay.length >= opts.perDay) continue
    if (sameDay.some((t) => Math.abs(t.getTime() - slot.getTime()) < 30 * 60_000)) continue
    return slot
  }
  return null
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** Weekday name of a calendar date ("YYYY-MM-DD"). */
export function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86_400_000)
}
