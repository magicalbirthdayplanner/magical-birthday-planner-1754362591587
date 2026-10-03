/**
 * MANUAL live check of the Party Experience features on the real model (AI_LIVE=1 + AI_API_KEY). Uses each feature's
 * real prompt, schema, output cap and timeout. Never runs in CI.
 */
import { describe, expect, it } from 'vitest'
import { readAIConfig } from '@/lib/ai/config'
import type { z } from 'zod'
import { callStructured, type StructuredResult } from '@/lib/ai/client'
import type { PartyAIContext } from '@/lib/ai/context'
import { activityCreatePrompt, activityEditPrompt, hostPrompt, partyExperiencePrompt } from '@/lib/ai/prompts/experience'
import { activityStudioSpec, ActivityStudioAISchema } from '@/lib/ai/features/activityStudio'
import { HostAISchema, hostSpec } from '@/lib/ai/features/hostContent'
import { ExperienceAISchema, experienceSpec, postProcessExperience } from '@/lib/ai/features/partyExperience'
import { foodSpec, postProcessFood } from '@/lib/ai/features/food'
import { foodHeadcount, foodPrompt } from '@/lib/ai/prompts/food'
import { FoodAISchema } from '@/lib/ai/schemas/food'
import { ACTIVITY_EDITS } from '@/lib/experience/model'

const live = process.env.AI_LIVE === '1' && !!process.env.AI_API_KEY
const cfg = readAIConfig({ ...process.env, AI_ENABLED: 'true', AI_PROVIDER: 'opencode' } as NodeJS.ProcessEnv)
const space: PartyAIContext = {
  childAge: 7, childInterests: ['science', 'art'], partyDate: null, daysUntilParty: 21, city: 'Troy', state: 'MI', guestCountEstimate: 15, budget: 200, venue: null, theme: 'Space',
  durationMinutes: 120, indoorOutdoor: 'indoor', foodPreferences: [], existingActivities: [], existingChecklist: [], currentBudgetLines: [], existingShoppingItems: [],
  rsvp: { kids: 12, adults: 3, awaiting: 0, dietary: ['vegetarian'] }, partyStartTime: '14:00', activityPlan: [], timeline: [], menu: [], savedVenueCount: 0, plan: 'PRO',
  invitation: { childFirstName: 'Mia', venueName: null, venueAddress: null, startTime: '14:00', endTime: '16:00' },
}
const log: { name: string; ms: number; attempts: number; out: number | null }[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = async (name: string, schema: z.ZodType<any>, p: { system: string; user: string }, spec: { maxTokens?: number; long?: boolean }): Promise<StructuredResult<any>> => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const c = spec.long ? { ...cfg, timeoutMs: cfg.longTimeoutMs } : cfg
  const r = await callStructured({ feature: name, schema, ...p, maxTokens: spec.maxTokens, sessionId: `live-exp-${Date.now()}-${name}`, cfg: c })
  log.push({ name, ms: r.durationMs, attempts: r.attempts, out: r.ok ? r.outputTokens : null })
  if (!r.ok) console.log(name, 'FAILED', r.code, r.detail, r.durationMs, 'ms')
  return r
}

describe.skipIf(!live)('party experience on the real model (manual)', () => {
  let created: unknown
  it('activity studio: create from a parent request, using party context', async () => {
    const r = await run('activity_studio', ActivityStudioAISchema, activityCreatePrompt(space, 'I want a fun space game for 15 kids that takes about 20 minutes and doesn’t make a mess.'), activityStudioSpec)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const a = r.data.activity
    created = a
    console.log(`create (${r.durationMs} ms, ${r.outputTokens} tok): ${a.emoji} ${a.name} | ${a.duration_minutes} min ${a.indoor_outdoor} ages ${a.age_min}-${a.age_max} $${a.estimated_cost} cleanup ${a.cleanup_level}\n  materials: ${a.materials.join('; ')}\n  script: ${a.host_script}`)
    expect(a.duration_minutes).toBeGreaterThanOrEqual(10)
    expect(a.duration_minutes).toBeLessThanOrEqual(35)
    expect(['none', 'low']).toContain(a.cleanup_level)
    expect(a.instructions.length).toBeGreaterThan(1)
  }, 120_000)
  it('activity studio: "make it cheaper" keeps the idea and lowers the cost', async () => {
    if (!created) return
    const r = await run('activity_studio', ActivityStudioAISchema, activityEditPrompt(space, created, ACTIVITY_EDITS.cheaper, ''), activityStudioSpec)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const before = created as { name: string; estimated_cost: number }
    console.log(`cheaper (${r.durationMs} ms): ${r.data.activity.name} $${before.estimated_cost} → $${r.data.activity.estimated_cost} | ${r.data.what_changed}`)
    expect(r.data.activity.estimated_cost).toBeLessThanOrEqual(before.estimated_cost)
  }, 120_000)
  it('host: welcome speech with the child’s first name; thank-yous per guest', async () => {
    const w = await run('host_content', HostAISchema, hostPrompt(space, 'welcome', 'playful', {}, ''), hostSpec)
    expect(w.ok).toBe(true)
    if (w.ok) console.log(`welcome (${w.durationMs} ms): ${w.data.title} — ${w.data.body}`)
    const t = await run('host_content', HostAISchema, hostPrompt(space, 'thank_you_guest', 'warm', { guests: ['Emma', 'Leo', 'Ava'] }, ''), hostSpec)
    expect(t.ok).toBe(true)
    if (!t.ok) return
    console.log(`thank-yous (${t.durationMs} ms): ${t.data.messages.map((m) => `#${m.guest} ${m.body}`).join(' | ')}`)
    expect(t.data.messages.length).toBe(3)
  }, 180_000)
  it('food: quantities for 12 kids + 3 adults with a vegetarian option', async () => {
    const r = await run('food', FoodAISchema, foodPrompt(space, '', ''), foodSpec)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const f = postProcessFood(r.data, foodHeadcount(space))
    console.log(`food (${r.durationMs} ms, ${r.outputTokens} tok) for ${f.kids} kids/${f.adults} adults: ${f.items.map((d) => `${d.quantity} ${d.unit} ${d.name}${d.dietary_tags.length ? ` [${d.dietary_tags.join('/')}]` : ''}`).join(' | ')} | ~$${f.estimatedTotal}`)
    expect(JSON.stringify(f.items)).toMatch(/vegetarian/i)
  }, 120_000)
  it('create my party experience: all sections within the time budget', async () => {
    const r = await run('party_experience', ExperienceAISchema, partyExperiencePrompt({ ...space, theme: null }, 'My daughter is turning 7. She loves space and painting, but I don’t want a typical space party. We have 15 kids, 2 hours, a $200 budget, and the party is at home. Nothing too messy.'), experienceSpec)
    console.log(`experience: ${r.durationMs} ms, attempts ${r.attempts}, ${r.ok ? r.outputTokens : r.code} tok`)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const x = postProcessExperience(r.data, { budget: 200, durationMinutes: 120, partyDate: null, guests: 15, scrubbed: r.scrubbed })
    console.log(`  theme: ${x.theme.name} | activities: ${x.activities.map((a) => `${a.name} (${a.duration_minutes}m)`).join(', ')}\n  timeline: ${x.timeline.map((t) => `${t.minute}:${t.label}`).join(' / ')}\n  food: ${x.food.map((f) => `${f.quantity} ${f.unit} ${f.name}`).join(', ')}\n  host welcome: ${x.host[0]?.body}\n  budget $${x.budget.total}${x.budget.overBy ? ` OVER ${x.budget.overBy}` : ''}`)
    expect(x.activities.length).toBeGreaterThanOrEqual(2)
    expect(x.timeline.length).toBeGreaterThanOrEqual(4)
    expect(x.host.length).toBeGreaterThanOrEqual(2)
    expect(r.durationMs).toBeLessThan(55_000)
    console.log('USAGE', JSON.stringify(log))
  }, 120_000)
})
