/**
 * Usage insights for the Super Admin "Usage" page — pure functions over rows the API route loads with the service
 * role. Nothing here touches the network, so every number is unit-testable.
 *
 * A "device" is one browser (analytics anonymous_id). Its journey is the furthest funnel step it reached; a step
 * counts a device that reached it OR any later step (people who come back signed in skip the early steps).
 */

export interface EventRow {
  event: string
  user_id: string | null
  anonymous_id: string | null
  party_id: string | null
  properties: Record<string, unknown> | null
  path: string | null
  created_at: string
}

export interface PersonRow {
  id: string
  email: string | null
  name: string | null
  createdAt: string
  confirmedAt: string | null
  lastSignInAt: string | null
}

// ---------------------------------------------------------------- funnel
export const FUNNEL = [
  { id: 'visited', label: 'Visited the site', events: null },
  { id: 'started', label: 'Started party setup', events: ['party_creation_started', 'onboarding_started'] },
  { id: 'answered', label: 'Answered the setup questions', events: ['zip_entered', 'onboarding_step_completed:zip'] },
  { id: 'venues', label: 'Saw venue results', events: ['venue_search_completed'] },
  { id: 'signup', label: 'Reached sign-up', events: ['signup_started', 'preview_save_tapped'] },
  { id: 'code', label: 'Asked for an email code', events: ['email_code_sent'] },
  { id: 'account', label: 'Created an account', events: ['signup_completed', 'sign_up'] },
  { id: 'party', label: 'Saved a party', events: ['party_created', 'party_creation_completed'] },
  {
    id: 'engaged',
    label: 'Kept planning (venue, theme, AI, guests…)',
    events: ['venue_viewed', 'venue_added_to_party', 'theme_selected', 'ai_feature_used', 'guest_added', 'invitation_created', 'invitation_shared', 'checklist_completed', 'rsvp_completed'],
  },
  { id: 'checkout', label: 'Started a checkout', events: ['checkout_started', 'plan_upgrade_clicked'] },
  { id: 'purchase', label: 'Paid', events: ['purchase_completed'] },
] as const

export type FunnelStepId = (typeof FUNNEL)[number]['id']

/** Funnel index an event proves (0 = just visited). */
export function stepOf(e: Pick<EventRow, 'event' | 'properties'>): number {
  for (let i = FUNNEL.length - 1; i > 0; i--) {
    const evs = FUNNEL[i].events as readonly string[]
    if (evs.includes(e.event)) return i
    if (e.event === 'onboarding_step_completed' && evs.includes(`onboarding_step_completed:${String(e.properties?.step ?? '')}`)) return i
  }
  return 0
}

// ---------------------------------------------------------------- traffic source
/** Where a device came from, from its FIRST event's attribution properties (never from IP). */
export function sourceOf(first: Pick<EventRow, 'properties' | 'path'> | undefined): string {
  const p = first?.properties ?? {}
  const utm = (p.utm_source ?? p.first_utm_source) as string | undefined
  if (utm) return `${utm}${p.utm_content ? ` / ${String(p.utm_content)}` : ''}`
  if (p.fbclid) return 'Facebook link'
  if (p.in_app) return 'Facebook / Instagram app'
  if (first?.path?.startsWith('/santa')) return 'Magical Santa'
  return 'Direct / other'
}

// ---------------------------------------------------------------- readable events
const EVENT_LABEL: Record<string, string> = {
  landing_page_view: 'Opened the homepage',
  app_open: 'Opened the app',
  country_selected: 'Chose a country',
  party_creation_started: 'Started party setup',
  onboarding_started: 'Started the setup questions',
  onboarding_step_completed: 'Answered a setup question',
  zip_entered: 'Entered a ZIP code',
  venue_search_started: 'Searched for venues',
  venue_search_completed: 'Got venue results',
  preview_save_tapped: 'Tapped save before signing up',
  signup_started: 'Saw the sign-up form',
  email_code_sent: 'Asked for an email code',
  signup_completed: 'Created an account',
  sign_up: 'Signed up',
  sign_in: 'Signed in',
  party_created: 'Saved a party',
  party_creation_completed: 'Finished party setup',
  venue_viewed: 'Opened a venue',
  venue_saved: 'Saved a venue',
  venue_removed: 'Removed a venue',
  venue_added_to_party: 'Picked a venue for the party',
  map_opened: 'Opened the map',
  filter_used: 'Used a filter',
  theme_viewed: 'Looked at a theme',
  theme_selected: 'Picked a theme',
  guest_added: 'Added a guest',
  invitation_created: 'Created an invitation',
  invitation_shared: 'Shared an invitation',
  whatsapp_share_initiated: 'Shared on WhatsApp',
  checklist_completed: 'Ticked a checklist item',
  party_completed: 'Marked the party done',
  rsvp_started: 'Guest opened an RSVP',
  rsvp_completed: 'Guest sent an RSVP',
  pricing_viewed: 'Viewed pricing',
  upgrade_prompt_viewed: 'Saw an upgrade prompt',
  plan_upgrade_clicked: 'Tapped upgrade',
  checkout_started: 'Started checkout',
  purchase_completed: 'Paid',
  payment_failed: 'Payment failed',
  ai_feature_viewed: 'Opened an AI feature',
  ai_feature_used: 'Used an AI feature',
  ai_feature_blocked: 'AI feature blocked',
  pwa_install_prompted: 'Saw “install app”',
  pwa_installed: 'Installed the app',
  santa_landing_view: 'Opened Magical Santa',
  santa_setup_started: 'Started Santa setup',
  santa_setup_step: 'Santa setup step',
  santa_setup_completed: 'Finished Santa setup',
  santa_signin_completed: 'Signed in (Santa)',
  santa_checkout_started: 'Started Santa checkout',
  santa_purchase_confirmed: 'Bought Santa time',
  santa_call_started: 'Started a Santa call',
  santa_call_connected: 'Santa call connected',
  santa_call_ended: 'Santa call ended',
}
export const eventLabel = (event: string) => EVENT_LABEL[event] ?? event.replace(/_/g, ' ')

/** Short, human detail from an event's properties (they never hold names, emails or addresses — see sanitizeProps). */
export function eventDetail(e: Pick<EventRow, 'event' | 'properties'>): string {
  const p = e.properties ?? {}
  const bits: string[] = []
  const add = (label: string, v: unknown) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return
    bits.push(`${label}${Array.isArray(v) ? v.join(', ') : String(v)}`)
  }
  add('step: ', p.step)
  add('', p.feature)
  add('theme: ', p.theme)
  add('interests: ', p.interests)
  if (typeof p.results === 'number') bits.push(`${p.results} results`)
  if (typeof p.apiErrors === 'number' && p.apiErrors > 0) bits.push(`${p.apiErrors} search errors`)
  if (p.degraded) bits.push('degraded')
  add('reason: ', p.reason)
  add('plan: ', p.plan)
  add('method: ', p.method)
  add('state: ', p.state)
  add('', p.market)
  if (p.utm_source) bits.push(`from ${String(p.utm_source)}${p.utm_content ? `/${String(p.utm_content)}` : ''}`)
  else if (p.fbclid) bits.push('from a Facebook link')
  if (p.preview) bits.push('before sign-up')
  return bits.join(' · ')
}

// ---------------------------------------------------------------- devices
export interface Device {
  id: string
  userId: string | null
  firstAt: string
  lastAt: string
  source: string
  events: number
  pages: string[]
  furthest: number
  country: string | null
}

const PAGE_LIMIT = 12

/** One entry per device (anonymous_id; events with no device id fall back to the signed-in user). */
export function buildDevices(events: EventRow[]): Device[] {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const map = new Map<string, Device & { _first?: EventRow }>()
  for (const e of sorted) {
    const id = e.anonymous_id ?? (e.user_id ? `user:${e.user_id}` : null)
    if (!id) continue
    let d = map.get(id)
    if (!d) {
      d = { id, userId: null, firstAt: e.created_at, lastAt: e.created_at, source: sourceOf(e), events: 0, pages: [], furthest: 0, country: null }
      map.set(id, d)
    }
    d.lastAt = e.created_at
    d.events++
    if (e.user_id) d.userId = e.user_id
    if (e.path && !d.pages.includes(e.path) && d.pages.length < PAGE_LIMIT) d.pages.push(e.path)
    d.furthest = Math.max(d.furthest, stepOf(e))
    const c = e.properties?.country ?? e.properties?.market
    if (typeof c === 'string' && !d.country) d.country = c
  }
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

export interface FunnelStep {
  id: FunnelStepId
  label: string
  devices: number
  /** Share of the previous step that got here (null for the first step). */
  fromPrevious: number | null
  /** Devices that stopped exactly here. */
  stoppedHere: number
}

export function buildFunnel(devices: Device[]): FunnelStep[] {
  return FUNNEL.map((s, i) => {
    const reached = devices.filter((d) => d.furthest >= i).length
    const prev = i === 0 ? null : devices.filter((d) => d.furthest >= i - 1).length
    return { id: s.id, label: s.label, devices: reached, fromPrevious: prev ? reached / prev : prev === 0 ? 0 : null, stoppedHere: devices.filter((d) => d.furthest === i).length }
  })
}

/** The step where the most devices give up (ignoring the last step, where everyone "stops"). */
export function biggestDrop(funnel: FunnelStep[]): { after: string; lost: number; share: number } | null {
  let best: { after: string; lost: number; share: number } | null = null
  for (let i = 1; i < funnel.length; i++) {
    const lost = funnel[i - 1].devices - funnel[i].devices
    if (lost > 0 && (!best || lost > best.lost)) best = { after: funnel[i - 1].label, lost, share: funnel[i - 1].devices ? lost / funnel[i - 1].devices : 0 }
  }
  return best
}

// ---------------------------------------------------------------- per-day + sources + features
export const dayET = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

export interface DayRow {
  day: string
  visitors: number
  started: number
  accounts: number
  parties: number
}

export function buildDays(events: EventRow[], days: string[]): DayRow[] {
  const rows = new Map(days.map((d) => [d, { day: d, visitors: new Set<string>(), started: new Set<string>(), accounts: 0, parties: 0 }]))
  for (const e of events) {
    const r = rows.get(dayET(e.created_at))
    if (!r) continue
    const id = e.anonymous_id ?? (e.user_id ? `user:${e.user_id}` : null)
    if (id) r.visitors.add(id)
    if (id && (FUNNEL[1].events as readonly string[]).includes(e.event)) r.started.add(id)
    if (e.event === 'signup_completed' || e.event === 'sign_up') r.accounts++
    if (e.event === 'party_created') r.parties++
  }
  return [...rows.values()].map((r) => ({ day: r.day, visitors: r.visitors.size, started: r.started.size, accounts: r.accounts, parties: r.parties }))
}

export interface SourceRow {
  source: string
  devices: number
  started: number
  accounts: number
  parties: number
}

export function buildSources(devices: Device[]): SourceRow[] {
  const map = new Map<string, SourceRow>()
  const idx = (id: FunnelStepId) => FUNNEL.findIndex((s) => s.id === id)
  for (const d of devices) {
    const r = map.get(d.source) ?? { source: d.source, devices: 0, started: 0, accounts: 0, parties: 0 }
    r.devices++
    if (d.furthest >= idx('started')) r.started++
    if (d.furthest >= idx('account')) r.accounts++
    if (d.furthest >= idx('party')) r.parties++
    map.set(d.source, r)
  }
  return [...map.values()].sort((a, b) => b.devices - a.devices)
}

/** Product features people use after setup: how often, and by how many people (devices). */
export const FEATURE_EVENTS = [
  'venue_viewed',
  'filter_used',
  'map_opened',
  'venue_saved',
  'venue_added_to_party',
  'theme_viewed',
  'theme_selected',
  'ai_feature_viewed',
  'ai_feature_used',
  'ai_feature_blocked',
  'guest_added',
  'invitation_created',
  'invitation_shared',
  'whatsapp_share_initiated',
  'rsvp_completed',
  'checklist_completed',
  'pricing_viewed',
  'upgrade_prompt_viewed',
  'plan_upgrade_clicked',
  'checkout_started',
  'pwa_installed',
] as const

export interface FeatureRow {
  event: string
  label: string
  times: number
  people: number
}

export function buildFeatures(events: EventRow[]): FeatureRow[] {
  return FEATURE_EVENTS.map((ev) => {
    const rows = events.filter((e) => e.event === ev)
    return { event: ev, label: eventLabel(ev), times: rows.length, people: new Set(rows.map((e) => e.anonymous_id ?? e.user_id)).size }
  })
}

// ---------------------------------------------------------------- who to leave out
/** Reserved test/smoke addresses never count (same rule as the founding-seat trigger). */
export const isTestEmail = (email: string | null | undefined) => !email || /\.(test|invalid)$/i.test(email) || /@resend\.dev$/i.test(email)

/** Comma-separated ADMIN_EXCLUDE_EMAILS: the owner's own non-admin accounts. */
export const excludedEmails = (raw: string | undefined) => new Set((raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))

/**
 * Drop staff and test traffic: events by an excluded account, and EVERY event of a device that was ever signed in as
 * one (so the owner's own browsing before signing in is left out too).
 */
export function withoutStaff(events: EventRow[], staffIds: Set<string>): EventRow[] {
  const staffDevices = new Set(events.filter((e) => e.user_id && staffIds.has(e.user_id) && e.anonymous_id).map((e) => e.anonymous_id as string))
  return events.filter((e) => !(e.user_id && staffIds.has(e.user_id)) && !(e.anonymous_id && staffDevices.has(e.anonymous_id)))
}

/** Midnight in New York for a YYYY-MM-DD day, as a UTC ISO string (EST or EDT, whichever applies that day). */
export function etMidnightIso(day: string): string {
  for (const off of ['-05:00', '-04:00']) {
    const d = new Date(`${day}T00:00:00${off}`)
    if (d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }) === '00') return d.toISOString()
  }
  return new Date(`${day}T05:00:00Z`).toISOString()
}

/** The last `n` calendar days in New York time, oldest first, ending today. */
export function lastDays(n: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(dayET(new Date(now.getTime() - i * 86_400_000).toISOString()))
  return [...new Set(out)]
}
