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
