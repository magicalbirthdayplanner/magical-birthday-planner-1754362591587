'use client'
import { useEffect } from 'react'
import { setAnalyticsMarket, track } from '@/lib/analytics/client'
import { usePlanPrices } from '@/components/billing/usePlanPrices'
import { useCampaign } from '@/components/billing/useCampaign'

/** Counts the visit toward the India market (a country code only — visiting /in is the signal, not an IP lookup). */
export function IndiaLandingTracker() {
  useEffect(() => {
    setAnalyticsMarket('IN')
    track('landing_page_view', { page: 'in' })
  }, [])
  return null
}

/** INR prices once Razorpay is live with approved prices; until then an honest "coming soon". */
export function IndiaPricingNote() {
  const prices = usePlanPrices('IN')
  const { campaign, until } = useCampaign()
  if (campaign) {
    return (
      <p className="mx-auto mt-4 max-w-md rounded-2xl bg-secondary px-4 py-3 text-sm" data-testid="india-pricing-note">
        Launch offer: <strong>every plan is free until {until}</strong> — guests &amp; RSVP and every AI feature, no card needed.
      </p>
    )
  }
  if (prices.loading) return null
  return (
    <p className="mx-auto mt-4 max-w-md rounded-2xl bg-secondary px-4 py-3 text-sm" data-testid="india-pricing-note">
      {prices.available ? `Paid plans from ${prices.label('STARTER')} per party, paid in rupees with Razorpay. No subscription.` : 'Paid plans in rupees are coming soon. Everything in Free works today.'}
    </p>
  )
}
