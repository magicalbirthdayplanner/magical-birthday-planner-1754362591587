'use client'
/**
 * Site-wide launch offer: every plan free until the campaign ends (migration 20251014002300). Shown on the public
 * site (always) and in the app (dismissible per campaign). Says only what the server grants: all plans, every party,
 * no card, until the end date.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PartyPopper, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCampaign } from './useCampaign'
import { cn } from '@/lib/utils'

export function CampaignBanner({ variant = 'site', className }: { variant?: 'site' | 'app'; className?: string }) {
  const { user, loading } = useAuth()
  const { campaign, until } = useCampaign()
  const key = campaign ? `mbp.campaign.dismissed.${campaign.id}` : null
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (!key) return
    try {
      setDismissed(localStorage.getItem(key) === '1')
    } catch {
      /* storage unavailable */
    }
  }, [key])
  if (!campaign || (variant === 'app' && dismissed)) return null

  return (
    <div role="region" aria-label="Launch offer" data-testid="campaign-banner" className={cn('bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-white', className)}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <PartyPopper className="h-5 w-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <strong>Every plan is free until {until}</strong>
          <span className="opacity-90"> — all features, every party, no card needed.</span>
        </p>
        {variant === 'site' && !loading && !user ? (
          <Link href="/start" className="tap inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-white px-4 text-sm font-semibold text-purple-700">
            Start free
          </Link>
        ) : null}
        {variant === 'app' ? (
          <button
            type="button"
            aria-label="Dismiss offer"
            className="tap -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            onClick={() => {
              setDismissed(true)
              try {
                localStorage.setItem(key!, '1')
              } catch {
                /* storage unavailable */
              }
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
