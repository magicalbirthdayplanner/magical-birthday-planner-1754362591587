/**
 * Discovery taxonomy → Geoapify Places categories (OpenStreetMap-based).
 * Pure data; safe on client and server.
 *
 * Only categories that OSM actually tags are mapped. Taxonomy entries with no
 * honest equivalent (magicians, party halls, pottery studios…) are left out, so
 * discovery skips them instead of returning loosely related places.
 * Every value here was checked against the live API (unknown categories → 400).
 * Trampoline/climbing parks and picnic sites are deliberately absent: those
 * searches took 14–20 s on Geoapify and returned almost nothing.
 */
export const GEOAPIFY_CATEGORIES: Record<string, string[]> = {
  'birthday-party-venue': ['entertainment.activity_park', 'entertainment.amusement_arcade', 'entertainment.bowling_alley', 'entertainment.miniature_golf'],
  'community-center': ['activity.community_center'],
  bowling: ['entertainment.bowling_alley'],
  arcade: ['entertainment.amusement_arcade'],
  'childrens-museum': ['entertainment.museum'],
  'art-studio': ['entertainment.culture.arts_centre'],
  'movie-theater': ['entertainment.cinema'],
  'science-center': ['entertainment.planetarium'],
  aquarium: ['entertainment.aquarium'],
  'music-studio': ['education.music_school'],
  park: ['leisure.park'],
  playground: ['leisure.playground'],
  zoo: ['entertainment.zoo'],
  'botanical-garden': ['leisure.park.garden'],
  'outdoor-recreation': ['entertainment.miniature_golf', 'entertainment.theme_park', 'entertainment.water_park'],
  'sports-facility': ['sport.sports_centre', 'sport.ice_rink', 'sport.swimming_pool'],
  bakery: ['commercial.food_and_drink.bakery'],
  'cake-shop': ['commercial.food_and_drink.confectionery'],
}

/**
 * OSM has one "museum" tag for every museum. Only kid-oriented ones (by name)
 * count as a children's museum — a local historical society is not one.
 */
export const GEOAPIFY_NAME_FILTERS: Record<string, RegExp> = {
  'childrens-museum': /\b(child|kid|discover|science|art|play|hands[- ]?on|imagin|explor|natur|youth|family)/i,
}

export const geoapifySupports = (categoryId: string) => (GEOAPIFY_CATEGORIES[categoryId]?.length ?? 0) > 0

/** Does a place with this name honestly belong to the taxonomy category? */
export const geoapifyNameFits = (categoryId: string, name: string) => GEOAPIFY_NAME_FILTERS[categoryId]?.test(name) ?? true

/** Taxonomy categories implied by a place's Geoapify categories (exact match) and name. */
export function categoriesForGeoapify(types: readonly string[] | null | undefined, name = ''): string[] {
  if (!types?.length) return []
  const set = new Set(types)
  return Object.entries(GEOAPIFY_CATEGORIES)
    // The generic party-venue bucket is a search, not a classification.
    .filter(([id, cats]) => id !== 'birthday-party-venue' && cats.some((c) => set.has(c)) && geoapifyNameFits(id, name))
    .map(([id]) => id)
}

const MAPPED = new Set(Object.values(GEOAPIFY_CATEGORIES).flat())
const ATTRIBUTE_ROOTS = /^(building|access|access_limited|fee|no_fee|wheelchair|internet_access|dogs|no_dogs|vegetarian|vegan|named)(\.|$)/

/** Display type: the most specific category we search for, else the most specific descriptive one. */
export function primaryGeoapifyType(types: readonly string[]): string | null {
  const depth = (t: string) => t.split('.').length
  const pick = (list: readonly string[]) => list.reduce<string | null>((best, t) => (!best || depth(t) > depth(best) ? t : best), null)
  return pick(types.filter((t) => MAPPED.has(t))) ?? pick(types.filter((t) => !ATTRIBUTE_ROOTS.test(t)))
}

/** Place ids from Geoapify are namespaced so they never collide with Google ids. */
export const GEOAPIFY_ID_PREFIX = 'geo_'
export const isGeoapifyPlaceId = (placeId: string) => placeId.startsWith(GEOAPIFY_ID_PREFIX)
