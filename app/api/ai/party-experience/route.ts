import { createAIRoute } from '@/lib/ai/handler'
import { experienceSpec } from '@/lib/ai/features/partyExperience'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export const POST = createAIRoute(experienceSpec)
