import { describe, expect, it } from 'vitest'
import {
  ActivityDetailSchema, activityColumns, activitySummary, clockAt, computeTimeline, costRange, effectiveGuests, guestDrift, offsetsToDurations, parseSupply, scaleQuantity,
  type TimelineRow,
} from '@/lib/experience/model'

const raw = {
  name: 'Cosmic Treasure Hunt', emoji: '🚀', description: 'Find hidden planets and solve clues.', category: 'Scavenger hunt',
  age_min: '8', age_max: 6, duration_minutes: '25 min', indoor_outdoor: 'Indoor', estimated_cost: '$12.50', difficulty: 'MEDIUM',
  materials: ['Glow sticks × 20', 'Small treasure bags (15)'], preparation_steps: ['Print clues'], instructions: ['Split into crews', 'Find planets'],
  host_script: 'Okay astronauts! Mission control has detected…', cleanup_level: 'low', safety_notes: [], extra: 'dropped',
}

describe('activity validation', () => {
  it('coerces loose model output into a strict activity (ages ordered, numbers parsed, enums normalised)', () => {
    const a = ActivityDetailSchema.parse(raw)
    expect(a).toMatchObject({ category: 'treasure_hunt', age_min: 6, age_max: 8, duration_minutes: 25, indoor_outdoor: 'indoor', estimated_cost: 12.5, difficulty: 'medium', cleanup_level: 'low', variations: [], backup_version: '' })
    expect('extra' in a).toBe(false)
  })
  it('rejects an activity without a name, description or instructions', () => {
    expect(ActivityDetailSchema.safeParse({ ...raw, name: '' }).success).toBe(false)
    expect(ActivityDetailSchema.safeParse({ ...raw, instructions: [] }).success).toBe(false)
    expect(ActivityDetailSchema.safeParse({ ...raw, description: undefined }).success).toBe(false)
  })
  it('maps to DB columns with long sections in details', () => {
    const c = activityColumns(ActivityDetailSchema.parse(raw))
    expect(c).toMatchObject({ name: 'Cosmic Treasure Hunt', duration_min: 25, setting: 'indoor', category: 'treasure_hunt', materials: ['Glow sticks × 20', 'Small treasure bags (15)'] })
    expect(c.details).toMatchObject({ emoji: '🚀', instructions: ['Split into crews', 'Find planets'], host_script: expect.stringMatching(/astronauts/) })
  })
})

describe('timeline', () => {
  const rows: TimelineRow[] = [
    { id: 't3', kind: 'food', label: 'Pizza', duration_min: 25, sort_order: 3, activity_id: null },
    { id: 't1', kind: 'arrival', label: 'Guests arrive', duration_min: null, sort_order: 1, activity_id: null },
    { id: 't2', kind: 'activity', label: 'Treasure hunt', duration_min: 99, sort_order: 2, activity_id: 'a1' },
  ]
  it('orders rows, uses the activity’s own duration and kind defaults, and formats clock times', () => {
    const t = computeTimeline(rows, (id) => (id === 'a1' ? 25 : null), '14:00')
    expect(t.rows.map((r) => [r.label, r.start, r.minutes, r.clock])).toEqual([['Guests arrive', 0, 15, '2:00 PM'], ['Treasure hunt', 15, 25, '2:15 PM'], ['Pizza', 40, 25, '2:40 PM']])
    expect(t.totalMinutes).toBe(65)
  })
  it('editing the activity’s duration moves everything after it', () => {
    expect(computeTimeline(rows, () => 40, '14:00').rows[2].clock).toBe('2:55 PM')
  })
  it('works without a start time (relative offsets) and across noon', () => {
    expect(clockAt(null, 75)).toBe('+1:15')
    expect(clockAt('11:30', 45)).toBe('12:15 PM')
    expect(clockAt('09:05', 0)).toBe('9:05 AM')
  })
  it('converts minute offsets from a schedule into durations', () => {
    expect(offsetsToDurations([{ minute: 15 }, { minute: 0 }, { minute: 50 }], 120).map((e) => e.duration)).toEqual([15, 35, 70])
  })
})

describe('guests, quantities, money', () => {
  it('effective guests: planned, unless confirmed RSVPs exceed it', () => {
    expect(effectiveGuests(15, { kids: 12, adults: 3 })).toBe(15)
    expect(effectiveGuests(15, { kids: 17, adults: 3 })).toBe(20)
    expect(effectiveGuests(0, { kids: 4, adults: 1 })).toBe(5)
    expect(effectiveGuests(null, null)).toBeNull()
  })
  it('guest drift needs a material change', () => {
    expect(guestDrift(15, 20)).toBe(true)
    expect(guestDrift(15, 16)).toBe(false)
    expect(guestDrift(30, 33)).toBe(false)
    expect(guestDrift(null, 20)).toBe(false)
  })
  it('scales quantities up and down in whole units', () => {
    expect(scaleQuantity(15, 15, 20)).toBe(20)
    expect(scaleQuantity(30, 15, 20)).toBe(40)
    expect(scaleQuantity(1, 15, 5)).toBe(1)
    expect(scaleQuantity(4, 0, 20)).toBe(4)
  })
  it('parses supply lines into item + quantity', () => {
    expect(parseSupply('Glow sticks × 20')).toEqual({ item: 'Glow sticks', qty: '20' })
    expect(parseSupply('small treasure bags (15)')).toEqual({ item: 'Small treasure bags', qty: '15' })
    expect(parseSupply('2 packs of paint pens')).toEqual({ item: 'Paint pens', qty: '2 packs' })
    expect(parseSupply('Tape')).toEqual({ item: 'Tape', qty: null })
  })
  it('summaries count planned activities only; costs are shown as estimate ranges', () => {
    expect(activitySummary([{ status: 'planned', duration_min: 25, estimated_cost: '12.50' }, { status: 'planned', duration_min: 55, estimated_cost: 10 }, { status: 'idea', duration_min: 30, estimated_cost: 99 }])).toEqual({ planned: 2, ideas: 1, minutes: 80, estimatedCost: 22.5 })
    expect(costRange(12)).toBe('$10–14')
    expect(costRange(0)).toBe('Free')
    expect(costRange(6)).toBe('~$6')
  })
})
