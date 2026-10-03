import { createAIRoute } from '@/lib/ai/handler'
import { invitationSpec } from '@/lib/ai/features/invitation'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/invitation { partyId, tone } → wording options (copy only; nothing is sent) */
export const POST = createAIRoute(invitationSpec)
