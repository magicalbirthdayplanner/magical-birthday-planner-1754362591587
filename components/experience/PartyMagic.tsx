'use client'
/**
 * Plan → "✨ Party Magic": the creative layer. A few calm cards (Activities, Host, Food, Messages, Shopping, Timeline)
 * plus "Create my party experience". Cards appear only for features that are on; locked ones explain the plan.
 */
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, Section } from '@/components/app/ui'
import { AIToolSheet } from '@/components/ai/AIToolSheet'
import { TOOLS } from '@/components/ai/tools'
import { useAICapabilities } from '@/components/ai/useAI'
import type { AIFeature } from '@/lib/ai/types'
import { useExperience } from '@/lib/data/experience'
import { ExperienceSheet } from './ExperienceSheet'
import { HostStudioSheet } from './HostStudioSheet'
import type { HostKind } from '@/lib/ai/features/hostContent.types'

type CardDef = { key: string; emoji: string; title: string; sub: string; feature?: AIFeature; href?: string; onOpen?: () => void }

export function PartyMagic({ partyId }: { partyId: string }) {
  const caps = useAICapabilities(partyId)
  const exp = useExperience(partyId)
  const [tool, setTool] = useState<AIFeature | null>(null)
  const [host, setHost] = useState<{ kind: HostKind } | null>(null)
  const [experience, setExperience] = useState(false)
  const cap = (f: AIFeature) => caps.get(f)
  const on = (f: AIFeature) => !!cap(f)?.enabled
  const cards: CardDef[] = [
    { key: 'activities', emoji: '🎮', title: 'Activities', sub: 'Games, crafts, treasure hunts and challenges', href: '/activities' },
    { key: 'host', emoji: '🎤', title: 'Host', sub: 'Welcome speech, cake announcement, closing words', feature: 'host_content', onOpen: () => setHost({ kind: 'welcome' }) },
    { key: 'food', emoji: '🍕', title: 'Food', sub: 'Menu, quantities and dietary alternatives', feature: 'food', onOpen: () => setTool('food') },
    { key: 'messages', emoji: '💌', title: 'Messages', sub: 'Reminders and thank-you notes', feature: 'host_content', onOpen: () => setHost({ kind: 'thank_you_all' }) },
    { key: 'shopping', emoji: '🛍', title: 'Shopping', sub: 'One list from everything you planned', feature: 'shopping_list', onOpen: () => setTool('shopping_list') },
    { key: 'timeline', emoji: '⏰', title: 'Timeline', sub: 'Turn your plan into the party day', feature: 'timeline', onOpen: () => setTool('timeline') },
    { key: 'budget', emoji: '💰', title: 'Budget', sub: 'Help me stretch my budget', feature: 'budget_optimizer', onOpen: () => setTool('budget_optimizer') },
  ].filter((c) => !c.feature || on(c.feature as AIFeature)) as CardDef[]
  const active = tool ? TOOLS.find((t) => t.feature === tool) : null
  const exCap = cap('party_experience')

  return (
    <Section title="✨ Party Magic">
      {exCap?.enabled ? (
        exCap.allowed ? (
          <button type="button" onClick={() => setExperience(true)} className="tap mb-3 block w-full text-left" data-testid="create-experience">
            <Card className="flex items-center gap-3 bg-hero p-4 text-white">
              <span className="text-2xl" aria-hidden>✨</span>
              <span className="min-w-0 flex-1"><span className="block font-bold">Create my party experience</span><span className="block text-sm text-white/85">Theme, activities, timeline, food, shopping and what to say — you choose what to add.</span></span>
              <ChevronRight className="h-5 w-5 shrink-0" />
            </Card>
          </button>
        ) : (
          <a href={`/pricing?upgrade=${(exCap.upgradeTo ?? 'plus').toLowerCase()}`} className="tap mb-3 block"><Card className="flex items-center gap-3 p-4"><span className="text-2xl" aria-hidden>✨</span><span className="min-w-0 flex-1"><span className="block font-bold">Create my party experience</span><span className="block text-sm text-muted-foreground">Included with {exCap.upgradeTo ? exCap.upgradeTo.charAt(0) + exCap.upgradeTo.slice(1).toLowerCase() : 'a paid plan'}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" /></Card></a>
        )
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const cp = c.feature ? cap(c.feature) : null
          const locked = !!cp && !cp.allowed
          const inner = (
            <Card className="flex h-full flex-col gap-1 p-4">
              <span className="text-2xl" aria-hidden>{c.emoji}</span>
              <span className="font-bold">{c.title}</span>
              <span className="text-xs leading-snug text-muted-foreground">{locked ? `Included with ${cp!.upgradeTo ? cp!.upgradeTo.charAt(0) + cp!.upgradeTo.slice(1).toLowerCase() : 'a paid plan'}` : c.sub}</span>
            </Card>
          )
          if (locked) return <a key={c.key} href={`/pricing?upgrade=${(cp!.upgradeTo ?? 'starter').toLowerCase()}`} className="tap block min-h-[44px]">{inner}</a>
          if (c.href) return <Link key={c.key} href={c.href} className="tap block min-h-[44px]" data-testid={`magic-${c.key}`}>{inner}</Link>
          return <button key={c.key} type="button" onClick={c.onOpen} className="tap block min-h-[44px] text-left" data-testid={`magic-${c.key}`}>{inner}</button>
        })}
      </div>
      {active ? (
        <AIToolSheet key={active.feature} open onOpenChange={(o) => !o && setTool(null)} title={active.title} path={active.path} body={{ partyId, ...(active.body?.() ?? {}) }} steps={active.steps} feature={active.feature} restore ask={active.ask} onUsed={() => caps.mutate()} render={(r, gid, rerun) => active.render(r as never, gid, partyId, rerun)} />
      ) : null}
      {on('host_content') ? <HostStudioSheet partyId={partyId} open={!!host} onOpenChange={(o) => !o && setHost(null)} activities={exp.data?.activities ?? []} saved={exp.data?.host ?? []} preset={host} onUsed={() => caps.mutate()} /> : null}
      {exCap?.enabled ? <ExperienceSheet partyId={partyId} open={experience} onOpenChange={setExperience} onUsed={() => caps.mutate()} /> : null}
    </Section>
  )
}
