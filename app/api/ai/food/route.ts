import { createAIRoute } from '@/lib/ai/handler'
import { foodSpec } from '@/lib/ai/features/food'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/food { partyId, notes?, preferences? } */
export const POST = createAIRoute(foodSpec)
