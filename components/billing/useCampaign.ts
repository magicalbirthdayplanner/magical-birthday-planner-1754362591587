'use client'
import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { useOptionalParty } from '@/components/app/PartyProvider'
import { formatDateWith } from '@/lib/country/format'
import { preferredCountry } from '@/lib/country/preference'

export interface Campaign { active: true; id: string; plan: 'STARTER' | 'PLUS' | 'PRO'; endsAt: string; endsOn: string }

/**
 * The site-wide free campaign (GET /api/campaign), or null. Display only — the database and server grant access.
 * `until` is the last free day in the reader's market style ("November 13" / "13 November").
 */
export function useCampaign() {
  const { data } = useSWR<Campaign | { active: false }>('/api/campaign', (u: string) => fetch(u).then((r) => r.json()), { revalidateOnFocus: false, dedupingInterval: 60_000 })
  const party = useOptionalParty()?.party
  const [country, setCountry] = useState<string>('US')
  useEffect(() => setCountry(party?.country_code ?? preferredCountry()), [party?.country_code])
  // The window closes by the clock too, even if this page stays open past the end.
  const campaign = data && data.active && Date.parse(data.endsAt) > Date.now() ? data : null
  return { campaign, loaded: !!data, until: campaign ? formatDateWith(campaign.endsOn, country, { month: 'long', day: 'numeric' }) : null }
}
