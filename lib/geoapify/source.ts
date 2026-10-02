import 'server-only'
import type { VenueSource } from '@/lib/discovery/service'
import type { Venue } from '@/lib/discovery/types'
import { PlacesError } from '@/lib/google/places'
import { GEOAPIFY_CATEGORIES, GEOAPIFY_ID_PREFIX, geoapifyNameFits, geoapifySupports } from './categories'
import { normalizeGeoapifyPlace, type GeoapifyApi } from './places'

/** Geoapify Places as a discovery source: one category search per taxonomy category. */
export function geoapifySource(api: GeoapifyApi): VenueSource {
  return {
    id: 'geoapify',
    supports: geoapifySupports,
    async search(category, center, radiusMeters, now) {
      const found = await api.searchPlaces({ categories: GEOAPIFY_CATEGORIES[category.id] ?? [], center, radiusMeters, limit: 20 })
      return found
        .map((p) => normalizeGeoapifyPlace(p, [category.id], now))
        .filter((v): v is Venue => !!v && geoapifyNameFits(category.id, v.name))
    },
    async details(placeId, known, now) {
      if (!placeId.startsWith(GEOAPIFY_ID_PREFIX)) throw new PlacesError('not_found', 'Not a Geoapify place')
      const p = await api.placeDetails(placeId.slice(GEOAPIFY_ID_PREFIX.length))
      return p ? normalizeGeoapifyPlace(p, known?.categories ?? [], now) : null
    },
  }
}
