/**
 * Invitation share text and links. Pure (unit-tested). The text carries only what the host put on the invitation
 * plus the public RSVP link — never the guest list, guests' contact details, internal ids or the host's email.
 *
 * WhatsApp uses the official click-to-chat link (https://wa.me/?text=…): the host's own WhatsApp opens with the
 * message, the host picks the chats and presses send. We never learn whether it was sent or delivered.
 */
import { formatClock, formatPartyDate } from '@/lib/country/format'

export interface ShareInvitation {
  childFirstName: string
  childAge?: number | null
  partyDate: string
  startTime?: string | null
  endTime?: string | null
  locationText?: string | null
  headline?: string | null
  message?: string | null
  hostName?: string | null
  theme?: string | null
  country?: string | null
  url: string
}

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? 'th'}`
const oneLine = (s: string | null | undefined, max: number) => (s ?? '').replace(/\s*\n+\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max)

/** The full invitation as a chat message (WhatsApp, SMS). */
export function invitationShareText(inv: ShareInvitation): string {
  const who = `${inv.childFirstName}’s${inv.childAge ? ` ${ordinal(inv.childAge)}` : ''} birthday party`
  const time = [formatClock(inv.startTime, inv.country), formatClock(inv.endTime, inv.country)].filter(Boolean).join(' – ')
  const lines = [
    `🎉 You’re invited to ${who}!`,
    inv.headline?.trim() ? oneLine(inv.headline, 120) : null,
    '',
    `📅 ${formatPartyDate(inv.partyDate, inv.country, 'full')}`,
    time ? `⏰ ${time}` : null,
    inv.locationText?.trim() ? `📍 ${oneLine(inv.locationText, 200)}` : null,
    inv.theme?.trim() ? `✨ Theme: ${oneLine(inv.theme, 60)}` : null,
    inv.message?.trim() ? `\n${inv.message.trim().slice(0, 600)}` : null,
    inv.hostName?.trim() ? `— ${oneLine(inv.hostName, 80)}` : null,
    '',
    `Please RSVP here: ${inv.url}`,
  ]
  return lines.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Official WhatsApp click-to-chat share link (no phone number: the host chooses the chats). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** SMS composer link (body only; works on iOS and Android). */
export function smsShareUrl(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`
}
