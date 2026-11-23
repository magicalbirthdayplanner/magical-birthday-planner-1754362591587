'use client'

/** Magical Santa UI kit — mobile-first, warm Christmas palette, big touch targets (≥ 48 px), Nunito (site font). */
import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SANTA = { green: '#0f2a1d', red: '#c8202e', redDark: '#9e1622', gold: '#e9ac26', cream: '#fbf6ec', ink: '#2b1d14' }

type Variant = 'primary' | 'gold' | 'ghost' | 'outline'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-[#c8202e] text-white shadow-[0_8px_20px_-8px_rgba(200,32,46,0.7)] active:bg-[#9e1622]',
  gold: 'bg-[#e9ac26] text-[#3b1d00] shadow-[0_8px_20px_-8px_rgba(233,172,38,0.8)]',
  ghost: 'bg-transparent text-[#2b1d14]',
  outline: 'border-2 border-[#2b1d14]/15 bg-white text-[#2b1d14]',
}

export function SantaButton({ variant = 'primary', loading, block = true, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; block?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn('inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full px-6 text-[17px] font-extrabold transition active:scale-[0.98] disabled:opacity-50', VARIANT[variant], block && 'w-full', className)}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function SantaLink({ href, variant = 'primary', className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn('inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-6 text-[17px] font-extrabold transition active:scale-[0.98]', VARIANT[variant], className)}>
      {children}
    </Link>
  )
}

export function SantaCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-3xl border border-[#2b1d14]/8 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(43,29,20,0.35)]', className)}>{children}</div>
}

/** Selectable pill. */
export function Pill({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-4 text-[15px] font-bold transition active:scale-[0.97]',
        active ? 'border-[#c8202e] bg-[#c8202e] text-white' : 'border-[#2b1d14]/12 bg-white text-[#2b1d14]',
        className,
      )}
    >
      {active && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  )
}

export function StepHeader({ step, total, onBack, title, subtitle }: { step: number; total: number; onBack?: () => void; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="pb-4 pt-2">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-black/5">
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <span className="h-11 w-11" />
        )}
        <div className="flex flex-1 gap-1.5" aria-label={`Step ${step} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < step ? 'bg-[#c8202e]' : 'bg-[#2b1d14]/10')} />
          ))}
        </div>
        <span className="w-11 text-right text-xs font-bold text-[#2b1d14]/50">{step}/{total}</span>
      </div>
      <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-tight text-[#2b1d14]">{title}</h1>
      {subtitle && <p className="mt-2 text-[16px] leading-snug text-[#2b1d14]/65">{subtitle}</p>}
    </div>
  )
}

/** Fixed bottom action area (thumb zone), safe-area aware. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-[#2b1d14]/8 bg-[#fbf6ec]/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
      {children}
    </div>
  )
}

export function SantaShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto min-h-[100dvh] w-full max-w-[480px] bg-[#fbf6ec] px-5 text-[#2b1d14]', className)}>{children}</div>
}
