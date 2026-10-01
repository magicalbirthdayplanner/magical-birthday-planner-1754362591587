'use client'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useSavedVenues } from '@/lib/data/hooks'
import { saveVenue, unsaveVenue, type SavedVenue } from '@/lib/data/venues'
import { friendlyError } from '@/lib/data/api'
import type { ClientVenue } from '@/lib/discovery/client-venue'
import { primaryCategory } from '@/lib/discovery/taxonomy'
import { track } from '@/lib/analytics/client'
import { useParty } from '@/components/app/PartyProvider'

/** Saved-venue state for the active party with optimistic toggling. */
export function useSaveVenue() {
  const { party } = useParty()
  const { data, mutate } = useSavedVenues(party?.id)
  const savedIds = useMemo(() => new Set((data ?? []).map((s) => s.place_id)), [data])

  const toggle = useCallback(
    async (venue: ClientVenue) => {
      if (!party) return
      const isSaved = savedIds.has(venue.placeId)
      const optimistic: SavedVenue[] = isSaved
        ? (data ?? []).filter((s) => s.place_id !== venue.placeId)
        : [{ id: `tmp-${venue.placeId}`, party_id: party.id, user_id: party.user_id, venue_id: '', place_id: venue.placeId, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), venue }, ...(data ?? [])]
      try {
        await mutate(
          async () => {
            if (isSaved) await unsaveVenue(party.id, venue.placeId)
            else await saveVenue(party.id, venue.placeId)
            return undefined
          },
          { optimisticData: optimistic, rollbackOnError: true, populateCache: false, revalidate: true },
        )
        track(isSaved ? 'venue_removed' : 'venue_saved', { category: primaryCategory(venue.categories)?.id ?? 'unknown' })
        if (!isSaved) toast.success(`Saved to ${party.child_name.split(' ')[0]}’s shortlist`)
      } catch (e) {
        toast.error(friendlyError(e, 'We couldn’t update your saved places.'))
      }
    },
    [party, savedIds, data, mutate],
  )

  return { savedIds, saved: data ?? [], toggle, count: data?.length ?? 0 }
}
