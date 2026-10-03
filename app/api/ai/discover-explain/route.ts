import { createAIRoute } from '@/lib/ai/handler'
import { discoverExplainSpec } from '@/lib/ai/features/discoverExplain'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/discover-explain { partyId, placeIds[≤10] } — ranks already-fetched venues; no Places API calls */
export const POST = createAIRoute(discoverExplainSpec)
