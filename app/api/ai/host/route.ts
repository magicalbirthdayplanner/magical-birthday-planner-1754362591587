import { createAIRoute } from '@/lib/ai/handler'
import { hostSpec } from '@/lib/ai/features/hostContent'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export const POST = createAIRoute(hostSpec)
