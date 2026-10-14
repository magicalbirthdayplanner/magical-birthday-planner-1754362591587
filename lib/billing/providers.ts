/**
 * Which payment provider sells a party's plan, at what price, in which currency. Decided on the server from the
 * PARTY's stored event country — never from a currency, amount or provider sent by the browser.
 *
 *   US party → Dodo Payments, USD, the existing launch prices (lib/billing/plans.ts, unchanged)
 *   IN party → Razorpay, INR, ONLY when Razorpay is configured, switched on and INR prices have been approved and set
 *
 * There is no fallback between providers: an India party is never silently sent to a USD checkout.
 * No secrets are read here beyond checking that they are present.
 */
import { countryConfig, type CountryCode, type PaymentProviderId } from '@/lib/country/countries'
import { checkoutEnvironmentAllowed, expectedPriceCents, PAID_PLANS, productIdFor, type PaidPlan } from './plans'

type Env = Record<string, string | undefined>

export type ProviderUnavailable = 'not_configured' | 'disabled' | 'prices_not_set' | 'live_disabled'

export interface ProviderPolicy {
  country: CountryCode
  provider: PaymentProviderId
  currency: 'USD' | 'INR'
  /** Can a checkout be started right now? */
  available: boolean
  reason: ProviderUnavailable | null
  /** Authoritative price per plan in MINOR units of `currency` (null = not sellable). */
  prices: Record<PaidPlan, number | null>
}

// ---------------------------------------------------------------- Razorpay configuration
export type RazorpayMode = 'test' | 'live'

/** Key ids start rzp_test_ / rzp_live_: the mode comes from the key itself, so a test key can never charge. */
export function razorpayMode(env: Env = process.env): RazorpayMode | null {
  const id = env.RAZORPAY_KEY_ID?.trim() ?? ''
  if (/^rzp_test_[A-Za-z0-9]{6,40}$/.test(id)) return 'test'
  if (/^rzp_live_[A-Za-z0-9]{6,40}$/.test(id)) return 'live'
  return null
}

/** Approved INR price for a plan, in paise (RAZORPAY_PRICE_<PLAN>_PAISE). No defaults: unset = not for sale. */
export function razorpayPricePaise(plan: PaidPlan, env: Env = process.env): number | null {
  const raw = env[`RAZORPAY_PRICE_${plan}_PAISE`]?.trim()
  if (!raw || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  // Razorpay's minimum order is ₹1; anything above ₹50,000 for one party plan is a configuration mistake.
  return Number.isSafeInteger(n) && n >= 100 && n <= 5_000_000 ? n : null
}

/**
 * Is Razorpay usable? Needs: the RAZORPAY_ENABLED switch, key id + secret, all three approved prices, and — for a
 * live key — the separate RAZORPAY_LIVE_PAYMENTS_ENABLED switch (same two-key rule as Dodo live mode).
 */
export function razorpayStatus(env: Env = process.env): { available: boolean; reason: ProviderUnavailable | null } {
  if (env.RAZORPAY_ENABLED !== 'true') return { available: false, reason: 'disabled' }
  const mode = razorpayMode(env)
  if (!mode || !env.RAZORPAY_KEY_SECRET?.trim()) return { available: false, reason: 'not_configured' }
  if (mode === 'live' && env.RAZORPAY_LIVE_PAYMENTS_ENABLED !== 'true') return { available: false, reason: 'live_disabled' }
  if (PAID_PLANS.some((p) => razorpayPricePaise(p, env) == null)) return { available: false, reason: 'prices_not_set' }
  return { available: true, reason: null }
}

/** The payment policy for a party in `country`. */
export function providerPolicy(country: unknown, env: Env = process.env): ProviderPolicy {
  const cc = countryConfig(country)
  const provider = cc.paymentProviders[0]
  if (provider === 'razorpay') {
    const st = razorpayStatus(env)
    return {
      country: cc.code,
      provider,
      currency: 'INR',
      available: st.available,
      reason: st.reason,
      prices: { STARTER: st.available ? razorpayPricePaise('STARTER', env) : null, PLUS: st.available ? razorpayPricePaise('PLUS', env) : null, PRO: st.available ? razorpayPricePaise('PRO', env) : null },
    }
  }
  // United States: exactly today's Dodo behaviour and prices.
  const configured = checkoutEnvironmentAllowed(env) && !!env.DODO_PAYMENTS_API_KEY && PAID_PLANS.every((p) => productIdFor(p, env))
  return {
    country: cc.code,
    provider: 'dodo',
    currency: 'USD',
    available: configured,
    reason: configured ? null : 'not_configured',
    prices: { STARTER: expectedPriceCents('STARTER', env), PLUS: expectedPriceCents('PLUS', env), PRO: expectedPriceCents('PRO', env) },
  }
}

/** Internal price id stored on billing_checkouts.product_id for Razorpay orders (Razorpay has no product objects). */
export const razorpayPriceId = (plan: PaidPlan) => `rzp_in_${plan.toLowerCase()}`
