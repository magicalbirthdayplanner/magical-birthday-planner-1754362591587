'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Compass, Home, Lock, Menu, PartyPopper, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EXPERIENCE_ENABLED } from '@/lib/experience/flags'
import { usePlanStatus } from '@/components/billing/usePlanStatus'

const ALL_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/plan', label: 'Plan', icon: ClipboardList },
  { href: '/activities', label: 'Activities', icon: PartyPopper },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/guests', label: 'Guests', icon: Users },
  { href: '/more', label: 'More', icon: Menu },
] as const
export const NAV_ITEMS = EXPERIENCE_ENABLED ? ALL_ITEMS : ALL_ITEMS.filter((i) => i.href !== '/activities')

export function BottomNav() {
  const pathname = usePathname() ?? ''
  const plan = usePlanStatus()
  // Paid areas stay in the nav (discoverable); a lock shows they lead to an upgrade explanation.
  const lockedHref = plan.loaded && !plan.can('guests') ? '/guests' : null
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <ul className={cn('mx-auto grid h-[var(--app-nav-h)] max-w-xl', NAV_ITEMS.length === 6 ? 'grid-cols-6' : 'grid-cols-5')}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'tap flex h-full flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-medium tracking-tight transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className={cn('relative flex h-8 items-center justify-center rounded-full transition-colors', NAV_ITEMS.length === 6 ? 'w-12' : 'w-14', active && 'bg-secondary')}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                  {lockedHref === href ? <Lock className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-background p-[1px] text-muted-foreground" aria-label="Starter" data-testid="nav-lock-guests" /> : null}
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
