#!/usr/bin/env node
/**
 * Read-only: checks that the Dodo products this environment checks out with charge exactly what /pricing shows.
 * Uses DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_ENVIRONMENT (or DODO_API_BASE_URL) and DODO_PRODUCT_STARTER/PLUS/PRO,
 * plus optional DODO_PRICE_<PLAN>_CENTS overrides — the same variables the app uses. Only GETs products; never
 * changes anything and never prints the key. Exits 1 on any mismatch.
 *   node scripts/check-dodo-prices.mjs
 */

/** Must equal PLAN_INFO[plan].priceCents in lib/entitlements.ts (pinned by tests/unit/entitlements.test.ts). */
export const EXPECTED_CENTS = { STARTER: 999, PLUS: 1999, PRO: 2999 }

/** Problems with one Dodo product, given the plan's expected USD cents. Empty = matches. */
export function productProblems(product, cents) {
  const d = (typeof product?.price === 'object' && product.price) || product?.price_detail || {} // GET /products/{id} | list item
  const out = []
  if (d.type !== 'one_time_price') out.push(`price type is ${d.type ?? 'missing'}, expected one_time_price (no subscription)`)
  if (d.currency !== 'USD') out.push(`currency is ${d.currency ?? 'missing'}, expected USD`)
  if (d.price !== cents) out.push(`price is ${d.price ?? 'missing'} cents, expected ${cents}`)
  if (d.discount) out.push(`has a ${d.discount}% discount`)
  if (d.pay_what_you_want) out.push('is pay-what-you-want')
  return out
}

async function main(env = process.env) {
  const key = env.DODO_PAYMENTS_API_KEY
  const base = (env.DODO_API_BASE_URL || (env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com')).replace(/\/$/, '')
  if (!key) throw new Error('DODO_PAYMENTS_API_KEY is not set')
  let failed = false
  console.log(`Dodo ${env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode'} (${base})`)
  for (const plan of Object.keys(EXPECTED_CENTS)) {
    const id = env[`DODO_PRODUCT_${plan}`]?.trim()
    const override = Number(env[`DODO_PRICE_${plan}_CENTS`])
    const cents = Number.isInteger(override) && override > 0 ? override : EXPECTED_CENTS[plan]
    if (!id) {
      console.log(`✗ ${plan}: DODO_PRODUCT_${plan} is not set`)
      failed = true
      continue
    }
    const res = await fetch(`${base}/products/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } })
    if (!res.ok) {
      console.log(`✗ ${plan} ${id}: HTTP ${res.status}`)
      failed = true
      continue
    }
    const problems = productProblems(await res.json(), cents)
    if (cents !== EXPECTED_CENTS[plan]) problems.push(`DODO_PRICE_${plan}_CENTS=${cents} differs from /pricing (${EXPECTED_CENTS[plan]})`)
    console.log(problems.length ? `✗ ${plan} ${id}: ${problems.join('; ')}` : `✓ ${plan} ${id}: $${(cents / 100).toFixed(2)} USD`)
    failed ||= problems.length > 0
  }
  if (failed) process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
