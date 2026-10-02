/**
 * Venues discovered while Geoapify (OpenStreetMap data) was the provider keep
 * their `geo_` ids in storage: saved venues and notes must survive the switch
 * back to Google. These ids are not Google place ids.
 */
export const LEGACY_GEOAPIFY_PREFIX = 'geo_'
export const isLegacyGeoapifyPlaceId = (placeId: string) => placeId.startsWith(LEGACY_GEOAPIFY_PREFIX)
