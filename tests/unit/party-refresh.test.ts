import { describe, expect, it } from 'vitest'
import { partyDetailsChanged, partyNow } from '@/lib/experience/model'

const party = { child_age: 7, guest_count: 12, budget: '250', theme: 'space', theme_details: { name: 'Space Adventure' } }

describe('"Refresh with your new party details" on reopened AI results', () => {
  it('derives the same party facts as the AI context (RSVPs raise the headcount; theme display name)', () => {
    expect(partyNow(party)).toEqual({ childAge: 7, guests: 12, budget: 250, theme: 'Space Adventure' })
    const yes = (child_count: number, adult_count: number) => ({ rsvp_status: 'CONFIRMED', child_count, adult_count })
    expect(partyNow(party, [yes(8, 3), yes(4, 2), { rsvp_status: 'DECLINED', child_count: 5, adult_count: 5 }]).guests).toBe(17)
    expect(partyNow({ ...party, theme: 'ai:abc', theme_details: null }).theme).toBeNull()
  })
  it('nothing changed → no notice; a plan restored from before a change → what changed', () => {
    const now = partyNow(party)
    expect(partyDetailsChanged({ childAge: 7, guestCount: 12, budget: 250, overrides: [] }, now)).toEqual([])
    expect(partyDetailsChanged({ childAge: 6, guestCount: 20, budget: 300, overrides: [] }, now)).toEqual(['age', 'guest count', 'budget'])
    expect(partyDetailsChanged({ guests: 12, budget: 250, theme: 'Dino Dig' }, now)).toEqual(['theme']) // party experience summary
  })
  it('ignores one-off planner overrides and small guest changes', () => {
    const now = partyNow(party)
    expect(partyDetailsChanged({ childAge: 7, guestCount: 30, budget: 500, overrides: ['guestCount', 'budget'] }, now)).toEqual([])
    expect(partyDetailsChanged({ childAge: 7, guestCount: 13, budget: 250, overrides: [] }, now)).toEqual([])
    expect(partyDetailsChanged(null, now)).toEqual([])
    expect(partyDetailsChanged({ childAge: 3 }, null)).toEqual([])
  })
})
