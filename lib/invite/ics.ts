import { wallTimeToUtc } from '@/lib/country/format'
import type { PublicInvitation } from '@/lib/data/invitations'

/**
 * Calendar file. With the event's timezone the times are exact instants (UTC), so a guest abroad sees the right
 * local time; without one (older parties) they stay floating local times, as before.
 */
export function icsFor(inv: PublicInvitation): string {
  const d = inv.party_date.replace(/-/g, '')
  const t = (x: string | null, fallback: string) => (x ?? fallback).slice(0, 5).replace(':', '') + '00'
  const utc = (x: string | null, fallback: string) => {
    const at = wallTimeToUtc(inv.party_date, (x ?? fallback).slice(0, 5), inv.timezone)
    return at ? `${at.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z` : null
  }
  const start = utc(inv.start_time, '14:00')
  const end = utc(inv.end_time, '16:00')
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Magical Birthday Planner//EN',
    'BEGIN:VEVENT',
    `UID:${d}-${Math.random().toString(36).slice(2)}@magical-birthday-planner.invalid`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${start ?? `${d}T${t(inv.start_time, '14:00')}`}`,
    `DTEND:${end ?? `${d}T${t(inv.end_time, '16:00')}`}`,
    `SUMMARY:${esc(inv.headline || `${inv.child_name}’s birthday party`)}`,
    inv.location_text ? `LOCATION:${esc(inv.location_text)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}
