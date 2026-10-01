import { describe, expect, it } from 'vitest'
import { ANALYTICS_EVENTS, isAnalyticsEvent, sanitizeProps } from '@/lib/analytics/events'

describe('analytics events', () => {
  it('includes every event required by the product spec', () => {
    for (const e of ['app_open', 'onboarding_started', 'party_created', 'zip_entered', 'venue_search_started', 'venue_search_completed',
      'venue_viewed', 'venue_saved', 'venue_removed', 'map_opened', 'filter_used', 'theme_viewed', 'theme_selected', 'guest_added',
      'invitation_shared', 'checklist_completed', 'party_completed']) {
      expect(ANALYTICS_EVENTS).toContain(e)
    }
    expect(isAnalyticsEvent('drop_table')).toBe(false)
  })

  it('strips PII-looking keys and oversized values', () => {
    const out = sanitizeProps({ email: 'a@b.c', childName: 'Ava', zip: '48084', radius: 20, ok: true, 'bad key': 1, long: 'x'.repeat(500), list: ['a', 1, 'b'] })
    expect(out).toEqual({ zip: '48084', radius: 20, ok: true, long: 'x'.repeat(120), list: ['a', 'b'] })
  })
})
