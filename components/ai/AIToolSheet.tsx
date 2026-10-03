'use client'
/** Generic sheet for one contextual AI action: run → progress (cancel) → result renderer → regenerate. */
import { type ReactNode, useEffect } from 'react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton } from '@/components/app/ui'
import { AIError, AIProgress } from './AIProgress'
import { useAIGenerate } from './useAI'

export function AIToolSheet<R>({ open, onOpenChange, title, description, path, body, steps, render, onUsed }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  path: string
  body: Record<string, unknown>
  steps?: string[]
  render: (result: R, generationId: string, rerun: (extra: Record<string, unknown>) => void) => ReactNode
  onUsed?: () => void
}) {
  const gen = useAIGenerate<R>(path)
  const run = async (extra: Record<string, unknown> = {}) => {
    await gen.run({ ...body, ...extra })
    onUsed?.()
  }
  // Start as soon as the sheet opens (the action button is the request).
  useEffect(() => {
    if (open && gen.state.phase === 'idle') void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const s = gen.state
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) gen.cancel(); onOpenChange(o) }} title={title} description={s.phase === 'done' ? 'Nothing changes until you tap Add.' : description}>
      {s.phase === 'loading' || s.phase === 'idle' ? <AIProgress steps={steps} onCancel={() => { gen.cancel(); onOpenChange(false) }} /> : null}
      {s.phase === 'error' ? (
        <AIError message={s.message} onRetry={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? undefined : () => run()} upgradeTo={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? 'starter' : null} />
      ) : null}
      {s.phase === 'done' ? (
        <div className="space-y-4 pb-2" aria-live="polite">
          {render(s.result, s.generationId, (extra) => void run({ regenerate: true, ...extra }))}
          <AppButton variant="outline" block onClick={() => run({ regenerate: true })}>
            Regenerate
          </AppButton>
          {s.remaining != null ? <p className="text-center text-xs text-muted-foreground">{s.remaining} AI suggestions left for this party</p> : null}
        </div>
      ) : null}
    </BottomSheet>
  )
}
