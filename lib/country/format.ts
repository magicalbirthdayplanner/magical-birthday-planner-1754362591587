/**
 * Locale-aware display of money, dates, times and distances for a party's country. Pure and isomorphic.
 * Display only: authoritative payment amounts are integers in minor units and never pass through floats here.
 */
import { countryConfig, type CountryCode } from './countries'

const nf = new Map<string, Intl.NumberFormat>()
function moneyFormat(locale: string, currency: string, fraction: boolean) {
  const key = `${locale}|${currency}|${fraction}`
  let f = nf.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: fraction ? 2 : 0 })
    nf.set(key, f)
  }
  return f
}

/**
 * A party amount in whole currency units (budget lines, estimates): "$25", "$25.50", "₹1,499", "₹1,00,000".
 * Decimals only when the amount has cents/paise.
 */
export function formatMoney(amount: number, country: CountryCode | string | null | undefined): string {
  const c = countryConfig(country)
  if (!Number.isFinite(amount)) return ''
  const rounded = Math.round(amount * 100) / 100
  return moneyFormat(c.locale, c.currency, !Number.isInteger(rounded)).format(rounded)
}

/** An amount in MINOR units of an explicit currency (prices, payments): 999 USD → "$9.99", 49900 INR → "₹499". */
export function formatMinor(minor: number, currency: 'USD' | 'INR'): string {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  const whole = minor % 100 === 0
  return moneyFormat(locale, currency, !whole).format(minor / 100)
}

/** The currency symbol alone ("$", "₹"), e.g. for an amount input's label. */
export function currencySymbol(country: CountryCode | string | null | undefined): string {
  const c = countryConfig(country)
  return moneyFormat(c.locale, c.currency, false).formatToParts(0).find((p) => p.type === 'currency')?.value ?? c.currency
}

export type DateStyle = 'full' | 'long' | 'medium' | 'short'
const DATE_OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  long: { weekday: 'long', month: 'long', day: 'numeric' },
  medium: { weekday: 'short', month: 'short', day: 'numeric' },
  short: { month: 'short', day: 'numeric' },
}

/**
 * A calendar date (YYYY-MM-DD, the party's own wall date) in the country's style. Formatted in UTC from noon so the
 * viewer's timezone can never move it to another day.
 *   US full: "Saturday, October 24, 2026"   IN full: "Saturday, 24 October 2026"
 */
export function formatPartyDate(isoDate: string | null | undefined, country: CountryCode | string | null | undefined, style: DateStyle = 'full'): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
  const c = countryConfig(country)
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(c.locale, { ...DATE_OPTS[style], timeZone: 'UTC' })
}

/** Same as formatPartyDate with explicit Intl options (keeps each screen's existing format, localized). */
export function formatDateWith(isoDate: string | null | undefined, country: CountryCode | string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(countryConfig(country).locale, { ...opts, timeZone: 'UTC' })
}

/** A wall-clock time "HH:MM[:SS]" in the country's style: US "2 PM" / "2:30 PM", IN "2 pm" / "2:30 pm". */
export function formatClock(t: string | null | undefined, country: CountryCode | string | null | undefined): string | null {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return null
  const c = countryConfig(country)
  const [h, m] = t.split(':').map(Number)
  const d = new Date(Date.UTC(2000, 0, 1, h, m))
  return d.toLocaleTimeString(c.locale, { hour: 'numeric', minute: m ? '2-digit' : undefined, hour12: c.hour12, timeZone: 'UTC' })
}

/** Plain number in the country's grouping ("1,234" / "1,00,000"). */
export const formatCount = (n: number, country: CountryCode | string | null | undefined) => n.toLocaleString(countryConfig(country).locale)

const KM_PER_MILE = 1.609344

/** Distance label in the country's unit: "0.4 mi" / "23 mi", or "0.6 km" / "37 km". */
export function formatDistance(miles: number | null | undefined, country: CountryCode | string | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null
  const unit = countryConfig(country).distanceUnit
  const v = unit === 'km' ? miles * KM_PER_MILE : miles
  return v < 10 ? `${v.toFixed(1)} ${unit}` : `${Math.round(v)} ${unit}`
}

/** A search radius (stored in miles) for labels: "20 miles" / "32 km". */
export function formatRadius(miles: number, country: CountryCode | string | null | undefined): string {
  return countryConfig(country).distanceUnit === 'km' ? `${Math.round(miles * KM_PER_MILE)} km` : `${miles} miles`
}

// ---------------------------------------------------------------- timezones

/** Offset (ms) of `tz` from UTC at instant `at`. */
function tzOffsetMs(at: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - Math.floor(at / 1000) * 1000
}

/**
 * The instant a wall-clock time happens in an IANA timezone ("2026-10-24", "14:00", "Asia/Kolkata" →
 * 2026-10-24T08:30:00Z). Null for a missing/unknown zone (callers then keep floating local time).
 */
export function wallTimeToUtc(isoDate: string, time: string, tz: string | null | undefined): Date | null {
  if (!tz || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !/^\d{1,2}:\d{2}/.test(time)) return null
  const [y, mo, d] = isoDate.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  try {
    const first = guess - tzOffsetMs(guess, tz)
    return new Date(guess - tzOffsetMs(first, tz)) // second pass settles DST edges
  } catch {
    return null
  }
}

/** Is this a timezone the runtime knows? */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
