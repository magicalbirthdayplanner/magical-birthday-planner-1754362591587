'use client'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from './Logo'

export function AppHeader() {
  const { user } = useAuth()
  const initial = (user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || '?').toString().trim().charAt(0).toUpperCase()
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 pt-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-[var(--app-header-h)] max-w-xl items-center justify-between px-4">
        <Link href="/home" aria-label="Home" className="tap -ml-1 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
        {user ? (
          <Link href="/more" aria-label="Profile and settings" className="tap flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{initial}</span>
          </Link>
        ) : (
          <Link href="/login" className="tap flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary">
            <UserRound className="h-4 w-4" /> Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
