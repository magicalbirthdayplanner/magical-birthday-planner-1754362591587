'use client'
import { WifiOff } from 'lucide-react'
import { AppButton } from './ui'
import { Logo } from './Logo'

export function OfflineScreen() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-magic px-6 text-center">
      <Logo />
      <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow">
        <WifiOff className="h-7 w-7 text-primary" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-semibold">You’re offline</h1>
      <p className="mt-2 text-muted-foreground">Your party is saved. Reconnect to keep planning — everything will be right where you left it.</p>
      <AppButton className="mt-6" size="lg" onClick={() => window.location.reload()}>
        Try again
      </AppButton>
    </div>
  )
}
