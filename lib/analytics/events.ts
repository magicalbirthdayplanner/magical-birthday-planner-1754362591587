/** The single list of product analytics events. Add new events here first. */
export const ANALYTICS_EVENTS = [
  'app_open',
  'onboarding_started',
  'onboarding_step_completed',
  'party_created',
  'zip_entered',
  'venue_search_started',
  'venue_search_completed',
  'venue_viewed',
  'venue_saved',
  'venue_removed',
  'venue_added_to_party',
  'map_opened',
  'filter_used',
  'theme_viewed',
  'theme_selected',
  'guest_added',
  'invitation_shared',
  'checklist_completed',
  'party_completed',
  'pwa_install_prompted',
  'pwa_installed',
  'sign_up',
  'sign_in',
  // conversion funnel (soft launch)
  'landing_page_view',
  'party_creation_started',
  'party_creation_completed',
  'signup_started',
  'signup_completed',
  'pricing_viewed',
  'upgrade_prompt_viewed',
  'plan_upgrade_clicked',
  'checkout_started',
  'purchase_completed',
  'ai_feature_viewed',
  'ai_feature_used',
  'ai_feature_blocked',
  'rsvp_started',
  'rsvp_completed',
] as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

const set = new Set<string>(ANALYTICS_EVENTS)
export const isAnalyticsEvent = (x: unknown): x is AnalyticsEvent => typeof x === 'string' && set.has(x)

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined | string[]>

/** Drop anything that could carry PII or bloat the table. */
export function sanitizeProps(props: unknown): Record<string, string | number | boolean | null | string[]> {
  const out: Record<string, string | number | boolean | null | string[]> = {}
  if (!props || typeof props !== 'object') return out
  for (const [k, v] of Object.entries(props as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k)) continue
    if (/email|phone|name|address|token|password/i.test(k)) continue
    if (typeof v === 'string') out[k] = v.slice(0, 120)
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean' || v === null) out[k] = v
    else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string').slice(0, 12).map((x) => (x as string).slice(0, 40))
  }
  return out
}
