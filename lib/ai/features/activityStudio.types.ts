/** Client-safe result type for activity_studio (the feature module itself is server-only). */
import type { ActivityDetail } from '@/lib/experience/model'
export interface ActivityStudioResult {
  mode: 'create' | 'edit'
  targetActivityId: string | null
  designedForGuests: number | null
  designedForTheme: string | null
  whatChanged: string
  activity: ActivityDetail & { id: 'act-1' }
}
