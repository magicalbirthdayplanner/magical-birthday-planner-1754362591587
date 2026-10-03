'use client'
/**
 * Renders an AI party plan as plain text sections (never HTML). Each item gets an action slot so Phase 5's
 * Apply / Edit / Dismiss controls plug in without changing the layout.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, ClipboardCheck, MapPin, Send } from 'lucide-react'
import { Card, Section } from '@/components/app/ui'
import type { PartyPlanResult } from '@/lib/ai/schemas/partyPlanner'

export type ItemAction = (target: 'activities' | 'shopping_list' | 'theme' | 'budget' | 'checklist', itemId: string, label: string) => ReactNode
export type BulkAction = (target: 'activities' | 'shopping_list' | 'budget', itemIds: string[], label: string) => ReactNode

/** Real places in the app to continue — not AI output. */
const NEXT_STEPS = [
  { href: '/discover', icon: MapPin, label: 'Find a venue near you', sub: 'Discover places that fit this plan' },
  { href: '/plan/invite', icon: Send, label: 'Create the invitation', sub: 'Share it and track RSVPs' },
  { href: '/plan/checklist', icon: ClipboardCheck, label: 'Open your checklist', sub: 'Tasks with dates, ready to tick off' },
]

const money = (n: number) => (n === 0 ? 'Free' : `$${n % 1 === 0 ? n : n.toFixed(2)}`)

export function PlanResultView({ plan, action, bulk, nextSteps = false }: { plan: PartyPlanResult; action?: ItemAction; bulk?: BulkAction; nextSteps?: boolean }) {
  return (
    <div className="space-y-1 pb-4" aria-live="polite">
      <div className="rounded-3xl bg-secondary p-5">
        <p className="text-sm font-semibold text-secondary-foreground">Your AI plan</p>
        <p className="mt-1 text-[15px] leading-relaxed">{plan.summary}</p>
        {plan.partyConcept ? <p className="mt-2 text-sm text-muted-foreground">{plan.partyConcept}</p> : null}
      </div>

      <Section title="Theme">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold">{plan.theme.name}</p>
              {plan.theme.why ? <p className="mt-1 text-sm text-muted-foreground">{plan.theme.why}</p> : null}
            </div>
            {action?.('theme', 'theme', plan.theme.name)}
          </div>
          {plan.theme.palette.length ? (
            <div className="mt-3 flex gap-2" aria-label="Color palette">
              {plan.theme.palette.filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).map((c) => (
                <span key={c} className="h-8 w-8 rounded-full border border-border" style={{ background: c }} />
              ))}
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Activities" action={bulk?.('activities', plan.activities.map((a) => a.id), 'Add all')}>
        <div className="space-y-3">
          {plan.activities.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.durationMin} min · {money(a.estimatedCost)} · {a.difficulty}
                  </p>
                </div>
                {action?.('activities', a.id, a.name)}
              </div>
              {a.description ? <p className="mt-2 text-sm">{a.description}</p> : null}
              {a.materials.length ? <p className="mt-2 text-xs text-muted-foreground">Materials: {a.materials.join(', ')}</p> : null}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Food">
        <Card className="space-y-2 p-4 text-sm">
          {(['main', 'snacks', 'dessert', 'drinks'] as const).map((k) =>
            plan.food[k].length ? (
              <p key={k}>
                <span className="font-semibold capitalize">{k}: </span>
                {plan.food[k].join(', ')}
              </p>
            ) : null,
          )}
          <p className="text-xs text-muted-foreground">Please check allergies and dietary needs with each family.</p>
        </Card>
      </Section>

      {plan.decorations.length ? (
        <Section title="Decorations">
          <Card className="p-4 text-sm">
            <ul className="list-inside list-disc space-y-1">
              {plan.decorations.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      {plan.timeline.length ? (
        <Section title="Timeline">
          <Card className="divide-y divide-border">
            {plan.timeline.map((t) => (
              <div key={t.id} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="w-12 shrink-0 font-semibold tabular-nums text-primary">{t.time}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {plan.shoppingList.length ? (
        <Section title="Shopping list" action={bulk?.('shopping_list', plan.shoppingList.map((x) => x.id), 'Add all')}>
          <Card className="divide-y divide-border">
            {plan.shoppingList.map((s) => (
              <div key={s.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.item}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[s.qty, s.category, s.estimatedCost ? `~${money(s.estimatedCost)}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {action?.('shopping_list', s.id, s.item)}
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {plan.budget.lines.length ? (
        <Section title="Budget (estimates)" action={bulk?.('budget', plan.budget.lines.map((l) => l.id), 'Use all')}>
          <Card className="divide-y divide-border">
            {plan.budget.lines.map((l) => (
              <div key={l.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2 text-sm">
                <span className="flex-1">{l.category}</span>
                <span className="font-semibold tabular-nums">{money(l.amount)}</span>
                {action?.('budget', l.id, l.category)}
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
              <span>Total</span>
              <span className={plan.budget.overBy ? 'text-destructive' : ''}>{money(plan.budget.total)}</span>
            </div>
          </Card>
        </Section>
      ) : null}

      {plan.backupPlan ? (
        <Section title="Backup plan">
          <p className="text-sm">{plan.backupPlan}</p>
        </Section>
      ) : null}
      {plan.assumptions.length ? (
        <Section title="Assumptions">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {plan.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {plan.followUpQuestions.length ? (
        <Section title="To think about">
          <ul className="list-inside list-disc space-y-1 text-sm">
            {plan.followUpQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {nextSteps ? (
        <Section title="Next steps">
          <Card className="divide-y divide-border overflow-hidden">
            {NEXT_STEPS.map(({ href, icon: Icon, label, sub }) => (
              <Link key={href} href={href} className="tap flex min-h-[56px] items-center gap-3 px-4 py-3 active:bg-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        </Section>
      ) : null}
      <p className="px-4 text-xs text-muted-foreground">AI suggestions are estimates — prices and availability vary. Added items appear under “Your party plan” on the Plan tab.</p>
    </div>
  )
}
