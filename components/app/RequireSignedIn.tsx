'use client'
import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from './ui'

/** Gate for full-screen flow pages that need a session. */
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname() ?? '/home'
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [loading, user, pathname, router])
  if (loading || !user) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-5" aria-busy="true">
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    )
  }
  return <>{children}</>
}
