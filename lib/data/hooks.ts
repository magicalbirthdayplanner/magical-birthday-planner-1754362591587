'use client'
import useSWR from 'swr'
import { apiFetch } from './api'
import { listGuests } from './guests'
import { ensureChecklist, listChecklist } from './checklist'
import { getInvitation } from './invitations'
import { getChosenVenue, listSavedVenues } from './venues'
import type { Party } from './parties'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { settingFromVenueType } from '@/lib/discovery/party-context'

export interface DiscoveryResponse {
  location: { zip: string; city: string | null; state: string | null; lat: number; lng: number; radiusMiles: number }
  total: number
  venues: ClientVenue[]
  meta: { categories: string[]; cacheHits: number; cacheMisses: number; degraded: null | 'stale_cache' | 'stored_venues'; partialErrors: number }
}

export const discoveryKey = (partyId: string, radiusMiles: number, categories?: string[]) =>
  ['discovery', partyId, radiusMiles, (categories ?? []).join(',')] as const

export function fetchDiscovery(partyId: string, radiusMiles: number, categories?: string[], refresh = false) {
  return apiFetch<DiscoveryResponse>('/api/discovery/search', {
    method: 'POST',
    body: JSON.stringify({ partyId, radiusMiles, categories: categories?.length ? categories : undefined, refresh: refresh || undefined }),
  })
}

/** Local discovery for the active party. Cached in memory across tabs. */
export function useDiscovery(partyId: string | null | undefined, radiusMiles: number, categories?: string[]) {
  return useSWR(partyId ? discoveryKey(partyId, radiusMiles, categories) : null, ([, id, r]) => fetchDiscovery(id, r, categories), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 10 * 60_000,
    shouldRetryOnError: false,
    keepPreviousData: true,
  })
}

export function useVenueDetails(placeId: string | null, partyId?: string | null) {
  return useSWR(placeId ? ['venue', placeId, partyId ?? ''] : null, () =>
    apiFetch<{ venue: ClientVenue; stale: boolean }>(`/api/discovery/places/${encodeURIComponent(placeId!)}${partyId ? `?partyId=${partyId}` : ''}`),
  { revalidateOnFocus: false, shouldRetryOnError: false })
}

export function useSavedVenues(partyId: string | null | undefined) {
  return useSWR(partyId ? ['saved', partyId] : null, () => listSavedVenues(partyId!))
}

export function useChosenVenue(partyId: string | null | undefined) {
  return useSWR(partyId ? ['chosen', partyId] : null, () => getChosenVenue(partyId!))
}

export function useGuests(partyId: string | null | undefined) {
  return useSWR(partyId ? ['guests', partyId] : null, () => listGuests(partyId!))
}

export function useInvitation(partyId: string | null | undefined) {
  return useSWR(partyId ? ['invitation', partyId] : null, () => getInvitation(partyId!))
}

/** Checklist; generates the party's tasks on first load (idempotent). */
export function useChecklist(party: Party | null | undefined, hasVenue?: boolean) {
  return useSWR(party ? ['checklist', party.id] : null, async () => {
    const existing = await listChecklist(party!.id)
    if (existing.some((t) => !t.is_custom)) return existing
    return ensureChecklist(party!.id, {
      partyDate: party!.party_date,
      guestCount: party!.guest_count,
      hasVenue: !!hasVenue,
      setting: settingFromVenueType(party!.venue_type),
      theme: party!.theme,
      childName: party!.child_name,
    })
  })
}
