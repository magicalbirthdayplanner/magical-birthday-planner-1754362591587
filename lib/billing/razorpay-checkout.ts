'use client'
/**
 * Browser side of Razorpay Standard Checkout: load checkout.js, open it for OUR server-created order, and hand the
 * handler response to /api/billing/razorpay/verify. The browser decides nothing: the server verifies the signature,
 * fetches the payment from Razorpay and only then records it.
 */
import { apiFetch } from '@/lib/data/api'

export interface RazorpayOrderInfo {
  keyId: string
  orderId: string
  amount: number
  currency: string
  name: string
  description: string
  prefill: { email: string; name: string }
}

interface RazorpayInstance {
  open(): void
  on(event: 'payment.failed', cb: (r: { error?: { code?: string; reason?: string } }) => void): void
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance

/** Official script; a test build may point at the mock server instead (never set in production). */
const SCRIPT = process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL || 'https://checkout.razorpay.com/v1/checkout.js'

let loading: Promise<RazorpayCtor> | null = null
function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor }
  if (w.Razorpay) return Promise.resolve(w.Razorpay)
  loading ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Razorpay unavailable')))
    s.onerror = () => {
      loading = null
      reject(new Error('Razorpay unavailable'))
    }
    document.head.appendChild(s)
  })
  return loading
}

export type RazorpayResult =
  | { kind: 'verified'; status: 'active' | 'pending' | 'failed'; checkoutId: string }
  | { kind: 'dismissed' }
  | { kind: 'failed'; reason: string }

/** Opens Checkout; resolves once the parent pays (and the server verified it), closes it, or it can't load. */
export async function payWithRazorpay(checkoutId: string, order: RazorpayOrderInfo, onFailedAttempt?: (reason: string) => void): Promise<RazorpayResult> {
  let Razorpay: RazorpayCtor
  try {
    Razorpay = await loadRazorpay()
  } catch {
    return { kind: 'failed', reason: 'script_unavailable' }
  }
  return new Promise<RazorpayResult>((resolve) => {
    let settled = false
    const done = (r: RazorpayResult) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: order.name,
      description: order.description,
      prefill: { email: order.prefill.email, name: order.prefill.name },
      theme: { color: '#6d3fd1' },
      modal: { ondismiss: () => done({ kind: 'dismissed' }) },
      handler: async (r: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
        try {
          const v = await apiFetch<{ status: 'active' | 'pending' | 'failed'; checkoutId: string }>('/api/billing/razorpay/verify', {
            method: 'POST',
            body: JSON.stringify({ checkoutId, razorpay_order_id: r.razorpay_order_id ?? '', razorpay_payment_id: r.razorpay_payment_id ?? '', razorpay_signature: r.razorpay_signature ?? '' }),
          })
          done({ kind: 'verified', status: v.status, checkoutId: v.checkoutId })
        } catch {
          // Paid but not verifiable from here: the webhook settles it; the success page keeps polling.
          done({ kind: 'verified', status: 'pending', checkoutId })
        }
      },
    })
    // A failed attempt keeps Checkout open so the parent can retry another method; we only report it.
    rzp.on('payment.failed', (r) => onFailedAttempt?.(r.error?.reason ?? r.error?.code ?? 'failed'))
    rzp.open()
  })
}
