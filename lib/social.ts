/**
 * Magical Birthday Planner's official social profiles: the footer icons and the Organization `sameAs` structured
 * data both read this list, so a handle only ever changes here.
 */
export interface SocialProfile {
  id: 'facebook' | 'instagram' | 'x' | 'youtube'
  /** Network name as people say it (used in the link's accessible name). */
  name: string
  url: string
}

export const X_HANDLE = '@MagicalBPlanner'

export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61595155950282' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/magicalbirthdayplanner/' },
  { id: 'x', name: 'X', url: 'https://x.com/MagicalBPlanner' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/@magicalbirthdayplanner' },
]
