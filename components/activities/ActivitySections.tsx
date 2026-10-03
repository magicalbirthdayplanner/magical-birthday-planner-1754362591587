'use client'
/** The activity detail sections (Overview, What you'll need, Before the party, How to run it, What to say). Plain text only. */
import type { ReactNode } from 'react'
import { Card } from '@/components/app/ui'
import { ageRange, costRange, formatMinutes } from '@/lib/experience/model'
import { CATEGORY_LABEL, CLEANUP_LABEL, PREP_LABEL, SETTING_LABEL, type ActivityView } from '@/lib/experience/view'

export function activityMeta(v: ActivityView) {
  return [v.minutes ? formatMinutes(v.minutes) : null, SETTING_LABEL[v.setting], ageRange(v.ageMin, v.ageMax)].filter(Boolean).join(' · ')
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ActivitySections({ v, actions = {} }: { v: ActivityView; actions?: { supplies?: ReactNode; supply?: (m: string) => ReactNode; prep?: ReactNode; script?: ReactNode } }) {
  return (
    <div className="space-y-5">
      <Card className="space-y-2 p-4">
        <p className="text-sm font-semibold text-primary">{CATEGORY_LABEL[v.category] ?? 'Activity'} · {activityMeta(v)}</p>
        {v.description ? <p className="text-[15px] leading-relaxed">{v.description}</p> : null}
        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">Estimated cost: {costRange(v.cost)}</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{PREP_LABEL[v.difficulty] ?? 'Easy prep'}</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{CLEANUP_LABEL[v.cleanup] ?? 'Little cleanup'}</span>
        </div>
      </Card>
      {v.materials.length ? (
        <Block title="What you’ll need" action={actions.supplies}>
          <Card className="divide-y divide-border">
            {v.materials.map((m) => (
              <div key={m} className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 text-[15px]">
                <span className="min-w-0">{m}</span>
                {actions.supply?.(m)}
              </div>
            ))}
          </Card>
        </Block>
      ) : null}
      {v.prep.length ? (
        <Block title="Before the party" action={actions.prep}>
          <ul className="list-inside list-disc space-y-1 text-[15px]">{v.prep.map((p) => <li key={p}>{p}</li>)}</ul>
        </Block>
      ) : null}
      {v.instructions.length ? (
        <Block title="How to run it">
          <ol className="list-inside list-decimal space-y-1.5 text-[15px]">{v.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
        </Block>
      ) : null}
      {v.script ? (
        <Block title="What to say" action={actions.script}>
          <blockquote className="rounded-2xl bg-secondary/60 px-4 py-3 text-[15px] italic leading-relaxed">“{v.script}”</blockquote>
        </Block>
      ) : null}
      {v.safety.length ? (
        <Block title="Keep it safe">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">{v.safety.map((s) => <li key={s}>{s}</li>)}</ul>
        </Block>
      ) : null}
      {v.variations.length || v.backup ? (
        <Block title="Variations">
          <ul className="list-inside list-disc space-y-1 text-sm">{v.variations.map((s) => <li key={s}>{s}</li>)}</ul>
          {v.backup ? <p className="text-sm text-muted-foreground"><span className="font-semibold">Backup plan: </span>{v.backup}</p> : null}
        </Block>
      ) : null}
    </div>
  )
}
