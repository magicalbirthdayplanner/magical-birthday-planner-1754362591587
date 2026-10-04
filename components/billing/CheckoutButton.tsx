'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError, apiFetch, friendlyError } from '@/lib/data/api'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics/client'

/**
 * Starts a server-created Dodo checkout for the signed-in user and ONE party (plans are bought per party). The
 * browser only names the plan and the party; product, price and customer are decided by the server, the party must
 * be the user's, and the plan is granted only by the verified payment webhook.
 */
export function CheckoutButton({ plan, partyId, className, children }: { plan: 'STARTER' | 'PLUS' | 'PRO'; partyId?: string | null; className?: string; children: ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function go() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    if (!partyId) {
      router.push('/start')
      return
    }
    track('plan_upgrade_clicked', { plan, from: typeof window !== 'undefined' ? window.location.pathname : '' })
    setBusy(true)
    try {
      const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan, partyId }) })
      track('checkout_started', { plan })
      window.location.assign(checkoutUrl)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(window.location.pathname)}&expired=1`)
      else toast.error(friendlyError(e, 'We couldn’t start checkout. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={go} disabled={busy} className={cn('inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60', className)} data-testid={`checkout-${plan}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}
