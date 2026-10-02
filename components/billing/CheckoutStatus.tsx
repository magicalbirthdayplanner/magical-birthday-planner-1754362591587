'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { apiFetch } from '@/lib/data/api'

type State = { phase: 'checking' | 'active' | 'pending' | 'failed'; plan?: string }

/**
 * Shows the SERVER's view of the purchase after returning from Dodo. The plan is
 * only ever activated by the verified webhook; this just polls for it.
 */
export function CheckoutStatus({ providerStatus }: { providerStatus: string | null }) {
  const [state, setState] = useState<State>({ phase: providerStatus === 'failed' || providerStatus === 'cancelled' ? 'failed' : 'checking' })

  useEffect(() => {
    if (state.phase === 'failed') return
    let stopped = false
    let tries = 0
    const tick = async () => {
      tries++
      try {
        const s = await apiFetch<{ plan: string; purchases: { status: string; plan: string }[] }>('/api/billing/status')
        const paid = s.purchases.find((p) => p.status === 'active')
        if (paid) return !stopped && setState({ phase: 'active', plan: paid.plan })
        if (s.purchases.find((p) => p.status === 'failed')) return !stopped && setState({ phase: 'failed' })
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
  }, [state.phase])

  const map = {
    checking: { icon: Clock, title: 'Confirming your payment…', body: 'This usually takes a few seconds.' },
    active: { icon: CheckCircle2, title: `Your ${state.plan ?? ''} plan is active`, body: 'Thanks! Everything is unlocked.' },
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
