/**
 * Reusable party-discovery taxonomy. Pure data + lookups; no UI, no I/O.
 *
 * Each category maps to one Places Text Search query. `googleTypes` classify
 * places returned by *other* queries into this category as well (a bowling
 * alley found by "birthday party venue" is still a bowling alley).
 */

export type Setting = 'indoor' | 'outdoor' | 'either'
export type CategoryGroup = 'indoor' | 'outdoor' | 'general' | 'vendor'

export const INTERESTS = [
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'animals', label: 'Animals', emoji: '🦁' },
  { id: 'adventure', label: 'Adventure', emoji: '🧗' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'princess', label: 'Princess', emoji: '👑' },
  { id: 'superhero', label: 'Superhero', emoji: '🦸' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'dance', label: 'Dance', emoji: '💃' },
  { id: 'cooking', label: 'Cooking', emoji: '🧁' },
] as const
export type InterestId = (typeof INTERESTS)[number]['id']
export const INTEREST_IDS = INTERESTS.map((i) => i.id) as InterestId[]

export const AGE_BANDS = [
  { id: 'toddler', label: 'Toddler', range: [1, 2] },
  { id: 'preschool', label: 'Preschool', range: [3, 5] },
  { id: 'kids', label: 'Kids', range: [6, 9] },
  { id: 'tweens', label: 'Tweens', range: [10, 13] },
] as const
export type AgeBandId = (typeof AGE_BANDS)[number]['id']

export function ageBandFor(age: number | null | undefined): AgeBandId | null {
  if (age == null || !Number.isFinite(age)) return null
  if (age <= 2) return 'toddler'
  if (age <= 5) return 'preschool'
  if (age <= 9) return 'kids'
  return 'tweens'
}

/** Results-screen chips (besides "Recommended", "Indoor", "Outdoor", "Budget"). */
export type ChipId = 'art' | 'sports' | 'play' | 'museums' | 'parks' | 'vendors'

export interface DiscoveryCategory {
  id: string
  label: string
  emoji: string
  group: CategoryGroup
  setting: Setting
  /** Text Search query; the location bias carries the "near me" part. */
  query: string
  interests: InterestId[]
  /** Inclusive suitable child age range. */
  ages: [number, number]
  googleTypes: string[]
  chips: ChipId[]
  /** Static tie-breaker; lower comes first. */
  priority: number
}

const c = (x: DiscoveryCategory) => x

export const CATEGORIES: DiscoveryCategory[] = [
  // ---------------------------------------------------------------- general
  c({ id: 'birthday-party-venue', label: 'Party venue', emoji: '🎉', group: 'general', setting: 'either', query: 'kids birthday party venue', interests: [], ages: [1, 13], googleTypes: [], chips: ['play'], priority: 0 }),
  c({ id: 'event-venue', label: 'Event venue', emoji: '🏛️', group: 'general', setting: 'indoor', query: 'event venue', interests: ['princess'], ages: [0, 13], googleTypes: ['event_venue', 'wedding_venue'], chips: [], priority: 40 }),
  c({ id: 'community-center', label: 'Community center', emoji: '🏘️', group: 'general', setting: 'indoor', query: 'community center party room rental', interests: [], ages: [0, 13], googleTypes: ['community_center'], chips: [], priority: 30 }),
  c({ id: 'banquet-hall', label: 'Banquet hall', emoji: '🍽️', group: 'general', setting: 'indoor', query: 'banquet hall', interests: [], ages: [0, 13], googleTypes: ['banquet_hall'], chips: [], priority: 60 }),
  c({ id: 'party-hall', label: 'Party hall', emoji: '🎈', group: 'general', setting: 'indoor', query: 'party hall rental', interests: [], ages: [0, 13], googleTypes: [], chips: [], priority: 50 }),

  // ---------------------------------------------------------------- indoor
  c({ id: 'indoor-playground', label: 'Indoor playground', emoji: '🛝', group: 'indoor', setting: 'indoor', query: 'indoor playground', interests: ['adventure', 'superhero'], ages: [1, 8], googleTypes: ['indoor_playground'], chips: ['play'], priority: 5 }),
  c({ id: 'trampoline-park', label: 'Trampoline park', emoji: '🤸', group: 'indoor', setting: 'indoor', query: 'trampoline park', interests: ['sports', 'adventure', 'superhero'], ages: [4, 13], googleTypes: [], chips: ['play', 'sports'], priority: 6 }),
  c({ id: 'bowling', label: 'Bowling', emoji: '🎳', group: 'indoor', setting: 'indoor', query: 'bowling alley', interests: ['sports', 'gaming'], ages: [4, 13], googleTypes: ['bowling_alley'], chips: ['sports', 'play'], priority: 10 }),
  c({ id: 'arcade', label: 'Arcade', emoji: '🕹️', group: 'indoor', setting: 'indoor', query: 'family arcade', interests: ['gaming'], ages: [5, 13], googleTypes: ['video_arcade', 'amusement_center'], chips: ['play'], priority: 14 }),
  c({ id: 'childrens-museum', label: "Children's museum", emoji: '🏛️', group: 'indoor', setting: 'indoor', query: "children's museum", interests: ['science', 'art'], ages: [1, 9], googleTypes: ['museum'], chips: ['museums'], priority: 8 }),
  c({ id: 'art-studio', label: 'Art studio', emoji: '🎨', group: 'indoor', setting: 'indoor', query: 'kids art studio birthday party', interests: ['art'], ages: [3, 13], googleTypes: ['art_studio'], chips: ['art'], priority: 12 }),
  c({ id: 'pottery-studio', label: 'Pottery studio', emoji: '🏺', group: 'indoor', setting: 'indoor', query: 'paint your own pottery studio', interests: ['art'], ages: [4, 13], googleTypes: [], chips: ['art'], priority: 13 }),
  c({ id: 'gymnastics', label: 'Gymnastics', emoji: '🤸', group: 'indoor', setting: 'indoor', query: 'kids gymnastics birthday party', interests: ['sports', 'dance', 'superhero'], ages: [2, 11], googleTypes: [], chips: ['sports'], priority: 16 }),
  c({ id: 'dance-studio', label: 'Dance studio', emoji: '💃', group: 'indoor', setting: 'indoor', query: 'kids dance studio birthday party', interests: ['dance', 'music', 'princess'], ages: [3, 13], googleTypes: ['dance_hall'], chips: ['art'], priority: 18 }),
  c({ id: 'kids-activity-center', label: 'Kids activity center', emoji: '🧩', group: 'indoor', setting: 'indoor', query: 'kids activity center', interests: ['art', 'science', 'adventure', 'princess', 'superhero'], ages: [2, 10], googleTypes: [], chips: ['play'], priority: 7 }),
  c({ id: 'laser-tag', label: 'Laser tag', emoji: '🔫', group: 'indoor', setting: 'indoor', query: 'laser tag', interests: ['gaming', 'adventure', 'superhero'], ages: [7, 13], googleTypes: [], chips: ['play'], priority: 20 }),
  c({ id: 'movie-theater', label: 'Movie theater', emoji: '🎬', group: 'indoor', setting: 'indoor', query: 'movie theater private party', interests: ['gaming', 'superhero', 'princess'], ages: [4, 13], googleTypes: ['movie_theater'], chips: [], priority: 35 }),
  c({ id: 'science-center', label: 'Science center', emoji: '🔬', group: 'indoor', setting: 'indoor', query: 'science center', interests: ['science'], ages: [4, 13], googleTypes: ['planetarium', 'science_museum'], chips: ['museums'], priority: 15 }),
  c({ id: 'cooking-studio', label: 'Cooking studio', emoji: '🧑‍🍳', group: 'indoor', setting: 'indoor', query: 'kids cooking class', interests: ['cooking'], ages: [5, 13], googleTypes: ['cooking_school'], chips: ['art'], priority: 22 }),
  c({ id: 'climbing-gym', label: 'Climbing gym', emoji: '🧗', group: 'indoor', setting: 'indoor', query: 'rock climbing gym kids', interests: ['adventure', 'sports'], ages: [5, 13], googleTypes: [], chips: ['sports'], priority: 24 }),
  c({ id: 'aquarium', label: 'Aquarium', emoji: '🐠', group: 'indoor', setting: 'indoor', query: 'aquarium', interests: ['animals', 'science', 'nature'], ages: [0, 13], googleTypes: ['aquarium'], chips: ['museums'], priority: 26 }),
  c({ id: 'music-studio', label: 'Music studio', emoji: '🎵', group: 'indoor', setting: 'indoor', query: 'kids music class birthday party', interests: ['music'], ages: [2, 13], googleTypes: [], chips: ['art'], priority: 28 }),
  c({ id: 'indoor-event-venue', label: 'Indoor party room', emoji: '🏠', group: 'indoor', setting: 'indoor', query: 'indoor party room rental', interests: [], ages: [0, 13], googleTypes: [], chips: [], priority: 45 }),

  // ---------------------------------------------------------------- outdoor
  c({ id: 'park', label: 'Park', emoji: '🌳', group: 'outdoor', setting: 'outdoor', query: 'park with picnic shelter', interests: ['nature', 'sports', 'adventure'], ages: [0, 13], googleTypes: ['park', 'city_park', 'state_park'], chips: ['parks'], priority: 9 }),
  c({ id: 'playground', label: 'Playground', emoji: '🛝', group: 'outdoor', setting: 'outdoor', query: 'playground', interests: ['adventure', 'nature'], ages: [1, 10], googleTypes: ['playground'], chips: ['parks', 'play'], priority: 17 }),
  c({ id: 'zoo', label: 'Zoo', emoji: '🦁', group: 'outdoor', setting: 'outdoor', query: 'zoo', interests: ['animals', 'nature'], ages: [0, 13], googleTypes: ['zoo', 'wildlife_park'], chips: ['parks', 'museums'], priority: 19 }),
  c({ id: 'farm', label: 'Farm', emoji: '🐴', group: 'outdoor', setting: 'outdoor', query: 'petting farm', interests: ['animals', 'nature'], ages: [1, 10], googleTypes: ['farm'], chips: ['parks'], priority: 21 }),
  c({ id: 'botanical-garden', label: 'Botanical garden', emoji: '🌸', group: 'outdoor', setting: 'outdoor', query: 'botanical garden', interests: ['nature', 'princess'], ages: [3, 13], googleTypes: ['botanical_garden', 'garden'], chips: ['parks'], priority: 32 }),
  c({ id: 'outdoor-recreation', label: 'Outdoor fun', emoji: '⛳', group: 'outdoor', setting: 'outdoor', query: 'mini golf go karts family fun center', interests: ['adventure', 'sports', 'gaming'], ages: [5, 13], googleTypes: ['amusement_park', 'miniature_golf_course', 'go_karting_venue'], chips: ['play', 'sports'], priority: 23 }),
  c({ id: 'sports-facility', label: 'Sports facility', emoji: '🏟️', group: 'outdoor', setting: 'either', query: 'kids sports facility birthday party', interests: ['sports'], ages: [5, 13], googleTypes: ['sports_complex', 'sports_club', 'athletic_field', 'ice_skating_rink', 'swimming_pool'], chips: ['sports'], priority: 25 }),
  c({ id: 'picnic-area', label: 'Picnic area', emoji: '🧺', group: 'outdoor', setting: 'outdoor', query: 'picnic area pavilion', interests: ['nature'], ages: [0, 13], googleTypes: ['picnic_ground'], chips: ['parks'], priority: 34 }),
  c({ id: 'splash-pad', label: 'Splash pad', emoji: '💦', group: 'outdoor', setting: 'outdoor', query: 'splash pad', interests: ['adventure', 'nature'], ages: [1, 8], googleTypes: [], chips: ['parks', 'play'], priority: 36 }),

  // ---------------------------------------------------------------- vendors (searched on demand)
  c({ id: 'bakery', label: 'Bakery', emoji: '🥐', group: 'vendor', setting: 'either', query: 'bakery custom birthday cakes', interests: ['cooking'], ages: [0, 13], googleTypes: ['bakery'], chips: ['vendors'], priority: 100 }),
  c({ id: 'cake-shop', label: 'Cake shop', emoji: '🎂', group: 'vendor', setting: 'either', query: 'cake shop', interests: [], ages: [0, 13], googleTypes: ['cake_shop', 'dessert_shop'], chips: ['vendors'], priority: 101 }),
  c({ id: 'balloon-decorator', label: 'Balloon decor', emoji: '🎈', group: 'vendor', setting: 'either', query: 'balloon decorator', interests: [], ages: [0, 13], googleTypes: [], chips: ['vendors'], priority: 102 }),
  c({ id: 'party-rental', label: 'Party rentals', emoji: '🎪', group: 'vendor', setting: 'either', query: 'party rental bounce house', interests: [], ages: [0, 13], googleTypes: [], chips: ['vendors'], priority: 103 }),
  c({ id: 'photographer', label: 'Photographer', emoji: '📸', group: 'vendor', setting: 'either', query: 'birthday party photographer', interests: [], ages: [0, 13], googleTypes: ['photographer'], chips: ['vendors'], priority: 104 }),
  c({ id: 'face-painter', label: 'Face painter', emoji: '🎭', group: 'vendor', setting: 'either', query: 'face painter for kids parties', interests: ['art'], ages: [2, 10], googleTypes: [], chips: ['vendors'], priority: 105 }),
  c({ id: 'magician', label: 'Magician', emoji: '🪄', group: 'vendor', setting: 'either', query: 'kids party magician', interests: [], ages: [3, 11], googleTypes: [], chips: ['vendors'], priority: 106 }),
  c({ id: 'entertainer', label: 'Entertainer', emoji: '🤹', group: 'vendor', setting: 'either', query: 'kids party entertainer', interests: ['princess', 'superhero'], ages: [2, 11], googleTypes: [], chips: ['vendors'], priority: 107 }),
  c({ id: 'dj', label: 'DJ', emoji: '🎧', group: 'vendor', setting: 'either', query: 'kids party DJ', interests: ['music', 'dance'], ages: [5, 13], googleTypes: [], chips: ['vendors'], priority: 108 }),
  c({ id: 'caterer', label: 'Caterer', emoji: '🍱', group: 'vendor', setting: 'either', query: 'party catering', interests: [], ages: [0, 13], googleTypes: ['catering_service'], chips: ['vendors'], priority: 109 }),
]

const byId = new Map(CATEGORIES.map((cat) => [cat.id, cat]))
export const getCategory = (id: string): DiscoveryCategory | undefined => byId.get(id)

export const VENUE_CATEGORIES = CATEGORIES.filter((cat) => cat.group !== 'vendor')
export const VENDOR_CATEGORIES = CATEGORIES.filter((cat) => cat.group === 'vendor')

/** Taxonomy categories implied by a place's Google types. */
export function categoriesForGoogleTypes(types: readonly string[] | null | undefined): string[] {
  if (!types?.length) return []
  const set = new Set(types)
  return CATEGORIES.filter((cat) => cat.googleTypes.some((t) => set.has(t))).map((cat) => cat.id)
}

/** Indoor/outdoor of a venue from its categories (first non-"either" wins by priority). */
export function settingForCategories(categoryIds: readonly string[]): Setting {
  const cats = categoryIds
    .map(getCategory)
    .filter((x): x is DiscoveryCategory => !!x)
    .sort((a, b) => a.priority - b.priority)
  return cats.find((cat) => cat.setting !== 'either')?.setting ?? 'either'
}

/** Primary (most specific) category for display. Generic "party venue" loses to specific ones. */
export function primaryCategory(categoryIds: readonly string[]): DiscoveryCategory | undefined {
  const cats = categoryIds.map(getCategory).filter((x): x is DiscoveryCategory => !!x)
  const specific = cats.filter((cat) => cat.group !== 'general')
  return (specific.length ? specific : cats).sort((a, b) => a.priority - b.priority)[0]
}

export const CHIPS: { id: 'recommended' | 'indoor' | 'outdoor' | 'budget' | ChipId; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'art', label: 'Art' },
  { id: 'sports', label: 'Sports' },
  { id: 'play', label: 'Play' },
  { id: 'museums', label: 'Museums' },
  { id: 'parks', label: 'Parks' },
  { id: 'budget', label: 'Budget' },
  { id: 'vendors', label: 'Cakes & vendors' },
]
