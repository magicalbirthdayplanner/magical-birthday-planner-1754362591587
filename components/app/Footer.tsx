import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Matches the address published in the Privacy Policy and Terms. */
const CONTACT_EMAIL = 'magicalbirthdayplanner@gmail.com'
const link = 'inline-flex min-h-[44px] items-center rounded px-1 underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** Shared founder footer: public site pages, app tabs and sign-in screens (not maps, wizards, RSVP or sheets). */
export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('border-t border-border/70 px-6 py-8 text-center', className)}>
      <p className="mx-auto max-w-md text-[15px] font-medium leading-relaxed text-foreground/80 text-balance">
        Made with <span role="img" aria-label="love">❤️</span> by a busy parent who wants to make every birthday magical.
      </p>
      <nav aria-label="Legal" className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} Magical Birthday Planner</span>
        <span aria-hidden>·</span>
        <Link href="/privacy" className={link}>Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className={link}>Terms</Link>
        <span aria-hidden>·</span>
        <Link href="/help" className={link}>Help</Link>
        <span aria-hidden>·</span>
        <a href={`mailto:${CONTACT_EMAIL}`} className={link}>Contact</a>
      </nav>
    </footer>
  )
}
