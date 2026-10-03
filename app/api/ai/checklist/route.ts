import { createAIRoute } from '@/lib/ai/handler'
import { checklistSpec } from '@/lib/ai/features/checklist'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** POST /api/ai/checklist { partyId, notes? } → tasks with server-computed, clamped due dates */
export const POST = createAIRoute(checklistSpec)
