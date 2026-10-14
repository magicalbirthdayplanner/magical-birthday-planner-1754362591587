/**
 * WhatsApp/SMS share text, share-link encoding and calendar files with the event's timezone.
 */
import { describe, expect, it } from 'vitest'
import { invitationShareText, smsShareUrl, whatsappShareUrl } from '@/lib/invite/share'
import { icsFor } from '@/lib/invite/ics'
import type { PublicInvitation } from '@/lib/data/invitations'

const URL_ = 'https://magicalbirthdayplanner.app/invite/' + 'a'.repeat(48)
const base = {
  childFirstName: 'Aarav',
  childAge: 7,
  partyDate: '2026-11-14',
  startTime: '16:00:00',
  endTime: '19:30:00',
  locationText: 'Jumping Jacks Play Area\n12, 80 Feet Road, Koramangala',
  headline: 'Superhero training day!',
  message: 'Come in your favourite costume. Cake & games for everyone!',
  hostName: 'The Sharma family',
  theme: 'Superhero',
  country: 'IN',
  url: URL_,
}

describe('invitation share text', () => {
  it('carries the invitation details in the event country’s format, plus the RSVP link', () => {
    const t = invitationShareText(base).replace(/[  ]/g, ' ')
    expect(t).toContain('You’re invited to Aarav’s 7th birthday party!')
    expect(t).toContain('📅 Saturday, 14 November 2026')
    expect(t).toContain('⏰ 4 pm – 7:30 pm')
    expect(t).toContain('📍 Jumping Jacks Play Area, 12, 80 Feet Road, Koramangala')
    expect(t).toContain('✨ Theme: Superhero')
    expect(t).toContain('Come in your favourite costume.')
    expect(t).toContain('— The Sharma family')
    expect(t.trim().endsWith(`Please RSVP here: ${URL_}`)).toBe(true)
  })
  it('leaves out what the host did not fill in; US parties use US formats', () => {
    const t = invitationShareText({ childFirstName: 'Ava', partyDate: '2026-11-14', country: 'US', url: URL_ }).replace(/[  ]/g, ' ')
    expect(t).toContain('📅 Saturday, November 14, 2026')
    expect(t).not.toMatch(/⏰|📍|Theme|—/)
  })
  it('never contains guest data or internal identifiers beyond the public link', () => {
    const t = invitationShareText(base)
    expect(t).not.toMatch(/@|\+91|\d{10}/)
    expect(t.match(/https?:\/\//g)).toHaveLength(1)
  })
})

describe('share links', () => {
  it('WhatsApp uses the official click-to-chat link with the whole message URL-encoded', () => {
    const text = 'Party & cake #1 — 100% fun? 🎉\nRSVP: https://x.test/invite/abc?x=1&y=2'
    const link = whatsappShareUrl(text)
    expect(link.startsWith('https://wa.me/?text=')).toBe(true)
    expect(link).not.toMatch(/\s/)
    expect(link).not.toContain('#')
    expect(decodeURIComponent(link.slice('https://wa.me/?text='.length))).toBe(text)
    expect(new URL(link).searchParams.get('text')).toBe(text)
    expect(new URL(link).searchParams.size).toBe(1) // the "&" inside the message did not split the query
  })
  it('SMS keeps today’s link shape', () => {
    expect(smsShareUrl('Hi there')).toBe('sms:?&body=Hi%20there')
  })
})

describe('calendar file', () => {
  const inv: PublicInvitation = { child_name: 'Aarav', child_age: 7, party_date: '2026-11-14', start_time: '16:00:00', end_time: '19:30:00', location_text: 'Koramangala, Bengaluru', headline: null, message: null, host_name: null, theme: null, design: 'classic', rsvp_by: null, country_code: 'IN', timezone: 'Asia/Kolkata' }
  it('India party: exact UTC instants, so a guest abroad sees the right time', () => {
    const ics = icsFor(inv)
    expect(ics).toContain('DTSTART:20261114T103000Z')
    expect(ics).toContain('DTEND:20261114T140000Z')
  })
  it('party without a timezone (all pre-India parties): floating local time exactly as before', () => {
    const ics = icsFor({ ...inv, country_code: 'US', timezone: null })
    expect(ics).toContain('DTSTART:20261114T160000')
    expect(ics).not.toContain('DTSTART:20261114T160000Z')
    expect(ics).toContain('DTEND:20261114T193000')
  })
  it('escapes text fields', () => {
    expect(icsFor({ ...inv, location_text: 'Hall 2; Block A, Bengaluru' })).toContain('LOCATION:Hall 2\\; Block A\\, Bengaluru')
  })
})
