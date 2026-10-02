'use client'
import { useEffect } from 'react'
import { AppButton, ErrorState, LinkButton } from './ui'

/** Route-level error boundary UI. Never shows stack traces; logs for diagnostics. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('route error', error.digest ?? '', error.message)
  }, [error])
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <ErrorState offline={offline} title="Something went wrong" message={offline ? 'Reconnect and try again — your party is saved.' : 'We hit a snag loading this screen. Your party is safe.'} />
      <div className="space-y-3 px-6">
        <AppButton block onClick={reset}>
          Try again
        </AppButton>
        <LinkButton href="/home" variant="outline" block>
          Go home
        </LinkButton>
      </div>
    </div>
  )
}
