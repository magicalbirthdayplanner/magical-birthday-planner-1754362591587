'use client'
import { useCallback } from 'react'
import { useOptionalParty } from './PartyProvider'
import { countryConfig, type CountryCode } from '@/lib/country/countries'
import { formatMoney } from '@/lib/country/format'

/** The active party's event country (United States outside a party / for parties created before India support). */
export function usePartyCountry(): CountryCode {
  return countryConfig(useOptionalParty()?.party?.country_code).code
}

/** Money formatter in the active party's currency: "$25", "$1,500", "₹1,499". Amounts are never converted. */
export function useMoney(): (n: number) => string {
  const country = usePartyCountry()
  return useCallback((n: number) => formatMoney(n, country), [country])
}
