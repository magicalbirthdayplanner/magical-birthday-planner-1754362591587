'use client'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Modal bottom sheet (drag to dismiss). Use for filters, forms and pickers. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[hsl(252_32%_10%/0.45)] backdrop-blur-[2px]" />
        <Drawer.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'mbp-app fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-background outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
            <div>
              <Drawer.Title className="font-display text-2xl font-semibold">{title}</Drawer.Title>
              {description ? <Drawer.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Drawer.Description> : <Drawer.Description className="sr-only">{title}</Drawer.Description>}
            </div>
            <Drawer.Close aria-label="Close" className="tap -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted">
              <X className="h-5 w-5" />
            </Drawer.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4" data-vaul-no-drag>
            {children}
          </div>
          {footer ? <div className="border-t border-border/60 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">{footer}</div> : <div className="pb-safe" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
