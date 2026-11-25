import { Facebook, Instagram, Youtube } from 'lucide-react'
import { SOCIAL_PROFILES, type SocialProfile } from '@/lib/social'
import { cn } from '@/lib/utils'

/** X's mark (lucide only ships the old bird). Drawn on a 24×24 grid, filled with the current text colour. */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z" />
    </svg>
  )
}

const ICON: Record<SocialProfile['id'], React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  facebook: Facebook,
  instagram: Instagram,
  x: XLogo,
  youtube: Youtube,
}

/**
 * Follow-us icons for the shared footer. Real links (crawlable `<a href>`), each with an accessible name, opening in a
 * new tab. `rel="me"` tells search engines and Mastodon-style verifiers these profiles belong to this site.
 */
export function SocialLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Follow Magical Birthday Planner" className={className}>
      <ul className="flex items-center justify-center gap-2">
        {SOCIAL_PROFILES.map((p) => {
          const Icon = ICON[p.id]
          return (
            <li key={p.id}>
              <a
                href={p.url}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={`Magical Birthday Planner on ${p.name} (opens in a new tab)`}
                title={p.name}
                data-testid={`social-${p.id}`}
                className={cn(
                  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors',
                  'hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
