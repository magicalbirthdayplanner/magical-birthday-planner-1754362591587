'use client'
/**
 * The four plans (Free · Starter · Plus · Pro), always all visible. Contents and prices come from the product
 * model (lib/entitlements.ts). Paid plans are bought PER PARTY: inside <PartyProvider> the cards show the active
 * party's plan and checkout buys for that party; CTAs adapt to the visitor (anonymous, Free, trial, paid).
 */
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { CheckoutButton } from './CheckoutButton'
import { usePlanStatus } from './usePlanStatus'
import { useOptionalParty } from '@/components/app/PartyProvider'
import { useAuth } from '@/contexts/AuthContext'
import { track } from '@/lib/analytics/client'
import { formatPrice, PLAN_INFO, planRank, type Plan } from '@/lib/entitlements'
import { COMPARISON, PLAN_HIGHLIGHTS } from './planContent'
import { cn } from '@/lib/utils'

const ACCENT: Record<Plan, string> = {
  FREE: 'border-border',
  STARTER: 'border-purple-400',
  PLUS: 'border-blue-500 ring-2 ring-blue-500/20',
  PRO: 'border-emerald-500',
}

export function PlanCards({ highlight }: { highlight?: Plan | null }) {
  const { user } = useAuth()
  const ctx = useOptionalParty()
  const party = ctx?.party ?? null
  const status = usePlanStatus()
  const owned = user ? status.ownedPlan : null
  const firstName = party?.child_name.split(' ')[0]
  // Signed in inside the app context but no party yet: a plan needs a party to belong to.
  const needsParty = !!user && !!ctx && !ctx.isLoading && !party

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-5 text-center text-sm text-muted-foreground" data-testid="per-party-note">
        Pay once for each party. No monthly subscription.
      </p>
      {user && party ? (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-sm" data-testid="pricing-party">
          <span>Choosing a plan for <strong>{firstName}’s party</strong>.</span>
          {ctx && ctx.parties.length > 1 ? (
            <label className="inline-flex items-center gap-1">
              <span className="sr-only">Party</span>
              <select className="min-h-[44px] rounded-full border border-border bg-background px-3" value={party.id} onChange={(e) => ctx.setActivePartyId(e.target.value)}>
                {ctx.parties.map((p) => <option key={p.id} value={p.id}>{p.child_name.split(' ')[0]}’s party · {p.party_date}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="plan-cards">
      {(['FREE', 'STARTER', 'PLUS', 'PRO'] as const).map((p) => {
        const info = PLAN_INFO[p]
        const h = PLAN_HIGHLIGHTS[p]
        const isCurrent = !!user && status.loaded && owned === p && !(p === 'FREE' && status.onTrial)
        const included = !!user && status.loaded && owned !== null && planRank(owned) > planRank(p)
        return (
          <section
            key={p}
            aria-labelledby={`plan-${p}`}
            data-testid={`plan-card-${p}`}
            className={cn('relative flex flex-col rounded-3xl border-2 bg-card p-5 shadow-sm', ACCENT[p], highlight === p && 'ring-4 ring-primary/30')}
          >
            {p === 'PLUS' ? <span className="absolute -top-3 left-5 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">Most popular</span> : null}
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{info.stage}</p>
            <h3 id={`plan-${p}`} className="mt-1 font-display text-2xl font-extrabold">{info.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{info.tagline}</p>
            <p className="mt-3">
              <span className="font-display text-3xl font-extrabold">{formatPrice(info.priceCents)}</span>
              <span className="ml-1 text-sm text-muted-foreground">{p === 'FREE' ? 'forever' : 'per party'}</span>
            </p>
            {h.intro ? <p className="mt-4 text-sm font-semibold">{h.intro}</p> : <div className="mt-4" />}
            <ul className="mt-2 flex-1 space-y-2 text-sm">
              {h.items.map((it) => (
                <li key={it} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /><span>{it}</span></li>
              ))}
              {h.ai ? <li className="flex gap-2 text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /><span>{h.ai}</span></li> : null}
            </ul>
            <div className="mt-5">
              {isCurrent ? (
                <span className="flex min-h-[44px] items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground" data-testid={`plan-current-${p}`}>{party ? 'This party’s plan' : 'Your current plan'}</span>
              ) : included ? (
                <span className="flex min-h-[44px] items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{party ? 'Included in this party’s plan' : 'Included in your plan'}</span>
              ) : p === 'FREE' ? (
                <Link href={user ? '/home' : '/start'} className="tap flex min-h-[44px] items-center justify-center rounded-full border-2 border-border bg-background text-sm font-semibold" onClick={() => track('plan_upgrade_clicked', { plan: 'FREE', from: 'pricing' })}>
                  {user ? 'Keep planning' : 'Start free'}
                </Link>
              ) : needsParty ? (
                <Link href="/start" className="tap flex min-h-[44px] items-center justify-center rounded-full border-2 border-border bg-background text-sm font-semibold" data-testid={`create-party-${p}`}>
                  Create your party first
                </Link>
              ) : user && !ctx ? (
                <Link href={`/pricing?upgrade=${p.toLowerCase()}`} className="tap flex min-h-[44px] items-center justify-center rounded-full border-2 border-border bg-background text-sm font-semibold">
                  {`Choose ${info.name} — ${formatPrice(info.priceCents)}`}
                </Link>
              ) : (
                <CheckoutButton
                  plan={p}
                  partyId={party?.id ?? null}
                  className={cn(
                    'h-11 rounded-full text-sm',
                    p === 'STARTER' && 'bg-purple-600 hover:bg-purple-700',
                    p === 'PLUS' && 'bg-blue-600 hover:bg-blue-700',
                    p === 'PRO' && 'bg-emerald-600 hover:bg-emerald-700',
                  )}
                >
                  {owned && owned !== 'FREE' ? `Upgrade to ${info.name}` : `Choose ${info.name} — ${formatPrice(info.priceCents)}`}
                </CheckoutButton>
              )}
            </div>
          </section>
        )
      })}
    </div>
    </div>
  )
}

export function PlanComparison() {
  const cols = ['FREE', 'STARTER', 'PLUS', 'PRO'] as const
  return (
    <div className="mx-auto max-w-3xl" data-testid="plan-comparison">
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_repeat(4,3rem)] items-end gap-1 border-b border-border bg-background/95 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide sm:grid-cols-[1fr_repeat(4,5.5rem)] sm:text-xs">
        <span />
        {cols.map((c) => <span key={c}>{PLAN_INFO[c].name}</span>)}
      </div>
      {COMPARISON.map((sec) => (
        <div key={sec.category} className="mt-4">
          <h3 className="px-3 text-sm font-bold text-primary">{sec.category}</h3>
          <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-card">
            {sec.rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[1fr_repeat(4,3rem)] items-center gap-1 px-3 py-2.5 text-sm sm:grid-cols-[1fr_repeat(4,5.5rem)]">
                <span className="min-w-0 break-words">{r.label}</span>
                {cols.map((c) =>
                  planRank(c) >= planRank(r.min) ? (
                    <span key={c} className="flex justify-center"><Check className="h-4 w-4 text-emerald-600" aria-label={`${PLAN_INFO[c].name}: included`} /></span>
                  ) : (
                    <span key={c} className="flex justify-center"><Minus className="h-4 w-4 text-muted-foreground/60" aria-label={`${PLAN_INFO[c].name}: not included`} /></span>
                  ),
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
