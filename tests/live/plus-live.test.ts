/**
 * MANUAL live check of the Plus ("Organize") features on the real model (AI_LIVE=1 + AI_API_KEY): food, budget,
 * invitation, timeline, shopping list. Runs each feature exactly like the route does (its spec's prompt, schema,
 * output cap, timeout and server post-processing) on one realistic, already-planned party. Never runs in CI.
 */
import { describe, expect, it } from 'vitest'
import { readAIConfig } from '@/lib/ai/config'
import { callStructured } from '@/lib/ai/client'
import type { PartyAIContext } from '@/lib/ai/context'
import type { FeatureSpec } from '@/lib/ai/handler'
import { foodSpec } from '@/lib/ai/features/food'
import { budgetSpec } from '@/lib/ai/features/budget'
import { invitationSpec } from '@/lib/ai/features/invitation'
import { timelineSpec } from '@/lib/ai/features/timeline'
import { mergeCandidates, shoppingListSpec } from '@/lib/ai/features/shoppingList'

const live = process.env.AI_LIVE === '1' && !!process.env.AI_API_KEY
const cfg = readAIConfig({ ...process.env, AI_ENABLED: 'true', AI_PROVIDER: 'opencode' } as NodeJS.ProcessEnv)
const ctx: PartyAIContext = {
  childAge: 6, childInterests: ['dinosaurs', 'science'], partyDate: null, daysUntilParty: 18, city: 'Troy', state: 'MI', guestCountEstimate: 14, budget: 280,
  venue: { name: 'Backyard', type: 'home', booked: true }, theme: 'Dino Dig', durationMinutes: 120, indoorOutdoor: 'outdoor', foodPreferences: ['one child is gluten-free'],
  existingActivities: ['Fossil dig in the sandbox', 'Volcano experiment', 'Dino egg hunt'], existingChecklist: [{ title: 'Send invitations', done: false }],
  currentBudgetLines: [{ category: 'food', label: 'Pizza', amount: 70, actual: null }, { category: 'decorations', label: null, amount: 40, actual: 35 }, { category: 'activities', label: 'Fossil kits', amount: 60, actual: null }],
  existingShoppingItems: ['paper plates'], rsvp: { kids: 11, adults: 4, awaiting: 3, dietary: ['gluten-free'] }, partyStartTime: '13:00',
  activityPlan: [{ name: 'Fossil dig in the sandbox', min: 25, setting: 'outdoor', planned: true }, { name: 'Volcano experiment', min: 15, setting: 'outdoor', planned: true }, { name: 'Dino egg hunt', min: 20, setting: 'outdoor', planned: true }],
  timeline: [], menu: ['Pizza', 'Fruit cups', 'Dino cake'], savedVenueCount: 2, plan: 'PLUS',
  invitation: { childFirstName: 'Leo', venueName: 'our backyard', venueAddress: null, startTime: '13:00', endTime: '15:00' },
}
const shoppingExtra = mergeCandidates([
  { item: 'Paper plates', qty: '20', category: null, estimatedCost: 5, source: 'your list', onList: true },
  { item: 'baking soda', qty: '', category: 'activities', estimatedCost: 0, source: 'Volcano experiment', onList: false },
  { item: 'Vinegar', qty: '', category: 'activities', estimatedCost: 0, source: 'Volcano experiment', onList: false },
  { item: 'Plastic dinosaur skeleton kits', qty: '14', category: null, estimatedCost: 45, source: 'party plan', onList: false },
  { item: 'Green balloons', qty: '', category: 'decorations', estimatedCost: 0, source: 'theme', onList: false },
  { item: 'Gluten-free pizza', qty: '1', category: null, estimatedCost: 14, source: 'food plan', onList: false },
  { item: 'paper plate', qty: '', category: null, estimatedCost: 0, source: 'food plan', onList: false },
])
const log: { name: string; ms: number; out: number | null }[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run<R>(spec: FeatureSpec<any, R>, body: Record<string, unknown>, extra?: unknown): Promise<R | null> {
  const parsed = spec.body.parse({ partyId: '00000000-0000-4000-8000-000000000000', ...body })
  const { system, user } = spec.prompt({ body: parsed, ctx, notes: '', extra })
  const c = spec.long ? { ...cfg, timeoutMs: cfg.longTimeoutMs } : cfg
  const r = await callStructured({ feature: spec.feature, schema: spec.result, system, user, maxTokens: spec.maxTokens, sessionId: `live-plus-${Date.now()}-${spec.feature}`, cfg: c })
  log.push({ name: spec.feature, ms: r.durationMs, out: r.ok ? r.outputTokens : null })
  if (!r.ok) {
    console.log(spec.feature, 'FAILED', r.code, r.detail, r.durationMs, 'ms')
    return null
  }
  const out = spec.post ? spec.post({ result: r.data, body: parsed, ctx, scrubbed: r.scrubbed, extra }) : r.data
  console.log(`\n=== ${spec.feature} (${r.durationMs} ms, ${r.outputTokens} out tok)\n${JSON.stringify(out, null, 1).slice(0, 2500)}`)
  return out
}

describe.skipIf(!live)('Plus features on the real model (manual)', () => {
  it('food: menu for 11 kids + 4 adults with a gluten-free option, allergy note', async () => {
    const out = await run(foodSpec, { preferences: 'one child is gluten-free' })
    expect(out).not.toBeNull()
    expect(JSON.stringify(out)).toMatch(/gluten/i)
  })
  it('budget: uses the real lines, totals recomputed by the server', async () => {
    expect(await run(budgetSpec, {})).not.toBeNull()
  })
  it('invitation: names Leo, the backyard and the time; playful tone', async () => {
    const out = await run(invitationSpec, { tone: 'playful' })
    expect(out).not.toBeNull()
    expect(JSON.stringify(out)).toMatch(/Leo/)
  })
  it('timeline: two hours from 13:00, built from the planned activities', async () => {
    const out = await run(timelineSpec, {})
    expect(out).not.toBeNull()
    expect(JSON.stringify(out)).toMatch(/Fossil|Volcano|egg hunt/i)
  })
  it('shopping list: categorises only the merged items (no invented items)', async () => {
    const out = await run(shoppingListSpec, {}, shoppingExtra)
    expect(out).not.toBeNull()
    console.log('\nusage', JSON.stringify(log))
  })
})
