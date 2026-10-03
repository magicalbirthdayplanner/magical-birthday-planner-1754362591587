import { createAIRoute } from '@/lib/ai/handler'
import { activityStudioSpec } from '@/lib/ai/features/activityStudio'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export const POST = createAIRoute(activityStudioSpec)
