import { cn } from '@/lib/utils'

// Brand mark (source: docs/brand/MBP.png). Plain <img>: tiny static asset, already precached by the service worker.
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/icon-192.png" alt="" aria-hidden width={32} height={32} className={cn('h-8 w-8 rounded-[9px]', className)} />
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
