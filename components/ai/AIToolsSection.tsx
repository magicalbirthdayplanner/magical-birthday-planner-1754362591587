'use client'
/**
 * Plan → "Planning help": one row per contextual AI action whose screen doesn't exist yet (activities, food, budget,
 * checklist, timeline, shopping list). Rows come from the TOOLS registry (components/ai/tools.tsx); a row shows
 * only when its feature is enabled server-side. Locked rows explain calmly and link to pricing.
 */
import { useState } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { Card, Section } from '@/components/app/ui'
import { AIToolSheet } from './AIToolSheet'
import { TOOLS, type ToolDef } from './tools'
import { useAICapabilities } from './useAI'
import { UpgradeSheet } from '@/components/billing/UpgradePrompt'
import type { Plan } from '@/lib/entitlements'

export function AIToolsSection({ partyId, budget }: { partyId: string; budget: number | null }) {
  const caps = useAICapabilities(partyId)
  const [active, setActive] = useState<ToolDef | null>(null)
  const [locked, setLocked] = useState<{ feature: ToolDef['feature']; plan: Plan | null } | null>(null)
  const visible = TOOLS.filter((t) => caps.get(t.feature)?.enabled)
  if (!visible.length) return null
  return (
    <Section title="✨ Planning help">
      <Card className="divide-y divide-border overflow-hidden">
        {visible.map((t) => {
          const cap = caps.get(t.feature)!
          const locked = !cap.allowed
          const Icon = t.icon
          return locked ? (
            <button key={t.feature} type="button" onClick={() => setLocked({ feature: t.feature, plan: cap.upgradeTo })} className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Lock className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.label(budget)}</span>
                <span className="block text-sm text-muted-foreground">Part of {cap.upgradeTo ? cap.upgradeTo.charAt(0) + cap.upgradeTo.slice(1).toLowerCase() : 'a paid plan'}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button key={t.feature} type="button" onClick={() => setActive(t)} className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted" data-testid={`ai-tool-${t.feature}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.label(budget)}</span>
                <span className="block text-sm text-muted-foreground">{t.sub}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </Card>
      <UpgradeSheet capability={locked?.feature ?? null} plan={locked?.plan} open={!!locked} onOpenChange={(o) => !o && setLocked(null)} />
      {active ? (
        <AIToolSheet
          key={active.feature}
          open
          onOpenChange={(o) => !o && setActive(null)}
          title={active.title}
          path={active.path}
          body={{ partyId, ...(active.body?.() ?? {}) }}
          steps={active.steps}
          feature={active.feature}
          restore
          ask={active.ask}
          onUsed={() => caps.mutate()}
          render={(r, gid, rerun) => active.render(r as never, gid, partyId, rerun)}
        />
      ) : null}
    </Section>
  )
}
