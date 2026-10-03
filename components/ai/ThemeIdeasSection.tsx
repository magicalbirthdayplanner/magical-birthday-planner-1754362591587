'use client'
/** /plan/theme: "Give me 5 theme ideas" (theme_ideas). Hidden unless the server enables the feature. */
import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Card, Section } from '@/components/app/ui'
import type { ThemeIdeasResult } from '@/lib/ai/schemas/themeIdeas'
import { AIToolSheet } from './AIToolSheet'
import { ApplyControls } from './ApplyControls'
import { useAICapabilities } from './useAI'

export function ThemeIdeasSection({ partyId }: { partyId: string }) {
  const caps = useAICapabilities(partyId)
  const cap = caps.get('theme_ideas')
  const [open, setOpen] = useState(false)
  if (!cap?.enabled) return null
  return (
    <Section title="Fresh theme ideas">
      <button type="button" onClick={() => setOpen(true)} className="tap flex min-h-[64px] w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left" data-testid="ai-theme-ideas">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Wand2 className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-semibold">Give me 5 theme ideas</span>
          <span className="block text-sm text-muted-foreground">{cap.allowed && cap.remaining !== 0 ? 'Mixed from your child’s interests' : 'Included in paid plans'}</span>
        </span>
      </button>
      <AIToolSheet<ThemeIdeasResult>
        open={open}
        onOpenChange={setOpen}
        title="Theme ideas"
        path="/api/ai/theme-ideas"
        body={{ partyId }}
        steps={['Thinking about the birthday…', 'Mixing interests into themes…', 'Picking colours and activities…']}
        onUsed={() => caps.mutate()}
        render={(r, generationId) => (
          <div className="space-y-3">
            {r.themes.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">
                      <span aria-hidden>{t.emoji}</span> {t.name}
                    </p>
                    {t.why ? <p className="mt-0.5 text-sm text-muted-foreground">{t.why}</p> : null}
                  </div>
                  <ApplyControls generationId={generationId} target="theme" itemId={t.id} label={t.name} partyId={partyId} />
                </div>
                <div className="mt-3 flex gap-2" aria-label="Color palette">
                  {t.palette.map((c) => <span key={c} className="h-7 w-7 rounded-full border border-border" style={{ background: c }} />)}
                </div>
                {t.decorations.length ? <p className="mt-3 text-sm"><span className="font-semibold">Decorations: </span>{t.decorations.join(', ')}</p> : null}
                {t.activities.length ? <p className="mt-1 text-sm"><span className="font-semibold">Activities: </span>{t.activities.join(', ')}</p> : null}
                {t.ageFit ? <p className="mt-1 text-xs text-muted-foreground">{t.ageFit}</p> : null}
              </Card>
            ))}
            {r.assumptions.length ? <p className="text-xs text-muted-foreground">{r.assumptions.join(' ')}</p> : null}
          </div>
        )}
      />
    </Section>
  )
}
