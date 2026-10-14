/**
 * India in the app: wizard validation, guest phone numbers, AI amounts in rupees, ad-pixel currency, cost ranges.
 */
import { describe, expect, it, vi } from 'vitest'

// lib/data/guests talks to Supabase from the browser; only its pure helpers are tested here.
vi.mock('@/lib/db/browser', () => ({ db: {} }))
import { EMPTY_DRAFT, parseDraft, validateStep } from '@/lib/planning/wizard'
import { guestPhone, validateGuest } from '@/lib/data/guests'
import { BudgetLineSchema, ShoppingItemSchema } from '@/lib/ai/schemas/partyPlanner'
import { runWithMoneyScale } from '@/lib/ai/money-scale'
import { pixelCallsFor } from '@/lib/analytics/meta-pixel'
import { costRange } from '@/lib/experience/model'
import { postProcessPlan } from '@/lib/ai/features/partyPlanner'
import { isAnalyticsEvent, sanitizeProps } from '@/lib/analytics/events'

const today = '2026-10-14'
const india = {
  ...EMPTY_DRAFT,
  childName: 'Aarav',
  childAge: 7,
  partyDate: '2026-11-14',
  country: 'IN' as const,
  zip: '560001',
  zipPlace: { city: 'Bengaluru', state: 'Karnataka', lat: 12.97, lng: 77.6 },
  guestCount: 25,
  budget: 25000,
}

describe('wizard for an India party', () => {
  it('accepts a 6-digit PIN and a rupee budget above the US cap', () => {
    for (const s of ['zip', 'budget'] as const) expect(validateStep(s, india, today), s).toBeNull()
    expect(validateStep('budget', { ...india, budget: 250000 }, today)).toBeNull()
    expect(validateStep('budget', { ...india, country: 'US', budget: 250000 }, today)).not.toBeNull()
  })
  it('rejects a US ZIP for India and a PIN for the US, with the right message', () => {
    expect(validateStep('zip', { ...india, zip: '48084' }, today)).toMatch(/6-digit PIN/)
    expect(validateStep('zip', { ...india, country: 'US' }, today)).toMatch(/5-digit US ZIP/)
    expect(validateStep('zip', { ...india, zipPlace: null }, today)).toMatch(/find that PIN/)
  })
  it('drafts remember the event country; older drafts are US parties', () => {
    expect(parseDraft(JSON.stringify(india))?.country).toBe('IN')
    expect(parseDraft(JSON.stringify({ ...india, country: undefined }))?.country).toBe('US')
    expect(parseDraft(JSON.stringify({ ...india, country: 'XX' }))?.country).toBe('US')
  })
})

describe('guest phone numbers', () => {
  const existing = [{ id: 'g1', name: 'The Patels', phone: '+919876543210' }]
  it('validates for the party’s country and stores E.164', () => {
    expect(validateGuest({ name: 'The Iyers', phone: '98450 12345' }, { country: 'IN', existing })).toBeNull()
    expect(guestPhone('98450 12345', 'IN')).toBe('+919845012345')
    expect(guestPhone('(248) 555-0100', 'US')).toBe('+12485550100')
    expect(guestPhone('  ', 'IN')).toBeNull()
    expect(validateGuest({ name: 'X', phone: '12345' }, { country: 'IN', existing })).toMatch(/10 digits/)
  })
  it('one phone number = one guest within a party (editing yourself is fine)', () => {
    expect(validateGuest({ name: 'Dup', phone: '098765 43210' }, { country: 'IN', existing })).toMatch(/The Patels already has this phone number/)
    expect(validateGuest({ name: 'The Patels', phone: '+91 98765 43210' }, { country: 'IN', existing, selfId: 'g1' })).toBeNull()
  })
  it('without options the old checks are unchanged (phone optional, free text)', () => {
    expect(validateGuest({ name: 'A', phone: 'call after 5' })).toBeNull()
  })
})

describe('AI amounts in the party currency', () => {
  it('US caps are unchanged; India caps scale so ₹ estimates are not clamped', async () => {
    expect(BudgetLineSchema.parse({ category: 'Venue', amount: 15000 }).amount).toBe(10000) // US: clamp as before
    const inr = await runWithMoneyScale(100, async () => BudgetLineSchema.parse({ category: 'Venue', amount: 15000 }).amount)
    expect(inr).toBe(15000)
  })
  it('understands rupee-formatted strings from the model', async () => {
    const parsed = await runWithMoneyScale(100, async () => ShoppingItemSchema.parse({ item: 'Cake', qty: '1', category: 'food', estimatedCost: '₹1,200' }))
    expect(parsed.estimatedCost).toBe(1200)
    expect(ShoppingItemSchema.parse({ item: 'Cake', qty: '1', category: 'food', estimatedCost: 'Rs. 800' }).estimatedCost).toBe(800)
    expect(ShoppingItemSchema.parse({ item: 'Cake', qty: '1', category: 'food', estimatedCost: '$25' }).estimatedCost).toBe(25)
  })
  it('server-written budget notes use the party currency', () => {
    const plan = postProcessPlan({ summary: 's', theme: { name: 'T' }, activities: [], shoppingList: [], budget: { lines: [{ category: 'Venue', amount: 30000 }] }, timeline: [], assumptions: [] } as never, { budget: 25000, durationMinutes: 120, scrubbed: false, country: 'IN' })
    expect(plan.assumptions.join(' ')).toContain('about ₹30,000, which is ₹5,000 over your ₹25,000 budget')
    const us = postProcessPlan({ summary: 's', theme: { name: 'T' }, activities: [], shoppingList: [], budget: { lines: [{ category: 'Venue', amount: 300 }] }, timeline: [], assumptions: [] } as never, { budget: 250, durationMinutes: 120, scrubbed: false })
    expect(us.assumptions.join(' ')).toContain('about $300, which is $50 over your $250 budget')
  })
  it('cost ranges', () => {
    expect(costRange(100)).toBe('$85–115')
    expect(costRange(1000, 'IN')).toBe('₹850–1,150')
    expect(costRange(0, 'IN')).toBe('Free')
  })
})

describe('analytics', () => {
  it('market events exist and props never carry phone/address keys', () => {
    for (const e of ['country_selected', 'whatsapp_share_initiated', 'invitation_created', 'payment_failed']) expect(isAnalyticsEvent(e)).toBe(true)
    expect(sanitizeProps({ market: 'IN', country: 'IN', phone: '+919876543210', address: 'x', guestName: 'y' })).toEqual({ market: 'IN', country: 'IN' })
  })
  it('Meta pixel reports an India checkout in INR from the server amount; US unchanged', () => {
    expect(pixelCallsFor('checkout_started', { plan: 'STARTER', currency: 'INR', amount_minor: 49900 }, false)).toEqual([{ kind: 'track', name: 'InitiateCheckout', params: { currency: 'INR', value: 499 } }])
    expect(pixelCallsFor('purchase_completed', { plan: 'PRO' }, false)).toEqual([{ kind: 'track', name: 'Purchase', params: { currency: 'USD', value: 29.99 } }])
  })
})
