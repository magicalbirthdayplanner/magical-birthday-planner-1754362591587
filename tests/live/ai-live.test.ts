/**
 * MANUAL live check against the real provider (golden scenarios). Skipped unless AI_LIVE=1 and AI_API_KEY are set.
 * Validates that the real model passes our schemas and that server post-processing holds. Never runs in CI.
 */
import { describe, expect, it } from 'vitest'
import { readAIConfig } from '@/lib/ai/config'
import { callStructured } from '@/lib/ai/client'
import type { PartyAIContext } from '@/lib/ai/context'
import { partyPlannerPrompt } from '@/lib/ai/prompts/partyPlanner'
import { PartyPlanAIResultSchema } from '@/lib/ai/schemas/partyPlanner'
import { postProcessPlan } from '@/lib/ai/features/partyPlanner'
import type { PartyPlanModelOutput } from '@/lib/ai/schemas/partyPlanner'
import type { ChecklistModelOutput } from '@/lib/ai/schemas/checklist'
import type { ThemeIdeasModelOutput } from '@/lib/ai/schemas/themeIdeas'
import { checklistPrompt } from '@/lib/ai/prompts/checklist'
import { ChecklistAISchema } from '@/lib/ai/schemas/checklist'
import { postProcessChecklist } from '@/lib/ai/features/checklist'
import { themeIdeasPrompt } from '@/lib/ai/prompts/themeIdeas'
import { ThemeIdeasSchema } from '@/lib/ai/schemas/themeIdeas'

const live = process.env.AI_LIVE === '1' && !!process.env.AI_API_KEY
const cfg = readAIConfig({ ...process.env, AI_ENABLED: 'true', AI_PROVIDER: 'opencode' } as NodeJS.ProcessEnv)
const base: PartyAIContext = { childAge: 7, childInterests: ['art', 'animals'], partyDate: null, daysUntilParty: 30, city: 'Troy', state: 'MI', guestCountEstimate: 12, budget: 250, venue: null, theme: null, durationMinutes: 120, indoorOutdoor: 'indoor', foodPreferences: [], existingActivities: [], existingChecklist: [], currentBudgetLines: [], plan: 'PLUS' }

describe.skipIf(!live)('live model (manual)', () => {
  it('golden A: planner → valid plan, ≤ $250 after server recompute, no named artist', async () => {
    const p = partyPlannerPrompt(base, {}, 'My daughter is turning 7. She loves art, animals and Taylor Swift. About 12 kids, $250, indoors, October.')
    const r = await callStructured({ feature: 'party_planner', schema: PartyPlanAIResultSchema, ...p, sessionId: `live-${Date.now()}-a`, cfg })
    console.log('golden A:', JSON.stringify({ ok: r.ok, attempts: r.attempts, ms: r.durationMs, tokens: r.ok ? [r.inputTokens, r.outputTokens] : null, code: r.ok ? null : r.code }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const plan = postProcessPlan(r.data as unknown as PartyPlanModelOutput, { budget: 250, durationMinutes: 120, scrubbed: r.scrubbed })
    console.log('  theme:', plan.theme.name, '| activities:', plan.activities.map((a) => a.name).join(' / '), '| total:', plan.budget.total, 'overBy:', plan.budget.overBy, '| timeline:', plan.timeline.map((t) => t.time).join(','))
    expect(plan.activities.length).toBeGreaterThanOrEqual(3)
    expect(JSON.stringify(plan)).not.toMatch(/taylor swift|swiftie/i)
    expect(plan.budget.total).toBeLessThanOrEqual(250)
  })
  it('golden B: checklist → compressed, no venue/activity booking, dates handled by server', async () => {
    const ctx: PartyAIContext = { ...base, childAge: 10, daysUntilParty: 8, partyDate: new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10), guestCountEstimate: 15, theme: 'Royal Ball', venue: { name: 'Little Picasso Art Studio', type: 'Art studio', booked: true }, existingChecklist: [{ title: 'Order the cake', done: false }] }
    const p = checklistPrompt(ctx, '')
    const r = await callStructured({ feature: 'checklist', schema: ChecklistAISchema, ...p, sessionId: `live-${Date.now()}-b`, cfg })
    console.log('golden B:', JSON.stringify({ ok: r.ok, attempts: r.attempts, ms: r.durationMs, code: r.ok ? null : r.code }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const out = postProcessChecklist(r.data as unknown as ChecklistModelOutput, ctx, r.scrubbed)
    console.log('  tasks:', out.tasks.map((t) => `${t.dueDate}${t.late ? '!' : ''} ${t.title}`).join(' | '), '| skipped:', out.skipped)
    expect(out.tasks.some((t) => /book.*venue/i.test(t.title))).toBe(false)
  })
  it('theme ideas → 5 generic themes', async () => {
    const r = await callStructured({ feature: 'theme_ideas', schema: ThemeIdeasSchema, ...themeIdeasPrompt(base, ''), sessionId: `live-${Date.now()}-t`, cfg })
    console.log('themes:', JSON.stringify({ ok: r.ok, attempts: r.attempts, ms: r.durationMs }), r.ok ? (r.data as unknown as ThemeIdeasModelOutput).themes.map((t) => `${t.emoji} ${t.name}`).join(' / ') : '')
    expect(r.ok).toBe(true)
  })
})
