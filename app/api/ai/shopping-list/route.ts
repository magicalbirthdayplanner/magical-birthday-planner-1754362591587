import { createAIRoute } from '@/lib/ai/handler'
import { shoppingListSpec } from '@/lib/ai/features/shoppingList'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/shopping-list { partyId } → one deduplicated list grouped by category (model only categorises) */
export const POST = createAIRoute(shoppingListSpec)
