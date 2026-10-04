'use client'
/**
 * What a parent sees when a capability isn't in their plan: what it does for them, which plan includes it, the
 * price, and one clear link to the plans. Copy comes from the product model (lib/entitlements.ts).
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { Card } from '@/components/app/ui'
import { track } from '@/lib/analytics/client'
import { CAPABILITIES, formatPrice, PLAN_INFO, type Capability, type Plan } from '@/lib/entitlements'
import { cn } from '@/lib/utils'

export function upgradeCopy(capability: Capability, plan?: Plan | null) {
  const info = CAPABILITIES[capability]
  const p = plan && plan !== 'FREE' ? plan : info.minPlan === 'FREE' ? 'STARTER' : info.minPlan
  const pi = PLAN_INFO[p]
  return {
    plan: p,
    title: `${info.name} is part of ${pi.name}`,
    body: info.pitch,
    cta: `See ${pi.name} — ${formatPrice(pi.priceCents)} per party`,
    href: `/pricing?upgrade=${p.toLowerCase()}&from=${capability}`,
  }
}

export function UpgradePrompt({ capability, plan, compact, className }: { capability: Capability; plan?: Plan | null; compact?: boolean; className?: string }) {
  const c = upgradeCopy(capability, plan)
  useEffect(() => {
    track('upgrade_prompt_viewed', { capability, plan: c.plan })
    if (CAPABILITIES[capability].ai) track('ai_feature_blocked', { feature: capability, plan: c.plan })
  }, [capability, c.plan])
  const onClick = () => track('plan_upgrade_clicked', { capability, plan: c.plan, from: 'upgrade_prompt' })
  if (compact) {
    return (
      <Link href={c.href} onClick={onClick} className={cn('tap block', className)} data-testid={`upgrade-${capability}`}>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary" aria-hidden><Lock className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{c.title}</span>
            <span className="block text-sm text-muted-foreground">{c.body}</span>
            <span className="mt-1 block text-sm font-semibold text-primary">{c.cta}</span>
          </span>
        </Card>
      </Link>
    )
  }
  return (
    <Card className={cn('p-5 text-center', className)} data-testid={`upgrade-${capability}`}>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-hero text-white" aria-hidden><Sparkles className="h-6 w-6" /></span>
      <h2 className="mt-3 font-display text-xl font-extrabold">{c.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
      <Link href={c.href} onClick={onClick} className="tap mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground">
        {c.cta}
      </Link>
    </Card>
  )
}

/** Same explanation in a bottom sheet, for locked tiles and rows. */
export function UpgradeSheet({ capability, plan, open, onOpenChange }: { capability: Capability | null; plan?: Plan | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <BottomSheet open={open && !!capability} onOpenChange={onOpenChange} title="Unlock more of your party">
      {capability ? <div className="px-4 pb-4"><UpgradePrompt capability={capability} plan={plan} /></div> : null}
    </BottomSheet>
  )
}
