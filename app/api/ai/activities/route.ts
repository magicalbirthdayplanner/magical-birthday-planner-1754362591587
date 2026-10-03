import { createAIRoute } from '@/lib/ai/handler'
import { activitiesSpec } from '@/lib/ai/features/activities'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/activities { partyId, notes?, materialsOnHand? } */
export const POST = createAIRoute(activitiesSpec)
