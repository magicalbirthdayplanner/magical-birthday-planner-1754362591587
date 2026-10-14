import { NextResponse } from 'next/server'
import { parseCountryCode } from '@/lib/country/countries'
import { providerPolicy } from '@/lib/billing/providers'
import { apiError, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/catalog?country=IN → what a party in that country can buy right now:
 * { country, provider, currency, available, prices: { STARTER, PLUS, PRO } (minor units) | null }.
 * Public and secret-free. Prices are the SAME numbers checkout charges (lib/billing/providers.ts); for a country whose
 * provider isn't live yet, `available` is false and no prices are returned (unapproved prices are never shown).
 */
export async function GET(req: Request) {
  if (!rateLimit(`catalog:${clientIp(req)}`, 60, 60_000).ok) return apiError(429, 'rate_limited', 'Too many requests.')
  const country = parseCountryCode(new URL(req.url).searchParams.get('country') ?? 'US')
  if (!country) return apiError(422, 'invalid_request', 'That country isn’t supported yet.')
  const p = providerPolicy(country)
  // US prices are public launch prices (shown on /pricing even when checkout is offline); other markets only once live.
  const showPrices = p.provider === 'dodo' || p.available
  return NextResponse.json({ country: p.country, provider: p.provider, currency: p.currency, available: p.available, prices: showPrices ? p.prices : null })
}
