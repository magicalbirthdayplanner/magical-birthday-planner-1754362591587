'use client'
/**
 * Founding-families offer: the first 25 accounts get Pro free on every party (migration 20251009001700). Signed-out
 * visitors see the spots left and a way in; a founding family sees that it has the gift. Hidden once the seats are
 * gone, and for everyone else. Display only: the database hands out the seats.
 */
import useSWR from 'swr'
import { Gift } from 'lucide-react'
import { LinkButton } from '@/components/app/ui'
import { usePlanStatus } from './usePlanStatus'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const fetchSeats = (url: string) => fetch(url).then((r) => (r.ok ? (r.json() as Promise<{ seats: number; left: number }>) : null))

/** `compact`: one line for the landing hero, above the main button (no button of its own). */
export function FoundingOffer({ className, compact }: { className?: string; compact?: boolean }) {
  const { user, loading } = useAuth()
  const status = usePlanStatus()
  const { data } = useSWR(user ? null : '/api/founding', fetchSeats, { revalidateOnFocus: false })

  if (loading) return null
  if (user) {
    if (!status.founding) return null
    return (
      <p className={cn('mx-auto flex max-w-xl items-center justify-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-700', className)} data-testid="founding-member">
        <Gift className="h-4 w-4 shrink-0 text-purple-600" aria-hidden />
        <span>You’re one of our founding families — <strong>Pro is free on every party you plan</strong>. Thank you!</span>
      </p>
    )
  }
  if (!data || data.left <= 0) return null
  if (compact) {
    return (
      <p className={cn('mx-auto inline-flex items-center gap-2 rounded-full border border-purple-300 bg-white/90 px-4 py-2 text-sm text-gray-800', className)} data-testid="founding-offer">
        <Gift className="h-4 w-4 shrink-0 text-purple-600" aria-hidden />
        <span>
          <strong>First {data.seats} families get Pro free</strong> · <span className="font-semibold text-purple-700" data-testid="founding-left">{data.left} of {data.seats} spots left</span>
        </span>
      </p>
    )
  }
  return (
    <div className={cn('mx-auto max-w-xl rounded-2xl border-2 border-purple-300 bg-white/90 px-4 py-4 text-center shadow-sm', className)} data-testid="founding-offer">
      <p className="flex items-center justify-center gap-2 font-display text-lg font-extrabold text-gray-900">
        <Gift className="h-5 w-5 text-purple-600" aria-hidden /> Free for our first {data.seats} families
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Sign up now and get <strong>Pro free on every party</strong> — every AI feature, guests &amp; RSVP. No card needed.
      </p>
      <p className="mt-2 text-sm font-semibold text-purple-700" data-testid="founding-left">
        {data.left} of {data.seats} spots left
      </p>
      <LinkButton href="/start" size="md" className="mt-3">
        Claim your free spot
      </LinkButton>
    </div>
  )
}
