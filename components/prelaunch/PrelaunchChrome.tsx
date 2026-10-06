'use client'
/**
 * Pre-launch header, footer, sticky mobile CTA and page-view tracking. No sign-in, sign-up, pricing or account
 * controls: the only action on the pre-launch site is joining the waitlist.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo, LogoMark } from '@/components/app/Logo'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import { captureAttribution } from './WaitlistForm'

const CONTACT_EMAIL = 'magicalbirthdayplanner@gmail.com'
const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#ai', label: 'AI' },
  { href: '/#features', label: 'Features' },
]

export function PrelaunchHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur" data-testid="prelaunch-header">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <Link href="/" aria-label="Magical Birthday Planner home" className="tap -ml-1 flex min-h-[44px] items-center px-1">
          <Logo textClassName="text-[17px] sm:text-[19px]" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="tap hidden min-h-[44px] items-center rounded-full px-3 text-sm font-semibold text-foreground/80 hover:text-foreground md:inline-flex">
              {n.label}
            </a>
          ))}
          <a href="#join" className="tap ml-1 hidden h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 sm:inline-flex">
            Join the waitlist
          </a>
        </nav>
      </div>
    </header>
  )
}

/** Mobile only: a "Join the waitlist" bar once the hero form has scrolled away (hidden again near the final form). */
export function StickyJoin() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const hero = document.getElementById('join')?.getBoundingClientRect()
      const final = document.getElementById('join-final')?.getBoundingClientRect()
      if (!hero || !final) return
      setShow(hero.bottom < 0 && final.top > window.innerHeight)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return (
    <div className={cn('fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur transition-transform duration-200 sm:hidden', show ? 'translate-y-0' : 'pointer-events-none translate-y-full')} aria-hidden={!show}>
      <a href="#join-final" tabIndex={show ? 0 : -1} className="tap flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground shadow-sm shadow-primary/30" data-testid="sticky-join">
        <LogoMark className="h-6 w-6 rounded-md" /> Join the waitlist · Oct 13
      </a>
    </div>
  )
}

export function PrelaunchPageView() {
  useEffect(() => {
    const a = captureAttribution()
    track('landing_page_view', { variant: 'prelaunch', utm_source: a.utm_source, utm_campaign: a.utm_campaign, source: a.source })
  }, [])
  return null
}

const link = 'inline-flex min-h-[44px] items-center rounded px-1 underline decoration-border underline-offset-4 hover:text-foreground'

export function PrelaunchFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/50 px-6 pb-24 pt-8 text-center sm:pb-8">
      <p className="mx-auto max-w-md text-[15px] font-medium leading-relaxed text-foreground/80 text-balance">
        Made with <span role="img" aria-label="love">❤️</span> by a busy parent who wants to make every birthday magical.
      </p>
      <nav aria-label="Legal" className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted-foreground">
        <span>© 2026 Magical Birthday Planner</span>
        <span aria-hidden>·</span>
        <Link href="/privacy" className={link}>Privacy</Link>
        <span aria-hidden>·</span>
        <a href={`mailto:${CONTACT_EMAIL}`} className={link}>Contact</a>
      </nav>
    </footer>
  )
}
