/** One view model for an activity, whether it's an AI suggestion or a row on the party. Client-safe. */
import type { ActivityDetail, ActivityDetails } from './model'

export interface ActivityView {
  emoji: string
  name: string
  description: string
  category: string
  ageMin: number | null
  ageMax: number | null
  minutes: number | null
  setting: 'indoor' | 'outdoor' | 'either'
  cost: number | null
  difficulty: string
  cleanup: string
  materials: string[]
  prep: string[]
  instructions: string[]
  script: string
  safety: string[]
  variations: string[]
  backup: string
}

export const CATEGORY_EMOJI: Record<string, string> = { game: '🎲', craft: '🎨', treasure_hunt: '🗺️', active: '🏃', calm: '🧘', performance: '🎤', food: '🧁', other: '✨' }
export const CATEGORY_LABEL: Record<string, string> = { game: 'Game', craft: 'Craft', treasure_hunt: 'Treasure hunt', active: 'Active game', calm: 'Calm activity', performance: 'Show', food: 'Food activity', other: 'Activity' }
export const SETTING_LABEL = { indoor: 'Indoor', outdoor: 'Outdoor', either: 'Indoor or outdoor' } as const
export const PREP_LABEL: Record<string, string> = { easy: 'Easy prep', medium: 'Some prep', hard: 'Big prep' }
export const CLEANUP_LABEL: Record<string, string> = { none: 'No cleanup', low: 'Little cleanup', medium: 'Some cleanup', high: 'Messy' }

export function fromDetail(a: ActivityDetail): ActivityView {
  return {
    emoji: a.emoji || CATEGORY_EMOJI[a.category] || '✨', name: a.name, description: a.description, category: a.category, ageMin: a.age_min, ageMax: a.age_max, minutes: a.duration_minutes,
    setting: a.indoor_outdoor, cost: a.estimated_cost, difficulty: a.difficulty, cleanup: a.cleanup_level, materials: a.materials, prep: a.preparation_steps, instructions: a.instructions,
    script: a.host_script, safety: a.safety_notes, variations: a.variations, backup: a.backup_version,
  }
}

interface Row { name: string; description: string | null; category: string; age_min: number | null; age_max: number | null; duration_min: number | null; setting: string; estimated_cost: number | string | null; difficulty: string; cleanup_level: string; materials: string[]; details: unknown }
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
export function fromRow(r: Row): ActivityView {
  const d = (r.details ?? {}) as ActivityDetails & Record<string, unknown>
  const setting = r.setting === 'indoor' || r.setting === 'outdoor' ? r.setting : 'either'
  return {
    emoji: (typeof d.emoji === 'string' && d.emoji) || CATEGORY_EMOJI[r.category] || '✨', name: r.name, description: r.description ?? (typeof d.whyItFits === 'string' ? d.whyItFits : ''),
    category: r.category, ageMin: r.age_min, ageMax: r.age_max, minutes: r.duration_min, setting, cost: r.estimated_cost != null ? Number(r.estimated_cost) : null, difficulty: r.difficulty, cleanup: r.cleanup_level,
    materials: r.materials ?? [], prep: strs(d.preparation_steps).length ? strs(d.preparation_steps) : typeof d.setup === 'string' && d.setup ? [d.setup] : [],
    instructions: strs(d.instructions), script: typeof d.host_script === 'string' ? d.host_script : '', safety: strs(d.safety_notes), variations: strs(d.variations), backup: typeof d.backup_version === 'string' ? d.backup_version : '',
  }
}
