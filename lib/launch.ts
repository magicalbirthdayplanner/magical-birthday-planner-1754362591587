/**
 * Launch state — the single source of truth for the temporary pre-launch (waitlist) mode. Isomorphic, no secrets.
 *
 *   PRE_LAUNCH  2026-10-06 00:00:00 → 2026-10-12 23:59:59 America/New_York   (waitlist page; product closed)
 *   LIVE        from 2026-10-13 00:00:00 America/New_York (and before the window)
 *
 * The window is defined as Eastern wall-clock times and converted to instants with the IANA time zone database
 * (Intl), so it never depends on the server's or the visitor's time zone and stays right across DST changes.
 * Server code (middleware) decides; the browser countdown only displays.
 *
 * PRELAUNCH_MODE=auto (default) | on | off forces the state (local review, tests, or an emergency switch-off).
 */

export type LaunchState = 'PRE_LAUNCH' | 'LIVE'

export const LAUNCH_TIME_ZONE = 'America/New_York'

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. -240 for EDT). */
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant))
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return (Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - Math.floor(instant / 1000) * 1000) / 60_000
}

/** The instant at which the wall clock in `timeZone` reads y-m-d h:mi:s. */
export function zonedTimeToInstant(y: number, m: number, d: number, h = 0, mi = 0, s = 0, timeZone = LAUNCH_TIME_ZONE): Date {
  const wall = Date.UTC(y, m - 1, d, h, mi, s)
  // Two passes settle the offset even when the guess lands on the other side of a DST change.
  let t = wall - offsetMinutes(wall, timeZone) * 60_000
  t = wall - offsetMinutes(t, timeZone) * 60_000
  return new Date(t)
}

/** First moment of the pre-launch window: Oct 6, 2026, 12:00:00 AM Eastern. */
export const PRELAUNCH_STARTS_AT = zonedTimeToInstant(2026, 10, 6)
/** Launch: Oct 13, 2026, 12:00:00 AM Eastern. Pre-launch ends the instant before. */
export const LAUNCH_AT = zonedTimeToInstant(2026, 10, 13)
/** The waitlist's "opens tomorrow" reminder may go out from Oct 12, 2026, 12:00:00 AM Eastern until launch. */
export const REMINDER_AT = zonedTimeToInstant(2026, 10, 12)

type Env = Record<string, string | undefined>

export function launchState(now: Date | number = Date.now(), env: Env = process.env): LaunchState {
  const mode = env.PRELAUNCH_MODE?.trim().toLowerCase()
  if (mode === 'on') return 'PRE_LAUNCH'
  if (mode === 'off') return 'LIVE'
  const t = typeof now === 'number' ? now : now.getTime()
  return t >= PRELAUNCH_STARTS_AT.getTime() && t < LAUNCH_AT.getTime() ? 'PRE_LAUNCH' : 'LIVE'
}

export const isPreLaunch = (now?: Date | number, env?: Env) => launchState(now, env) === 'PRE_LAUNCH'

/** The pre-launch page's own path. `/` is rewritten to it during PRE_LAUNCH; it redirects to `/` when LIVE. */
export const PRELAUNCH_PATH = '/prelaunch'

/**
 * Public pages shown inside the pre-launch shell during PRE_LAUNCH (rewritten to `/prelaunch<path>`). `/terms` is
 * deliberately not one of them: it lists plan prices, so it redirects to the waitlist until launch.
 */
const SHELL_PAGES = ['/', '/privacy']

/**
 * Other pages a visitor may still open during PRE_LAUNCH; everything else redirects to the waitlist at `/`.
 * Guests' RSVP links for parties that already exist, the offline page and auth callbacks (password resets).
 */
const OPEN_PAGES: RegExp[] = [/^\/invite\/[^/]+\/?$/, /^\/offline\/?$/, /^\/auth\/callback\/?$/, /^\/reset-password\/?$/]

/** APIs that start something the product doesn't sell yet. */
const CLOSED_APIS: RegExp[] = [/^\/api\/billing\/checkout\/?$/]

export type PrelaunchRoute = { action: 'next' } | { action: 'rewrite'; to: string } | { action: 'redirect'; to: string } | { action: 'block' }

/** What the routing layer does with `pathname` in the given state (`preview` = owner preview cookie is valid). */
export function routeFor(pathname: string, state: LaunchState, preview = false): PrelaunchRoute {
  const isPrelaunchPage = pathname === PRELAUNCH_PATH || pathname.startsWith(`${PRELAUNCH_PATH}/`)
  if (state === 'LIVE' || preview) return isPrelaunchPage && state === 'LIVE' ? { action: 'redirect', to: pathname.slice(PRELAUNCH_PATH.length) || '/' } : { action: 'next' }
  if (pathname.startsWith('/api/')) return CLOSED_APIS.some((re) => re.test(pathname)) ? { action: 'block' } : { action: 'next' }
  const page = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  if (SHELL_PAGES.includes(page)) return { action: 'rewrite', to: page === '/' ? PRELAUNCH_PATH : `${PRELAUNCH_PATH}${page}` }
  if (isPrelaunchPage) return { action: 'redirect', to: pathname.slice(PRELAUNCH_PATH.length) || '/' }
  return OPEN_PAGES.some((re) => re.test(pathname)) ? { action: 'next' } : { action: 'redirect', to: '/' }
}
