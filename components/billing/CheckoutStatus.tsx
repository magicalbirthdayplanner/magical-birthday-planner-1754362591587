'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { apiFetch } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'

type State = { phase: 'checking' | 'active' | 'pending' | 'failed'; plan?: string; childName?: string | null }
type Status = { plan: string; purchases: { status: string; plan: string }[]; checkout: { plan: string; status: string; childName: string | null } | null }

/**
 * Shows the SERVER's view of the purchase after returning from Dodo. The plan is
 * only ever activated by the verified webhook; this just polls for it. With the checkout
 * reference it reports THAT purchase and the party it was for (plans are bought per party).
 */
export function CheckoutStatus({ providerStatus, checkoutRef }: { providerStatus: string | null; checkoutRef?: string | null }) {
  const [state, setState] = useState<State>({ phase: providerStatus === 'failed' || providerStatus === 'cancelled' ? 'failed' : 'checking' })

  useEffect(() => {
    if (state.phase === 'failed') return
    let stopped = false
    let tries = 0
    const tick = async () => {
      tries++
      try {
        const s = await apiFetch<Status>(`/api/billing/status${checkoutRef ? `?checkout=${encodeURIComponent(checkoutRef)}` : ''}`)
        if (s.checkout) {
          if (s.checkout.status === 'completed') {
            if (!stopped) track('purchase_completed', { plan: s.checkout.plan })
            return !stopped && setState({ phase: 'active', plan: s.checkout.plan, childName: s.checkout.childName })
          }
          if (s.checkout.status === 'failed') return !stopped && setState({ phase: 'failed' })
        }
        const paid = checkoutRef ? undefined : s.purchases.find((p) => p.status === 'active')
        if (paid) {
          if (!stopped) track('purchase_completed', { plan: paid.plan })
          return !stopped && setState({ phase: 'active', plan: paid.plan })
        }
        if (!checkoutRef && s.purchases.find((p) => p.status === 'failed')) return !stopped && setState({ phase: 'failed' })
      } catch {
        /* keep polling */
      }
      if (tries >= 20) return !stopped && setState({ phase: 'pending' })
      if (!stopped) setTimeout(tick, 3000)
    }
    void tick()
    return () => {
      stopped = true
    }
  }, [state.phase, checkoutRef])

  const map = {
    checking: { icon: Clock, title: 'Confirming your payment…', body: 'This usually takes a few seconds.' },
    active: {
      icon: CheckCircle2,
      title: `Your ${state.plan ?? ''} plan is active${state.childName ? ` for ${state.childName.split(' ')[0]}’s party` : ''}`,
      body: state.childName ? 'Thanks! Everything in this plan is unlocked for this party.' : 'Thanks! Everything in this plan is unlocked.',
    },
    pending: { icon: Clock, title: 'Payment received — still confirming', body: 'Your plan will unlock automatically as soon as our payment provider confirms it. You can keep planning meanwhile.' },
    failed: { icon: XCircle, title: 'Payment didn’t go through', body: 'You haven’t been charged for a plan. You can try again from the pricing page.' },
  }[state.phase]
  const Icon = map.icon
  return (
    <div role="status" aria-live="polite" data-testid="checkout-status" data-phase={state.phase} className="mb-6 rounded-lg bg-white/80 p-4 text-left dark:bg-slate-800/80">
      <p className="flex items-center gap-2 font-semibold">
        <Icon className="h-5 w-5" /> {map.title}
      </p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{map.body}</p>
    </div>
  )
}
