'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Toaster } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { track } from '@/lib/analytics/client'
import { AppHeader } from './AppHeader'
import { BottomNav } from './BottomNav'
import { PartyProvider } from './PartyProvider'
import { OfflineBanner } from './OfflineBanner'
import { Skeleton } from './ui'

/** Screens that render their own signed-out state. */
const PUBLIC_APP_PATHS = new Set(['/home'])

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname() ?? '/home'
  const router = useRouter()
  const hadUser = useRef(false)
  if (user) hadUser.current = true
  const isPublic = PUBLIC_APP_PATHS.has(pathname)

  useEffect(() => {
    if (loading || user) return
    // One-shot flag set by signOut(): consumed on the first signed-out render,
    // public page or not, so it can never affect a later visit.
    let voluntary = false
    try {
      voluntary = sessionStorage.getItem('mbp.signedOut') === '1'
      if (voluntary) sessionStorage.removeItem('mbp.signedOut')
    } catch {
      /* storage unavailable */
    }
    if (isPublic) return
    if (voluntary) {
      router.replace('/home')
      return
    }
    const expired = hadUser.current ? '&expired=1' : ''
    router.replace(`/login?next=${encodeURIComponent(pathname)}${expired}`)
  }, [loading, user, isPublic, pathname, router])

  if (loading || (!user && !isPublic)) {
    return (
      <div className="space-y-4 px-4 pt-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  return <>{children}</>
}

function AppOpenTracker() {
  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    track('app_open', { standalone: !!standalone })
  }, [])
  return null
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mbp-app min-h-dvh bg-background text-foreground">
      <PartyProvider>
        <AppHeader />
        <OfflineBanner />
        <main id="main" className="app-content-pb mx-auto w-full max-w-xl">
          <RequireAuth>{children}</RequireAuth>
        </main>
        <BottomNav />
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'mt-[env(safe-area-inset-top)]' }} />
        <AppOpenTracker />
      </PartyProvider>
    </div>
  )
}

/** Full-screen flows (wizard, auth, venue detail, public invite): no tab bar. */
export function FlowShell({ children }: { children: ReactNode }) {
  return (
    <div className="mbp-app min-h-dvh bg-background text-foreground">
      <PartyProvider>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </PartyProvider>
    </div>
  )
}
