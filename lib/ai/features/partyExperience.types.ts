/** Client-safe result type for party_experience (the feature module itself is server-only). */
import type { ActivityDetail, TimelineKind } from '@/lib/experience/model'
import type { FoodItem } from '../schemas/food'

export interface ExperienceResult {
  summary: string
  theme: { name: string; emoji: string; description: string; palette: string[]; decorations: string[]; id: 'theme'; activities: string[] }
  activities: (ActivityDetail & { id: string })[]
  timeline: { id: string; minute: number; duration: number; label: string; kind: TimelineKind }[]
  food: (FoodItem & { id: string })[]
  shopping: { id: string; item: string; qty: string; category: string; estimatedCost: number }[]
  host: { id: string; kind: 'welcome' | 'cake' | 'closing'; title: string; body: string }[]
  checklist: { id: string; title: string; daysBeforeParty: number; dueDate: string | null; late: boolean }[]
  budget: { lines: { id: string; category: string; amount: number }[]; total: number; overBy: number | null }
  assumptions: string[]
  designedForGuests: number | null
}
