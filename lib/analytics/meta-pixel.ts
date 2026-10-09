/**
 * Meta Pixel mapping for the paid-acquisition test (Facebook + Instagram ads). Product analytics events → Meta
 * events, so Ads Manager can optimise for and report sign-ups. Isomorphic and pure; components/analytics/MetaPixel
 * loads the pixel and feeds it. Only event names and plan values are sent — never a name, email, child or party detail.
 */
import { PLAN_INFO, type Plan } from '@/lib/entitlements'
import type { AnalyticsEvent } from './events'

export type PixelCall = { kind: 'track' | 'trackCustom'; name: string; params?: Record<string, string | number> }

/** Events that count as the first real planning step after a party exists ("activation"). */
const PLANNING_ACTIONS: ReadonlySet<AnalyticsEvent> = new Set<AnalyticsEvent>([
  'venue_saved', 'venue_added_to_party', 'theme_selected', 'ai_feature_used', 'guest_added', 'invitation_shared', 'checklist_completed',
])

const planValue = (plan: unknown) => {
  const p = typeof plan === 'string' ? (plan.toUpperCase() as Plan) : null
  return p && p in PLAN_INFO ? { currency: 'USD', value: PLAN_INFO[p].priceCents / 100 } : { currency: 'USD', value: 0 }
}

/**
 * The pixel calls for one analytics event. `firstAction` says whether this device has already sent FirstPlanningAction
 * (it is sent once).
 */
export function pixelCallsFor(event: AnalyticsEvent, props: Record<string, unknown>, firstActionSent: boolean): PixelCall[] {
  switch (event) {
    case 'signup_started':
      return [{ kind: 'trackCustom', name: 'SignupStarted' }]
    case 'signup_completed':
      return [{ kind: 'track', name: 'CompleteRegistration' }]
    case 'party_created':
      return [{ kind: 'trackCustom', name: 'PartyCreated' }]
    case 'pricing_viewed':
      return [{ kind: 'track', name: 'ViewContent', params: { content_name: 'pricing' } }]
    case 'checkout_started':
      return [{ kind: 'track', name: 'InitiateCheckout', params: planValue(props.plan) }]
    case 'purchase_completed':
      return [{ kind: 'track', name: 'Purchase', params: planValue(props.plan) }]
    default:
      return PLANNING_ACTIONS.has(event) && !firstActionSent ? [{ kind: 'trackCustom', name: 'FirstPlanningAction' }] : []
  }
}

/** Pages the pixel never runs on: guests' RSVP links (guests aren't the audience), admin and auth return points. */
export const pixelAllowedOn = (pathname: string) => !/^\/(invite|admin|auth|reset-password)(\/|$)/.test(pathname)

/** Sign-in tokens arrive in the URL fragment after email confirmation / Google; the pixel reports the page URL, so it
 *  must wait until the auth client has removed them. */
export const urlHasAuthTokens = (hash: string) => /access_token|refresh_token|provider_token|error_description|type=recovery/i.test(hash)
