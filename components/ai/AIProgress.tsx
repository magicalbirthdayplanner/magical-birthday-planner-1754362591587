'use client'
import { useEffect, useState } from 'react'
import { AppButton } from '@/components/app/ui'

const DEFAULT_STEPS = ['Thinking about the birthday…', 'Finding ideas that fit your budget…', 'Building your party plan…', 'Putting everything together…']

/** Meaningful progress (rotating, aria-live) with Cancel after ~12 s. */
export function AIProgress({ steps = DEFAULT_STEPS, onCancel }: { steps?: string[]; onCancel: () => void }) {
  const [i, setI] = useState(0)
  const [showCancel, setShowCancel] = useState(false)
  useEffect(() => {
    const rot = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 4500)
    const c = setTimeout(() => setShowCancel(true), 12_000)
    return () => {
      clearInterval(rot)
      clearTimeout(c)
    }
  }, [steps.length])
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-hero text-2xl text-white shadow-lg shadow-primary/25" aria-hidden>
        ✨
      </span>
      <p className="text-base font-semibold">{steps[i]}</p>
      <div className="flex gap-1.5" aria-hidden>
        {steps.map((_, k) => (
          <span key={k} className={`h-1.5 w-6 rounded-full ${k <= i ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>
      {showCancel ? (
        <AppButton variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </AppButton>
      ) : (
        <p className="text-xs text-muted-foreground">This usually takes 15–40 seconds.</p>
      )}
    </div>
  )
}

/** Calm error with retry; distinct copy for limit / locked handled by the caller's message. */
export function AIError({ message, onRetry, upgradeTo }: { message: string; onRetry?: () => void; upgradeTo?: string | null }) {
  return (
    <div className="rounded-2xl bg-accent p-4 text-sm text-accent-foreground" role="alert">
      <p>{message}</p>
      <div className="mt-3 flex gap-2">
        {onRetry ? (
          <AppButton size="sm" variant="outline" onClick={onRetry}>
            Try again
          </AppButton>
        ) : null}
        {upgradeTo ? (
          <a href={`/pricing?upgrade=${upgradeTo.toLowerCase()}`} className="tap inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-semibold text-primary">
            See plans
          </a>
        ) : null}
      </div>
    </div>
  )
}
