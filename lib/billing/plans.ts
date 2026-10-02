/**
 * Server-side plan catalogue. Product ids and prices come from the server
 * environment — never from the client. One-time "per party" purchases.
 */
export const PAID_PLANS = ['STARTER', 'PLUS', 'PRO'] as const
export type PaidPlan = (typeof PAID_PLANS)[number]

export const isPaidPlan = (x: unknown): x is PaidPlan => typeof x === 'string' && (PAID_PLANS as readonly string[]).includes(x)

/** Expected price in USD cents (matches /pricing). Override with DODO_PRICE_<PLAN>_CENTS. */
const DEFAULT_PRICE_CENTS: Record<PaidPlan, number> = { STARTER: 999, PLUS: 1999, PRO: 2999 }

type Env = Record<string, string | undefined>

export function productIdFor(plan: PaidPlan, env: Env = process.env): string | null {
  const v = env[`DODO_PRODUCT_${plan}`]?.trim()
  return v && /^pdt_[A-Za-z0-9]{6,64}$/.test(v) ? v : null
}

export function planForProduct(productId: string | null | undefined, env: Env = process.env): PaidPlan | null {
  if (!productId) return null
  return PAID_PLANS.find((p) => productIdFor(p, env) === productId) ?? null
}

export function expectedPriceCents(plan: PaidPlan, env: Env = process.env): number {
  const n = Number(env[`DODO_PRICE_${plan}_CENTS`])
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_PRICE_CENTS[plan]
}

export type DodoMode = 'test_mode' | 'live_mode'

export function dodoMode(env: Env = process.env): DodoMode {
  return env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode'
}

/** Live charging needs an explicit second switch, so a misconfigured preview can never charge. */
export function liveChargingAllowed(env: Env = process.env): boolean {
  return dodoMode(env) === 'live_mode' && env.DODO_LIVE_PAYMENTS_ENABLED === 'true'
}

export function dodoApiBase(env: Env = process.env): string {
  if (env.DODO_API_BASE_URL) return env.DODO_API_BASE_URL.replace(/\/$/, '')
  return dodoMode(env) === 'live_mode' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com'
}
