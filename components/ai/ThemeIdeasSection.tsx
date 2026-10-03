'use client'
/**
 * /plan/theme: "Dream up themes with AI" (theme_ideas). The parent can say what the child loves and what they don't
 * want; each idea comes with colours, decorations, activities, food and an invitation concept, and "Use this theme"
 * saves it like the theme picker does. Hidden unless the server enables the feature.
 */
import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Card, Section } from '@/components/app/ui'
import type { ThemeIdeasResult } from '@/lib/ai/schemas/themeIdeas'
import { AIToolSheet } from './AIToolSheet'
import { ApplyControls } from './ApplyControls'
import { useAICapabilities } from './useAI'

const Line = ({ label, items }: { label: string; items: string[] }) =>
  items.length ? <p className="mt-1.5 text-sm"><span className="font-semibold">{label}: </span>{items.join(', ')}</p> : null

export function ThemeIdeasSection({ partyId }: { partyId: string }) {
  const caps = useAICapabilities(partyId)
  const cap = caps.get('theme_ideas')
  const [open, setOpen] = useState(false)
  if (!cap?.enabled) return null
  const usable = cap.allowed && cap.remaining !== 0
  return (
    <Section title="✨ Themes made for your child">
      <button type="button" onClick={() => setOpen(true)} className="tap flex min-h-[64px] w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left" data-testid="ai-theme-ideas">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Wand2 className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-semibold">Dream up themes with AI</span>
          <span className="block text-sm text-muted-foreground">{usable ? 'Tell us what they love (and what you’d rather avoid) — get 5 original ideas' : cap.allowed ? 'See your last ideas' : 'Included in paid plans'}</span>
        </span>
      </button>
      {open ? (
        <AIToolSheet<ThemeIdeasResult>
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title="Theme ideas"
          description="Ideas only — your theme changes when you tap Use this theme."
          path="/api/ai/theme-ideas"
          body={{ partyId }}
          feature="theme_ideas"
          restore
          ask={{ label: 'What does your child love?', placeholder: 'e.g. “She loves unicorns but I don’t want a typical pink unicorn party” or “dinosaurs and space”', cta: '✨ Get 5 theme ideas' }}
          steps={['Thinking about the birthday…', 'Mixing interests into themes…', 'Picking colours, food and activities…']}
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
                      {t.description ? <p className="mt-0.5 text-sm">{t.description}</p> : null}
                      {t.why ? <p className="mt-0.5 text-sm text-muted-foreground">{t.why}</p> : null}
                    </div>
                    <ApplyControls generationId={generationId} target="theme" itemId={t.id} label={t.name} partyId={partyId} />
                  </div>
                  <div className="mt-3 flex gap-2" aria-label="Color palette">
                    {t.palette.map((c) => <span key={c} className="h-7 w-7 rounded-full border border-border" style={{ background: c }} />)}
                  </div>
                  <Line label="Decorations" items={t.decorations} />
                  <Line label="Activities" items={t.activities} />
                  <Line label="Food" items={t.food ?? []} />
                  {t.invitationIdea ? <p className="mt-1.5 text-sm"><span className="font-semibold">Invitation idea: </span>{t.invitationIdea}</p> : null}
                  {t.ageFit ? <p className="mt-1.5 text-xs text-muted-foreground">{t.ageFit}</p> : null}
                </Card>
              ))}
              {r.assumptions.length ? <p className="text-xs text-muted-foreground">{r.assumptions.join(' ')}</p> : null}
            </div>
          )}
        />
      ) : null}
    </Section>
  )
}
