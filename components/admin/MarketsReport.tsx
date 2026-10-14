'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Card, Chip, Skeleton } from '@/components/app/ui'
import { apiFetch } from '@/lib/data/api'
import { COUNTRIES, type CountryCode } from '@/lib/country/countries'
import { formatMinor } from '@/lib/country/format'

interface Market {
  market: CountryCode
  visitors: number
  signupsStarted: number
  signups: number
  profiles: number
  partiesCreated: number
  partiesTotal: number
  venueSearches: number
  venuesSaved: number
  invitationsShared: number
  whatsappShares: number
  rsvps: number
  checkoutsStarted: number
  purchases: number
  paymentsFailed: number
  revenue: Record<string, number>
  sources: { source: string; signups: number }[]
}

const ROWS: [keyof Market, string][] = [
  ['visitors', 'Visitors (landing / app opens)'],
  ['signups', 'Sign-ups completed'],
  ['partiesCreated', 'Parties created'],
  ['venueSearches', 'Venue searches'],
  ['venuesSaved', 'Venues saved'],
  ['invitationsShared', 'Invitations shared'],
  ['whatsappShares', 'WhatsApp shares opened'],
  ['rsvps', 'RSVPs completed'],
  ['checkoutsStarted', 'Checkouts started'],
  ['purchases', 'Purchases'],
  ['paymentsFailed', 'Failed payments'],
]

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

/** US vs India, side by side (Super Admin). Only data we actually hold; nothing is inferred from IP addresses. */
export function MarketsReport() {
  const [days, setDays] = useState(30)
  const { data, error, isLoading } = useSWR(['admin-markets', days], () => apiFetch<{ markets: Market[] }>(`/api/admin/markets?days=${days}`))
  const markets = data?.markets ?? []
  return (
    <Card className="space-y-3 p-4 text-sm" data-testid="admin-markets">
      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Chip key={d} active={days === d} onClick={() => setDays(d)}>
            {d} days
          </Chip>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : error ? <p className="text-destructive">Couldn’t load the market report.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-left">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 font-semibold">Last {days} days</th>
                {markets.map((m) => <th key={m.market} className="py-2 text-right font-semibold">{COUNTRIES[m.market]?.flag} {m.market}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, label]) => (
                <tr key={k} className="border-b border-border/60">
                  <td className="py-1.5">{label}</td>
                  {markets.map((m) => <td key={m.market} className="py-1.5 text-right tabular-nums">{m[k] as number}</td>)}
                </tr>
              ))}
              <tr className="border-b border-border/60">
                <td className="py-1.5">Party → checkout</td>
                {markets.map((m) => <td key={m.market} className="py-1.5 text-right tabular-nums">{pct(m.checkoutsStarted, m.partiesCreated)}</td>)}
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-1.5">Checkout → purchase</td>
                {markets.map((m) => <td key={m.market} className="py-1.5 text-right tabular-nums">{pct(m.purchases, m.checkoutsStarted)}</td>)}
              </tr>
              <tr>
                <td className="py-1.5">Revenue</td>
                {markets.map((m) => <td key={m.market} className="py-1.5 text-right tabular-nums">{Object.entries(m.revenue).map(([cur, v]) => (cur === 'USD' || cur === 'INR' ? formatMinor(v, cur) : `${v} ${cur}`)).join(' · ') || '—'}</td>)}
              </tr>
            </tbody>
          </table>
          {markets.map((m) => (m.sources.length ? <p key={m.market} className="mt-2 text-xs text-muted-foreground">{m.market} sign-up sources: {m.sources.map((s) => `${s.source} ${s.signups}`).join(' · ')}</p> : null))}
          <p className="mt-2 text-xs text-muted-foreground">Party steps count by the party’s event country; visits and sign-ups by the visitor’s chosen market (events from before 2026-10-14 carry no market). Revenue is not converted between currencies.</p>
        </div>
      )}
    </Card>
  )
}
