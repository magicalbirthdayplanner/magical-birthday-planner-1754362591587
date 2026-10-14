/**
 * Phone numbers: one stored form (E.164, e.g. +919876543210 / +12485550100), country-aware input. Pure.
 * A valid-looking number is never treated as proof that it is active or belongs to the guest.
 * Never log, track or put a phone number in a URL we generate.
 */
import { countryConfig, type CountryCode } from './countries'

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string }

/** Indian mobiles start 6–9; landlines (STD code + number) also have 10 digits without the trunk 0. */
const IN_NATIONAL = /^[1-9]\d{9}$/
/** NANP: area code and exchange both start 2–9. */
const US_NATIONAL = /^[2-9]\d{2}[2-9]\d{6}$/

/**
 * Normalize what a host typed. `country` is the party's country: a number without "+" is read as a national number
 * of that country. "+<digits>" numbers of other countries are accepted as generic E.164 (8–15 digits).
 */
export function normalizePhone(input: string, country: CountryCode): PhoneResult {
  const raw = input.trim()
  if (!raw) return { ok: false, error: 'Please enter a phone number.' }
  if (!/^[+\d\s().-]+$/.test(raw)) return { ok: false, error: 'Use digits only (spaces, dashes and brackets are fine).' }
  let digits = raw.replace(/\D/g, '')
  const international = raw.startsWith('+') || raw.startsWith('00')
  if (raw.startsWith('00')) digits = digits.slice(2)

  if (international) {
    if (digits.startsWith('91')) return checkIndia(digits.slice(2))
    if (digits.startsWith('1')) return checkUs(digits.slice(1))
    if (/^[1-9]\d{7,14}$/.test(digits)) return { ok: true, e164: `+${digits}` }
    return { ok: false, error: 'That international number doesn’t look right.' }
  }
  if (country === 'IN') {
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1) // trunk prefix 0
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
    return checkIndia(digits)
  }
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return checkUs(digits)
}

function checkIndia(n: string): PhoneResult {
  return IN_NATIONAL.test(n) ? { ok: true, e164: `+91${n}` } : { ok: false, error: 'Indian numbers have 10 digits, e.g. 98765 43210.' }
}
function checkUs(n: string): PhoneResult {
  return US_NATIONAL.test(n) ? { ok: true, e164: `+1${n}` } : { ok: false, error: 'US numbers have 10 digits, e.g. (248) 555-0100.' }
}

/** Display form: national format for the party's own country, international otherwise. Unknown input is returned as-is. */
export function formatPhone(stored: string | null | undefined, country: CountryCode): string {
  if (!stored) return ''
  const m = stored.match(/^\+(\d+)$/)
  if (!m) return stored
  const d = m[1]
  if (d.startsWith('91') && d.length === 12) {
    const n = d.slice(2)
    const local = `${n.slice(0, 5)} ${n.slice(5)}`
    return country === 'IN' ? local : `+91 ${local}`
  }
  if (d.startsWith('1') && d.length === 11) {
    const n = d.slice(1)
    const local = `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
    return country === 'US' ? local : `+1 ${local}`
  }
  return stored
}

/** Placeholder for a phone field in this country. */
export const phonePlaceholder = (country: CountryCode) => countryConfig(country).phone.example

/** Same number? Compares normalized forms (free-text legacy values are compared digit-for-digit). */
export function samePhone(a: string | null | undefined, b: string | null | undefined, country: CountryCode): boolean {
  if (!a || !b) return false
  const na = normalizePhone(a, country)
  const nb = normalizePhone(b, country)
  if (na.ok && nb.ok) return na.e164 === nb.e164
  return a.replace(/\D/g, '') === b.replace(/\D/g, '') && a.replace(/\D/g, '').length >= 8
}
