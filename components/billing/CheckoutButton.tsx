'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError, apiFetch, friendlyError } from '@/lib/data/api'
import { cn } from '@/lib/utils'

/**
 * Starts a server-created Dodo checkout for the signed-in user. The browser only
 * names the plan; product, price and customer are decided by the server, and the
 * plan is granted only by the verified payment webhook.
 */
export function CheckoutButton({ plan, className, children }: { plan: 'STARTER' | 'PLUS' | 'PRO'; className?: string; children: ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function go() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    setBusy(true)
    try {
      const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) })
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
