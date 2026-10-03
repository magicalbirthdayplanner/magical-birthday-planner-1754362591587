'use client'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/app/Logo'
import { LinkButton } from '@/components/app/ui'

/** Marketing-page header: leads only into the mobile app (sign in, start planning, or open the app). */
export function SiteHeader() {
  const { user, loading } = useAuth()
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <Link href="/" aria-label="Magical Birthday Planner home" className="tap -ml-1 flex min-h-[44px] items-center px-1">
          {/* The full wordmark doesn't fit beside Sign in + Get started on phones; the landing H1 carries the name there. */}
          <Logo textClassName="hidden sm:inline" />
        </Link>
        {loading ? null : user ? (
          <LinkButton href="/home" size="sm">
            Open app
          </LinkButton>
        ) : (
          <nav className="flex items-center gap-1" aria-label="Account">
            <Link href="/login" className="tap inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-foreground">
              Sign in
            </Link>
            <LinkButton href="/start" size="sm">
              Get started
            </LinkButton>
          </nav>
        )}
      </div>
    </header>
  )
}
