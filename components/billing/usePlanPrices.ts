'use client'
import useSWR from 'swr'
import { formatPrice, PLAN_INFO, type Plan } from '@/lib/entitlements'
import { countryConfig, type CountryCode } from '@/lib/country/countries'
import { formatMinor } from '@/lib/country/format'

type PaidPlan = Exclude<Plan, 'FREE'>
interface Catalog { country: CountryCode; provider: string; currency: 'USD' | 'INR'; available: boolean; prices: Record<PaidPlan, number | null> | null }

/**
 * Plan prices for a party's country, exactly as checkout will charge them (the server's /api/billing/catalog).
 * United States: the launch prices from lib/entitlements.ts, unchanged and without a request.
 * Other countries: shown only once that country's provider is live; until then `available` is false and no price is
 * shown (a parent never sees a price that checkout would not charge).
 */
export function usePlanPrices(country: string | null | undefined) {
  const cc = countryConfig(country).code
  const { data, isLoading } = useSWR<Catalog>(cc === 'US' ? null : ['catalog', cc], async () => {
    const r = await fetch(`/api/billing/catalog?country=${cc}`)
    if (!r.ok) throw new Error('catalog')
    return r.json()
  })
  if (cc === 'US') {
    return { country: cc, loading: false, available: true, provider: 'dodo', label: (p: Plan) => formatPrice(PLAN_INFO[p].priceCents) }
  }
  const available = !!data?.available && !!data.prices
  return {
    country: cc,
    loading: isLoading,
    available,
    provider: data?.provider ?? countryConfig(cc).paymentProviders[0],
    /** "₹499" when on sale; null while unavailable. FREE is always "₹0". */
    label: (p: Plan): string | null => (p === 'FREE' ? formatMinor(0, countryConfig(cc).currency) : available && data!.prices![p] != null ? formatMinor(data!.prices![p]!, data!.currency) : null),
  }
}
