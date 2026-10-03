import { createAIRoute } from '@/lib/ai/handler'
import { partyPlannerSpec } from '@/lib/ai/features/partyPlanner'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/party-planner { partyId, notes?, overrides? } → { generationId, result, remaining } */
export const POST = createAIRoute(partyPlannerSpec)
