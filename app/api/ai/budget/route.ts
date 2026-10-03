import { createAIRoute } from '@/lib/ai/handler'
import { budgetSpec } from '@/lib/ai/features/budget'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/budget { partyId, notes? } → suggestions; totals and savings are computed on the server */
export const POST = createAIRoute(budgetSpec)
