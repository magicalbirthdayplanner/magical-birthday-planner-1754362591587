'use client'
/**
 * Display-only countdown to the launch instant (Oct 13, 2026, 12:00 AM America/New_York — lib/launch.ts).
 * The server decides what is shown; when the countdown reaches zero while open, the page reloads once so the
 * routing layer serves the live site (never on a page that loads after the launch — no reload loops).
 * Renders nothing until mounted (no server/client clock mismatch).
 */
import { useEffect, useRef, useState } from 'react'
import { LAUNCH_AT } from '@/lib/launch'

export function countdownLabel(msLeft: number): string | null {
  if (msLeft <= 0) return null
  const hours = Math.floor(msLeft / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 2) return `${days} days to go`
  if (days === 1) return `1 day, ${hours - 24} hr to go`
  if (hours >= 1) return `${hours} hr to go`
  return `${Math.max(1, Math.ceil(msLeft / 60_000))} min to go`
}

export function Countdown({ className }: { className?: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const left = now === null ? null : LAUNCH_AT.getTime() - now
  const counting = useRef(false)
  useEffect(() => {
    if (left === null) return
    if (left > 0) counting.current = true
    else if (counting.current) {
      counting.current = false
      window.location.reload()
    }
  }, [left])
  const label = left === null ? null : countdownLabel(left)
  if (!label) return null
  return (
    <span className={className} data-testid="launch-countdown">
      {label}
    </span>
  )
}
