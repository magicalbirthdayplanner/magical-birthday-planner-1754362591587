'use client'
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** 16px+ text so iOS Safari doesn't zoom on focus; 56px tall touch target. */
export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null; trailing?: ReactNode; hideLabel?: boolean }>(
  function TextField({ label, hint, error, trailing, hideLabel, className, id, ...props }, ref) {
    const inputId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    return (
      <div className={className}>
        <label htmlFor={inputId} className={cn('mb-1.5 block text-sm font-medium', hideLabel && 'sr-only')}>
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'h-14 w-full rounded-2xl border bg-card px-4 text-base outline-none transition placeholder:text-muted-foreground/70',
              'focus:border-primary focus:ring-4 focus:ring-primary/15',
              error ? 'border-destructive' : 'border-input',
              trailing && 'pr-14',
            )}
            {...props}
          />
          {trailing ? <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div> : null}
        </div>
        {error ? (
          <p id={`${inputId}-err`} role="alert" className="mt-1.5 text-sm text-destructive">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    )
  },
)

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hideLabel?: boolean }>(function TextArea(
  { label, hideLabel, className, id, ...props },
  ref,
) {
  const inputId = id ?? `t-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className={className}>
      <label htmlFor={inputId} className={cn('mb-1.5 block text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        className="min-h-[112px] w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
        {...props}
      />
    </div>
  )
})

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}
