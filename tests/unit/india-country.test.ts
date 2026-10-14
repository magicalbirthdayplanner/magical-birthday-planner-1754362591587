/**
 * Country model (US + India): config, postal codes, phone numbers, money/date/time/distance formatting, timezones,
 * device country guess. Pure — no network.
 */
import { describe, expect, it } from 'vitest'
import { COUNTRIES, countryConfig, parseCountryCode, selectableCountries, timezoneFor } from '@/lib/country/countries'
import { normalizePin, normalizePostal, postalFormatError, postalInputFilter } from '@/lib/country/postal'
import { formatPhone, normalizePhone, samePhone } from '@/lib/country/phone'
import { currencySymbol, formatClock, formatCount, formatDateWith, formatDistance, formatMinor, formatMoney, formatPartyDate, formatRadius, isValidTimezone, wallTimeToUtc } from '@/lib/country/format'
import { guessCountry } from '@/lib/country/preference'

/** ICU puts a narrow no-break space before AM/PM; compare on plain spaces. */
const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ')

describe('country config', () => {
  it('United States keeps today’s behaviour: USD, en-US, +1, ZIP, Dodo, miles', () => {
    const us = COUNTRIES.US
    expect(us).toMatchObject({ currency: 'USD', locale: 'en-US', phone: { callingCode: '1' }, paymentProviders: ['dodo'], distanceUnit: 'mi', defaultTimezone: null })
    expect(us.postal.label).toBe('ZIP code')
    expect(us.budget.presets).toEqual([250, 500, 750, 1000, 1500, 2500])
    expect(us.priceLevelPerGuest).toEqual([15, 35, 70])
  })
  it('India: INR, en-IN, +91, 6-digit PIN, Razorpay, WhatsApp, km, Asia/Kolkata', () => {
    const india = COUNTRIES.IN
    expect(india).toMatchObject({ currency: 'INR', locale: 'en-IN', phone: { callingCode: '91' }, paymentProviders: ['razorpay'], distanceUnit: 'km', defaultTimezone: 'Asia/Kolkata' })
    expect(india.postal.label).toBe('PIN code')
    expect(india.shareChannels).toContain('whatsapp')
    expect(india.addressFields).toEqual(expect.arrayContaining(['locality', 'district', 'state', 'postal']))
  })
  it('parses codes and defaults unknown/missing to US', () => {
    expect(parseCountryCode(' in ')).toBe('IN')
    expect(parseCountryCode('XX')).toBeNull()
    expect(parseCountryCode(undefined)).toBeNull()
    expect(countryConfig(null).code).toBe('US')
    expect(countryConfig('IN').code).toBe('IN')
    expect(timezoneFor('IN')).toBe('Asia/Kolkata')
    expect(timezoneFor('US')).toBeNull()
  })
  it('India is selectable only behind the rollout flag', () => {
    expect(selectableCountries(false)).toEqual(['US'])
    expect(selectableCountries(true)).toEqual(['US', 'IN'])
  })
})

describe('postal codes', () => {
  it.each([
    ['560001', '560001'],
    ['560 001', '560001'],
    [' 400050 ', '400050'],
    ['110-016', '110016'],
    [500081, '500081'],
  ])('accepts PIN %s', (input, out) => expect(normalizePin(input)).toBe(out))

  it.each(['056001', '56001', '5600011', 'abcdef', '', '48084', '48084-1234', 'SW1A 1AA', null])('rejects PIN %s', (input) => expect(normalizePin(input)).toBeNull())

  it('a PIN is never treated as a US ZIP and vice versa', () => {
    expect(normalizePostal('US', '560001')).toBeNull()
    expect(normalizePostal('US', '48084-1234')).toBe('48084')
    expect(normalizePostal('IN', '48084')).toBeNull()
    expect(normalizePostal('IN', '560 001')).toBe('560001')
  })
  it('useful, country-specific errors and input filters', () => {
    expect(postalFormatError('IN')).toMatch(/6-digit PIN/)
    expect(postalFormatError('US')).toMatch(/5-digit US ZIP/)
    expect(postalInputFilter('IN', '560-001x')).toBe('560001')
    expect(postalInputFilter('IN', '560 001')).toBe('560 001')
    expect(postalInputFilter('US', '48084-1234a')).toBe('48084-1234')
  })
})

describe('phone numbers', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['080 2222 3333', '+918022223333'],
  ])('India: %s → %s', (input, e164) => expect(normalizePhone(input, 'IN')).toEqual({ ok: true, e164 }))

  it.each([
    ['(248) 555-0100', '+12485550100'],
    ['248.555.0100', '+12485550100'],
    ['1 248 555 0100', '+12485550100'],
    ['+1 (248) 555-0100', '+12485550100'],
  ])('US: %s → %s', (input, e164) => expect(normalizePhone(input, 'US')).toEqual({ ok: true, e164 }))

  it('an Indian number on a US party and a US number on an Indian party both work with the + prefix', () => {
    expect(normalizePhone('+91 98765 43210', 'US')).toEqual({ ok: true, e164: '+919876543210' })
    expect(normalizePhone('+1 248 555 0100', 'IN')).toEqual({ ok: true, e164: '+12485550100' })
    expect(normalizePhone('+44 20 7946 0958', 'IN')).toEqual({ ok: true, e164: '+442079460958' })
  })
  it.each([
    ['12345', 'IN'],
    ['555-0100', 'US'],
    ['(048) 555-0100', 'US'],
    ['abc', 'IN'],
    ['+91 12345', 'IN'],
    ['', 'US'],
  ] as const)('rejects %s for %s', (input, c) => expect(normalizePhone(input, c).ok).toBe(false))

  it('formats nationally for the party’s country, internationally otherwise', () => {
    expect(formatPhone('+919876543210', 'IN')).toBe('98765 43210')
    expect(formatPhone('+919876543210', 'US')).toBe('+91 98765 43210')
    expect(formatPhone('+12485550100', 'US')).toBe('(248) 555-0100')
    expect(formatPhone('+12485550100', 'IN')).toBe('+1 (248) 555-0100')
    expect(formatPhone('call me', 'US')).toBe('call me')
    expect(formatPhone(null, 'US')).toBe('')
  })
  it('detects the same number written differently', () => {
    expect(samePhone('098765 43210', '+919876543210', 'IN')).toBe(true)
    expect(samePhone('+919876543210', '+919876543211', 'IN')).toBe(false)
    expect(samePhone(null, '+919876543210', 'IN')).toBe(false)
  })
})

describe('money', () => {
  it('USD party amounts', () => {
    expect(formatMoney(25, 'US')).toBe('$25')
    expect(formatMoney(25.5, 'US')).toBe('$25.50')
    expect(formatMoney(1500, 'US')).toBe('$1,500')
    expect(formatMoney(0, null)).toBe('$0')
  })
  it('INR party amounts with Indian digit grouping', () => {
    expect(formatMoney(499, 'IN')).toBe('₹499')
    expect(formatMoney(1499, 'IN')).toBe('₹1,499')
    expect(formatMoney(100000, 'IN')).toBe('₹1,00,000')
    expect(formatMoney(1234567, 'IN')).toBe('₹12,34,567')
    expect(formatMoney(99.5, 'IN')).toBe('₹99.50')
  })
  it('minor units of an explicit currency (prices) — integers in, no float arithmetic on the amount', () => {
    expect(formatMinor(999, 'USD')).toBe('$9.99')
    expect(formatMinor(2999, 'USD')).toBe('$29.99')
    expect(formatMinor(49900, 'INR')).toBe('₹499')
    expect(formatMinor(149900, 'INR')).toBe('₹1,499')
    expect(formatMinor(0, 'INR')).toBe('₹0')
  })
  it('currency symbols', () => {
    expect(currencySymbol('US')).toBe('$')
    expect(currencySymbol('IN')).toBe('₹')
  })
})

describe('dates and times', () => {
  it('writes the party date the country’s way and never shifts the day', () => {
    expect(formatPartyDate('2026-10-24', 'US', 'full')).toBe('Saturday, October 24, 2026')
    expect(formatPartyDate('2026-10-24', 'IN', 'full')).toBe('Saturday, 24 October 2026')
    expect(formatPartyDate('2026-01-01', 'IN', 'medium')).toBe('Thu, 1 Jan')
    expect(formatDateWith('2026-12-31', 'US', { month: 'short', day: 'numeric' })).toBe('Dec 31')
    expect(formatPartyDate('not-a-date', 'US')).toBe('')
  })
  it('12-hour clock times', () => {
    expect(plain(formatClock('14:00', 'US'))).toBe('2 PM')
    expect(plain(formatClock('14:30:00', 'US'))).toBe('2:30 PM')
    expect(plain(formatClock('14:30', 'IN'))).toBe('2:30 pm')
    expect(plain(formatClock('09:00', 'IN'))).toBe('9 am')
    expect(formatClock(null, 'IN')).toBeNull()
  })
  it('counts use the country’s grouping', () => {
    expect(formatCount(1234567, 'IN')).toBe('12,34,567')
    expect(formatCount(1234567, 'US')).toBe('1,234,567')
  })
})

describe('distances', () => {
  it('miles for the US, kilometres for India', () => {
    expect(formatDistance(6.234, 'US')).toBe('6.2 mi')
    expect(formatDistance(23.4, 'US')).toBe('23 mi')
    expect(formatDistance(1, 'IN')).toBe('1.6 km')
    expect(formatDistance(20, 'IN')).toBe('32 km')
    expect(formatDistance(null, 'IN')).toBeNull()
    expect(formatRadius(20, 'US')).toBe('20 miles')
    expect(formatRadius(20, 'IN')).toBe('32 km')
  })
})

describe('event timezone', () => {
  it('India (no DST): 2 pm in Kolkata is 08:30 UTC', () => {
    expect(wallTimeToUtc('2026-10-24', '14:00', 'Asia/Kolkata')?.toISOString()).toBe('2026-10-24T08:30:00.000Z')
    expect(wallTimeToUtc('2026-12-31', '23:30', 'Asia/Kolkata')?.toISOString()).toBe('2026-12-31T18:00:00.000Z')
  })
  it('US zones with DST', () => {
    expect(wallTimeToUtc('2026-07-04', '14:00', 'America/New_York')?.toISOString()).toBe('2026-07-04T18:00:00.000Z')
    expect(wallTimeToUtc('2026-12-05', '14:00', 'America/New_York')?.toISOString()).toBe('2026-12-05T19:00:00.000Z')
  })
  it('no or unknown zone → null (callers keep floating local time)', () => {
    expect(wallTimeToUtc('2026-10-24', '14:00', null)).toBeNull()
    expect(wallTimeToUtc('2026-10-24', '14:00', 'Mars/Olympus')).toBeNull()
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
    expect(isValidTimezone('Nope/Nope')).toBe(false)
  })
})

describe('device country guess (a default only, never forced)', () => {
  it('uses the device timezone / language, not an IP address', () => {
    expect(guessCountry('Asia/Kolkata')).toBe('IN')
    expect(guessCountry('Asia/Calcutta')).toBe('IN')
    expect(guessCountry('America/Chicago', ['en-US'])).toBe('US')
    expect(guessCountry('Europe/London', ['en-IN'])).toBe('IN')
    expect(guessCountry(null)).toBe('US')
  })
})
