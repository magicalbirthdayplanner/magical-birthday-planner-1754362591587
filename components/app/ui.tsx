'use client'
/**
 * Mobile UI primitives for the app shell. Touch-first: ≥44px targets,
 * visible focus, no hover-only affordances.
 */
import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, ChevronLeft, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------- buttons
type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'magic'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 active:bg-primary/90',
  magic: 'bg-hero text-white shadow-lg shadow-primary/30 active:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground active:bg-secondary/80',
  outline: 'border border-border bg-card text-foreground active:bg-muted',
  ghost: 'text-foreground active:bg-muted',
  danger: 'bg-destructive text-destructive-foreground active:bg-destructive/90',
}

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg' | 'sm'
  loading?: boolean
  block?: boolean
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'tap inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,opacity] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        size === 'lg' ? 'h-14 px-6 text-base' : size === 'sm' ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-[15px]',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})

export function LinkButton({ href, variant = 'primary', size = 'md', block, className, children, ...rest }: { href: string; variant?: Variant; size?: 'md' | 'lg' | 'sm'; block?: boolean; className?: string; children: ReactNode; prefetch?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'tap inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        size === 'lg' ? 'h-14 px-6 text-base' : size === 'sm' ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-[15px]',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  )
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'tap inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition active:scale-95 active:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- layout
export function PageHeader({ title, subtitle, back, action, className }: { title: ReactNode; subtitle?: ReactNode; back?: string | (() => void); action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 px-4 pb-3 pt-4', className)}>
      {back ? (
        typeof back === 'string' ? (
          <Link href={back} aria-label="Back" className="tap -ml-2 mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        ) : (
          <IconButton label="Back" onClick={back} className="-ml-2 mt-0.5 shrink-0">
            <ChevronLeft className="h-6 w-6" />
          </IconButton>
        )
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </div>
  )
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('px-4 py-3', className)}>
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-bold tracking-tight">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(30,20,60,0.04),0_8px_24px_-12px_rgba(30,20,60,0.12)]', className)} {...props}>
      {children}
    </div>
  )
}

/** Fixed bottom action bar; sits above the bottom nav when one is shown. */
export function StickyCTA({ children, aboveNav = true, className }: { children: ReactNode; aboveNav?: boolean; className?: string }) {
  return (
    <>
      <div aria-hidden className="h-24" />
      <div
        className={cn(
          'fixed inset-x-0 z-30 mx-auto w-full max-w-xl px-4',
          aboveNav ? 'bottom-above-nav' : 'bottom-0 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 bg-gradient-to-t from-background via-background/95 to-background/0',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- feedback
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('mbp-skeleton rounded-xl', className)} />
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon ? <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-3xl text-primary">{icon}</div> : null}
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {body ? <p className="mt-2 max-w-xs text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-5 w-full max-w-xs">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, offline, className }: { title?: string; message?: string; onRetry?: () => void; offline?: boolean; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        {offline ? <WifiOff className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
      </div>
      <h3 className="font-display text-xl font-bold">{offline ? "You're offline" : title}</h3>
      {message ? <p className="mt-2 max-w-xs text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <AppButton variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Try again
        </AppButton>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- bits
export function Chip({ active, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'tap inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ProgressRing({ value, size = 64, stroke = 7, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="img" aria-label={`${v}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-current opacity-20" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-current transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function Stars({ rating, count }: { rating: number | null; count?: number | null }) {
  if (rating == null) return <span className="text-xs text-muted-foreground">No rating yet</span>
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden className="text-gold">★</span>
      <span className="font-semibold">{rating.toFixed(1)}</span>
      {count != null ? <span className="text-muted-foreground">({count.toLocaleString('en-US')})</span> : null}
      <span className="sr-only">{`Rated ${rating.toFixed(1)} out of 5${count != null ? ` from ${count} reviews` : ''}`}</span>
    </span>
  )
}

export const priceLabel = (level: number | null) => (level == null ? null : level === 0 ? 'Free' : '$'.repeat(level))
