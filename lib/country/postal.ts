/**
 * Postal codes per country. Pure. A well-formed code is NOT proof that an address exists — lookups decide that, and
 * a missing lookup field never invalidates an address the parent typed.
 */
import { normalizeZip } from '@/lib/geo/zip'
import { countryConfig, type CountryCode } from './countries'

/**
 * Indian PIN: six digits, first digit 1–9 (0 is not used). Spaces/dashes a person types ("560 001") are ignored.
 * Returns the 6-digit PIN or null. A US ZIP+4 ("12345-6789") is never mistaken for a PIN.
 */
export function normalizePin(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null
  const raw = String(input).trim()
  if (!/^[\d\s-]+$/.test(raw)) return null
  const digits = raw.replace(/[\s-]/g, '')
  return /^[1-9]\d{5}$/.test(digits) ? digits : null
}

/** The stored form of a postal code for this country (US: 5-digit ZIP; IN: 6-digit PIN), or null when malformed. */
export function normalizePostal(country: CountryCode, input: unknown): string | null {
  return country === 'IN' ? normalizePin(input) : normalizeZip(input)
}

/** Friendly message for a malformed code. */
export function postalFormatError(country: CountryCode): string {
  return country === 'IN' ? 'Please enter a 6-digit PIN code (for example 560001).' : 'Please enter a 5-digit US ZIP code.'
}

/** Message when a well-formed code could not be located. */
export function postalNotFoundError(country: CountryCode, code: string): string {
  return `We couldn’t find ${countryConfig(country).postal.shortLabel} ${code}. Double-check it?`
}

/** Keep only characters that can appear while typing a code (the input field filter). */
export function postalInputFilter(country: CountryCode, value: string): string {
  return country === 'IN' ? value.replace(/[^\d\s]/g, '').slice(0, 7) : value.replace(/[^\d-]/g, '').slice(0, 10)
}

/** True once enough has been typed to look the code up. */
export const postalComplete = (country: CountryCode, value: string) => normalizePostal(country, value) !== null
