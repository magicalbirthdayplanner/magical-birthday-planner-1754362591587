import { createAIRoute } from '@/lib/ai/handler'
import { themeIdeasSpec } from '@/lib/ai/features/themeIdeas'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/theme-ideas { partyId, notes? } → { generationId, result: { themes[5] }, remaining } */
export const POST = createAIRoute(themeIdeasSpec)
