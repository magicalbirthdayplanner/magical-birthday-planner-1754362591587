'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PartyPopper } from 'lucide-react'
import { CheckoutStatus } from '@/components/billing/CheckoutStatus'
import { safeNext } from '@/lib/security/redirect'

/**
 * Return page after Dodo's hosted checkout. URL parameters are NOT proof of payment:
 * the plan is granted only by the signed Dodo webhook, and CheckoutStatus just polls
 * the server-derived status (/api/billing/status).
 */
function CheckoutResult() {
  const params = useSearchParams()
  const next = safeNext(params.get('return_url'), '/home')
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <PartyPopper className="h-8 w-8" />
      </div>
      <h1 className="font-display text-3xl font-extrabold">Thanks for your order!</h1>
      <div className="mt-4 w-full">
        <CheckoutStatus providerStatus={params.get('status')} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Your plan activates as soon as our payment provider confirms the payment — usually within a minute.</p>
      <div className="mt-6 flex w-full flex-col gap-3">
        <Link href={next} className="tap flex min-h-[48px] items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground">
          Continue planning
        </Link>
        <Link href="/more" className="tap flex min-h-[48px] items-center justify-center rounded-full border border-border px-6 font-semibold">
          View my plan
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Need help with a payment? Reply to the receipt email from our payment provider.</p>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
      <CheckoutResult />
    </Suspense>
  )
}
