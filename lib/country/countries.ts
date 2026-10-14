/**
 * THE country model. Everything that differs between markets lives here, so features ask "what does this country
 * do?" instead of branching on 'US' / 'IN'. Isomorphic and pure: no secrets, no I/O.
 *
 * Two different countries exist in the product and are never mixed up:
 *  - the PARTY's event country (parties.country_code): drives the address, postal code, venue search, currency,
 *    date/time format, payment provider and share channels for that party;
 *  - the USER's preferred country (users.country_code / this device): only the default for new parties.
 *
 * Adding a country = one entry below + its postal/phone rules + a migration widening the country_code checks.
 */

export const COUNTRY_CODES = ['US', 'IN'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]
export const DEFAULT_COUNTRY: CountryCode = 'US'

export type PaymentProviderId = 'dodo' | 'razorpay'
export type ShareChannel = 'native' | 'whatsapp' | 'sms' | 'email' | 'copy'
export type AddressField = 'line1' | 'line2' | 'locality' | 'city' | 'district' | 'state' | 'postal'

export interface CountryConfig {
  code: CountryCode
  name: string
  flag: string
  /** ISO 4217. Party amounts (budget, costs) are in this currency. */
  currency: 'USD' | 'INR'
  /** BCP 47 locale for numbers, dates and times. */
  locale: string
  /** 12-hour clock in displayed times. */
  hour12: boolean
  /** Default IANA timezone for new parties; null = floating local time (several zones, none assumed). */
  defaultTimezone: string | null
  phone: { callingCode: string; example: string }
  postal: { label: string; shortLabel: string; example: string; maxLength: number; inputMode: 'numeric' | 'text' }
  /** Address fields in local display order (the postal code is always captured by the location step). */
  addressFields: AddressField[]
  stateLabel: string
  /** Payment providers in preference order; the server decides which one is actually enabled. */
  paymentProviders: PaymentProviderId[]
  /** Invitation share options shown as buttons (native share is always the primary button). */
  shareChannels: ShareChannel[]
  /** Google Places regionCode (result formatting/biasing) and a country-wide map fallback. */
  maps: { regionCode: string; center: { lat: number; lng: number }; zoom: number }
  distanceUnit: 'mi' | 'km'
  /** Wizard budget presets in whole currency units, and the max a parent may enter. */
  budget: { presets: number[]; max: number; placeholder: string }
  /** Per-guest budget thresholds (whole currency units) that map to Google price levels 1→2→3→4. */
  priceLevelPerGuest: [number, number, number]
  /** Rough size of amounts relative to US dollars — only scales sanity caps on AI estimates, never converts money. */
  moneyScale: number
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    locale: 'en-US',
    hour12: true,
    defaultTimezone: null,
    phone: { callingCode: '1', example: '(248) 555-0100' },
    postal: { label: 'ZIP code', shortLabel: 'ZIP', example: '48084', maxLength: 10, inputMode: 'numeric' },
    addressFields: ['line1', 'line2', 'city', 'state', 'postal'],
    stateLabel: 'State',
    paymentProviders: ['dodo'],
    shareChannels: ['sms', 'email', 'copy'],
    maps: { regionCode: 'US', center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 },
    distanceUnit: 'mi',
    budget: { presets: [250, 500, 750, 1000, 1500, 2500], max: 100_000, placeholder: '$' },
    priceLevelPerGuest: [15, 35, 70],
    moneyScale: 1,
  },
  IN: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    currency: 'INR',
    locale: 'en-IN',
    hour12: true,
    defaultTimezone: 'Asia/Kolkata',
    phone: { callingCode: '91', example: '98765 43210' },
    postal: { label: 'PIN code', shortLabel: 'PIN', example: '560001', maxLength: 7, inputMode: 'numeric' },
    addressFields: ['line1', 'line2', 'locality', 'city', 'district', 'state', 'postal'],
    stateLabel: 'State / Union Territory',
    paymentProviders: ['razorpay'],
    shareChannels: ['whatsapp', 'sms', 'email', 'copy'],
    maps: { regionCode: 'IN', center: { lat: 22.3511, lng: 78.6677 }, zoom: 4 },
    distanceUnit: 'km',
    budget: { presets: [5_000, 10_000, 15_000, 25_000, 50_000, 100_000], max: 10_000_000, placeholder: '₹' },
    // Rough per-guest spend that tends to match Google's local price levels in Indian cities.
    priceLevelPerGuest: [400, 1_000, 2_500],
    moneyScale: 100,
  },
}

export const isCountryCode = (x: unknown): x is CountryCode => typeof x === 'string' && (COUNTRY_CODES as readonly string[]).includes(x)

/** Normalize anything ("in", " IN ", null) to a supported code, or null. */
export function parseCountryCode(x: unknown): CountryCode | null {
  if (typeof x !== 'string') return null
  const c = x.trim().toUpperCase()
  return isCountryCode(c) ? c : null
}

/** Config for a stored code; unknown/missing (every pre-India party) → United States, today's behaviour. */
export function countryConfig(code: unknown): CountryConfig {
  return COUNTRIES[parseCountryCode(code) ?? DEFAULT_COUNTRY]
}

/** India is selectable only when the rollout flag is on (build time). Stored India parties always render as India. */
export const INDIA_ENABLED = process.env.NEXT_PUBLIC_INDIA_ENABLED === 'true'

/** Countries a parent may choose for a new party or as their preference. */
export function selectableCountries(indiaEnabled = INDIA_ENABLED): CountryCode[] {
  return indiaEnabled ? ['US', 'IN'] : ['US']
}

/** Timezone to store for a party in this country (null keeps today's floating local time). */
export const timezoneFor = (code: unknown) => countryConfig(code).defaultTimezone
