/**
 * The visitor's preferred country on this device: the DEFAULT for new parties and the market of anonymous analytics.
 * Never forces anything — parents can always pick another event country, and each party keeps its own.
 *
 * Signal used for a first guess: the device's own timezone (Asia/Kolkata → India). No IP lookup, nothing stored
 * server-side until a signed-in user chooses a country (users.country_code).
 */
import { DEFAULT_COUNTRY, parseCountryCode, selectableCountries, type CountryCode } from './countries'

export const COUNTRY_KEY = 'mbp.country'

/** Best guess from the browser's timezone and language; US when nothing points elsewhere. */
export function guessCountry(tz?: string | null, languages: readonly string[] = []): CountryCode {
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN'
  if (languages.some((l) => /-IN$/i.test(l))) return 'IN'
  return DEFAULT_COUNTRY
}

/** Stored choice, else the device guess — limited to the countries currently selectable. */
export function preferredCountry(): CountryCode {
  const allowed = selectableCountries()
  let pick: CountryCode = DEFAULT_COUNTRY
  if (typeof window !== 'undefined') {
    let stored: CountryCode | null = null
    try {
      stored = parseCountryCode(localStorage.getItem(COUNTRY_KEY))
    } catch {
      /* storage unavailable */
    }
    pick = stored ?? guessCountry(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages ?? [navigator.language])
  }
  return allowed.includes(pick) ? pick : DEFAULT_COUNTRY
}

/** Remember a choice on this device (the profile copy is written separately for signed-in users). */
export function rememberCountry(code: CountryCode) {
  try {
    localStorage.setItem(COUNTRY_KEY, code)
  } catch {
    /* storage unavailable */
  }
}
