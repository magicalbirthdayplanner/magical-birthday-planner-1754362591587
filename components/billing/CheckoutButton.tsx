'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError, apiFetch, friendlyError } from '@/lib/data/api'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics/client'
import { payWithRazorpay, type RazorpayOrderInfo } from '@/lib/billing/razorpay-checkout'

/**
 * Starts a server-created checkout (Dodo hosted checkout for US parties; Razorpay Checkout for India parties) for the signed-in user and ONE party (plans are bought per party). The
 * browser only names the plan and the party; product, price and customer are decided by the server, the party must
 * be the user's, and the plan is granted only by the verified payment webhook.
 */
export function CheckoutButton({ plan, partyId, className, children }: { plan: 'STARTER' | 'PLUS' | 'PRO'; partyId?: string | null; className?: string; children: ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  // Inline as well as a toast: public pages (pricing) have no toaster.
  const [note, setNote] = useState<string | null>(null)

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
    setNote(null)
    setBusy(true)
    try {
      const res = await apiFetch<{ checkoutUrl?: string; provider?: 'razorpay'; checkoutId?: string; razorpay?: RazorpayOrderInfo }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan, partyId }) })
      if (res.provider === 'razorpay' && res.razorpay && res.checkoutId) {
        // India: Razorpay Checkout opens on this page for the server-created order.
        track('checkout_started', { plan, provider: 'razorpay', currency: res.razorpay.currency, amount_minor: res.razorpay.amount })
        const r = await payWithRazorpay(res.checkoutId, res.razorpay, (reason) => track('payment_failed', { plan, provider: 'razorpay', reason }))
        if (r.kind === 'verified') {
          router.push(`/checkout-success?ref=${encodeURIComponent(r.checkoutId)}${r.status === 'failed' ? '&status=failed' : ''}`)
          return
        }
        const msg = r.kind === 'dismissed' ? 'Checkout closed — you haven’t been charged.' : 'We couldn’t open the payment window. Please try again.'
        toast(msg)
        setNote(msg)
        setBusy(false)
        return
      }
      track('checkout_started', { plan })
      window.location.assign(res.checkoutUrl!)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(window.location.pathname)}&expired=1`)
      else {
        const msg = friendlyError(e, 'We couldn’t start checkout. Please try again.')
        toast.error(msg)
        setNote(msg)
      }
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={go} disabled={busy} className={cn('inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60', className)} data-testid={`checkout-${plan}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
      {note ? <p role="status" className="mt-2 text-center text-sm text-muted-foreground" data-testid={`checkout-note-${plan}`}>{note}</p> : null}
    </>
  )
}
