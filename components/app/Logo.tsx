import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('h-8 w-8', className)}>
      <defs>
        <linearGradient id="mbp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(258 56% 45%)" />
          <stop offset="0.6" stopColor="hsl(278 52% 48%)" />
          <stop offset="1" stopColor="hsl(12 88% 64%)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mbp-logo)" />
      <path d="M16 6.5l2.2 5.6 5.8.4-4.5 3.7 1.5 5.7L16 18.7l-5 3.2 1.5-5.7L8 12.5l5.8-.4z" fill="#fff" />
      <circle cx="24.5" cy="24.5" r="2" fill="hsl(40 92% 70%)" />
    </svg>
  )
}

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className={cn('font-display text-[19px] font-bold leading-none tracking-tight', textClassName)}>
        Magical Birthday<span className="text-primary"> Planner</span>
      </span>
    </span>
  )
}
