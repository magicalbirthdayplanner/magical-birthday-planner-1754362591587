import { createAIRoute } from '@/lib/ai/handler'
import { timelineSpec } from '@/lib/ai/features/timeline'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/timeline { partyId, adjust?: 'relaxed'|'more_games'|'less_prep' } */
export const POST = createAIRoute(timelineSpec)
