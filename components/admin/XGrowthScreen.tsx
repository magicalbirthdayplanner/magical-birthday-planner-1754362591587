'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CalendarDays, ExternalLink, History, Play, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AppButton, Card, EmptyState, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { apiFetch, friendlyError } from '@/lib/data/api'

type Status = 'GREEN' | 'YELLOW' | 'RED'
interface PB { budget: number; spent: number; today: number; committed: number; projected: number; remaining: number; status: Status; byOperation: Record<string, { units: number; cost: number }> }
interface Post {
  id: string; status: string; format: string; roleLabel: string | null; category: string | null; scheduledAt: string | null; publishedAt: string | null; dryRunAt: string | null
  text: string; poll: { options: string[] } | null; threadParts: string[] | null; link: boolean; source: string; thumbs: { url: string | null; kind: string }[]; externalPostUrl: string | null
  businessScore: number | null; estCostUsd: number | null; metrics: Record<string, number | null>; attribution: Record<string, number | string | null>; error: string | null
}
interface Rank { key: string; posts: number; avgScore: number; impressions: number; clicks: number; signups: number }
interface Overview {
  config: { dryRun: boolean; autonomousAllowed: boolean; autonomousSwitch: boolean; autonomousEffective: boolean; postsPerDay: number; postTimes: string[]; timezone: string; utmCampaign: string; altText: string; xConfigured: boolean; xUserIdKnown: boolean; aiConfigured: boolean }
  budget: { month: string; daysLeft: number; x: PB & { reserve: number; dailyAllowance: number }; ai: PB; image: { spent: number }; video: { spent: number }; totalSpent: number; notes: string[] }
  today: Post[]
  upcoming: Post[]
  plans: { weekStart: string; status: string; slots: { index: number; date: string; time: string; role: string; format: string; media: string; link: boolean; status: string; postId: string | null; note: string | null }[] }[]
  bank: { queued: number; drafts: number; byFormat: { key: string; count: number }[]; library: Record<string, number> }
  performance: { posts: number; impressions: number; engagements: number; profileVisits: number; linkClicks: number; websiteVisits: number; signups: number; partiesCreated: number; checkouts: number; purchases: number; revenueMinor: number; topPosts: Post[]; topFormats: Rank[]; topRoles: Rank[]; topHooks: Rank[]; topCtas: Rank[] }
  decisions: { dimension: string; key: string; action: string; multiplier: number; reason: string }[]
  recommendations: string[]
  insightsAt: string | null
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`
const time = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—')
const STATUS_BG: Record<Status, string> = { GREEN: 'bg-emerald-100 text-emerald-800', YELLOW: 'bg-amber-100 text-amber-900', RED: 'bg-destructive/10 text-destructive' }
const SLOT_BG: Record<string, string> = { planned: 'bg-muted', generated: 'bg-secondary', library: 'bg-accent', skipped: 'bg-destructive/10' }

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className ?? ''}`}>{children}</span>
}

function PostRow({ p }: { p: Post }) {
  return (
    <Card className="space-y-2 p-3" data-testid="x-post">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Pill className="bg-muted">{time(p.publishedAt ?? p.dryRunAt ?? p.scheduledAt)}</Pill>
        <Pill className="bg-secondary text-primary">{p.roleLabel ?? p.category ?? 'post'}</Pill>
        <Pill className="bg-muted">{p.format}{p.link ? ' · link' : ''}{p.source === 'library' ? ' · library' : ''}</Pill>
        <Pill className={p.status === 'published' ? 'bg-emerald-100 text-emerald-800' : p.status === 'dry_run' ? 'bg-amber-100 text-amber-900' : p.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}>{p.status === 'dry_run' ? 'dry-run' : p.status}</Pill>
        {p.estCostUsd !== null ? <span className="text-muted-foreground">{usd(p.estCostUsd)}</span> : null}
      </div>
      {p.thumbs.length ? (
        <div className="flex gap-1.5">
          {p.thumbs.map((t, i) =>
            t.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={t.url} alt="" className="h-16 w-24 rounded-lg border border-border object-cover" loading="lazy" />
            ) : (
              <span key={i} className="flex h-16 w-24 items-center justify-center rounded-lg border border-border bg-muted text-xs">{t.kind}</span>
            ),
          )}
        </div>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.text}</p>
      {p.poll ? <p className="text-xs text-muted-foreground">Poll: {p.poll.options.join(' · ')}</p> : null}
      {p.threadParts?.length ? <p className="text-xs text-muted-foreground">Thread: +{p.threadParts.length} replies</p> : null}
      {p.error ? <p className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">{p.error}</p> : null}
      {p.status === 'published' ? (
        <p className="text-xs text-muted-foreground">
          Score {p.businessScore ?? 'n/a'} · {p.metrics.impressions ?? 'n/a'} impressions · {p.metrics.linkClicks ?? 'n/a'} clicks · {String(p.attribution.signups ?? 0)} sign-ups
          {p.externalPostUrl ? (
            <a href={p.externalPostUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-primary">
              View <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </p>
      ) : null}
    </Card>
  )
}

function RankTable({ title, rows }: { title: string; rows: Rank[] }) {
  if (!rows.length) return null
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <table className="w-full text-xs">
        <tbody>
          {rows.slice(0, 5).map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="py-1 pr-2">{r.key}</td>
              <td className="py-1 text-right">{r.posts} posts</td>
              <td className="py-1 text-right">score {r.avgScore}</td>
              <td className="py-1 text-right">{r.clicks} clicks</td>
              <td className="py-1 text-right">{r.signups} sign-ups</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function XGrowthScreen() {
  const { user } = useAuth()
  const session = useSWR(user ? ['admin-session', user.id] : null, () => apiFetch<{ admin: boolean }>('/api/admin/session'), { shouldRetryOnError: false })
  const isAdmin = !!session.data?.admin
  const data = useSWR(isAdmin ? 'admin-marketing-x' : null, () => apiFetch<Overview>('/api/admin/marketing/x'), { revalidateOnFocus: true })
  const [busy, setBusy] = useState<string | null>(null)

  async function act(key: string, body: Record<string, unknown>, ok: string, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return
    setBusy(key)
    try {
      await apiFetch('/api/admin/marketing/x', { method: 'POST', body: JSON.stringify(body) })
      toast.success(ok)
      void data.mutate()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  if (session.isLoading || (!session.data && !session.error && user)) return <div className="space-y-4 px-4 pt-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full rounded-3xl" /></div>
  if (!isAdmin) return <EmptyState icon="🔍" title="Page not found" body="This page doesn’t exist." />
  if (data.error) return <EmptyState icon="⚠️" title="X dashboard unavailable" body={friendlyError(data.error)} />
  const d = data.data
  if (!d) return <div className="px-4 pt-6"><Skeleton className="h-64 w-full rounded-3xl" /></div>
  const c = d.config
  const b = d.budget
  const today = new Date().toLocaleDateString('en-CA', { timeZone: c.timezone })
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: c.timezone })
  const pf = d.performance

  return (
    <div className="pb-6" data-testid="x-growth">
      <PageHeader title="X growth engine" subtitle={`${c.postsPerDay} posts/day · ${c.postTimes.join(' · ')} ${c.timezone}`} back="/admin/marketing" />

      <Section title="Status">
        <Card className="flex flex-wrap gap-2 p-4 text-xs">
          <Pill className={c.dryRun ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}>{c.dryRun ? 'DRY-RUN' : 'LIVE'}</Pill>
          <Pill className={c.autonomousEffective ? 'bg-emerald-100 text-emerald-800' : 'bg-muted'}>Autonomous {c.autonomousEffective ? 'ON' : `OFF${c.autonomousAllowed ? ' (switch)' : ' (env)'}`}</Pill>
          <Pill className={c.xConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>X {c.xConfigured ? (c.xUserIdKnown ? 'ready' : 'user id unknown') : 'not configured'}</Pill>
          <Pill className={c.aiConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>AI {c.aiConfigured ? 'ready' : 'off'}</Pill>
          <Pill className="bg-muted">utm_campaign={c.utmCampaign}</Pill>
          <Pill className="bg-muted">alt text: {c.altText}</Pill>
        </Card>
      </Section>

      <Section title="X budget dashboard">
        <Card className="space-y-3 p-4 text-sm" data-testid="x-budget">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{b.month} · {b.daysLeft} days left</span>
            <Pill className={STATUS_BG[b.x.status]}>{b.x.status}</Pill>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span>Monthly X budget: <strong>{usd(b.x.budget)}</strong></span>
            <span>X API spend: <strong>{usd(b.x.spent)}</strong></span>
            <span>AI spend: <strong>{usd(b.ai.spent)}</strong> / {usd(b.ai.budget)}</span>
            <span>Image generation: <strong>{usd(b.image.spent)}</strong></span>
            <span>Video generation: <strong>{usd(b.video.spent)}</strong></span>
            <span>Remaining (X): <strong>{usd(b.x.remaining)}</strong></span>
            <span>Projected (X): <strong>{usd(b.x.projected)}</strong></span>
            <span>Today (X): <strong>{usd(b.x.today)}</strong> of {usd(b.x.dailyAllowance)}/day</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${b.x.status === 'RED' ? 'bg-destructive' : b.x.status === 'YELLOW' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (b.x.projected / Math.max(0.01, b.x.budget)) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Bar = projected month-end spend (spent + queued posts + remaining slots + metrics reads). {usd(b.x.reserve)} is held back as a reserve. RED stops links, metrics reads and alt text; posts continue while they fit.</p>
          {Object.keys(b.x.byOperation).length ? (
            <table className="w-full text-xs">
              <tbody>
                {Object.entries({ ...b.x.byOperation, ...Object.fromEntries(Object.entries(b.ai.byOperation).map(([k, v]) => [`ai:${k}`, v])) }).map(([k, v]) => (
                  <tr key={k} className="border-t border-border"><td className="py-1">{k}</td><td className="py-1 text-right">{v.units}</td><td className="py-1 text-right">{usd(v.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-xs text-muted-foreground">No spend recorded this month.</p>}
          {b.notes.map((n, i) => <p key={i} className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">{n}</p>)}
        </Card>
      </Section>

      <Section title="Actions">
        <Card className="flex flex-wrap gap-2 p-4">
          <AppButton size="sm" variant="outline" loading={busy === 'plan'} onClick={() => act('plan', { action: 'plan_week' }, 'This week is planned')}><CalendarDays className="h-4 w-4" /> Plan this week</AppButton>
          <AppButton size="sm" variant="magic" loading={busy === 'gen-today'} onClick={() => act('gen-today', { action: 'generate_day', date: today }, 'Today’s posts written')}><Sparkles className="h-4 w-4" /> Write today</AppButton>
          <AppButton size="sm" variant="outline" loading={busy === 'gen-tomorrow'} onClick={() => act('gen-tomorrow', { action: 'generate_day', date: tomorrow }, 'Tomorrow’s posts written')}>Write tomorrow</AppButton>
          <AppButton size="sm" variant="outline" loading={busy === 'import'} onClick={() => act('import', { action: 'import_history' }, 'X history imported', 'Read the account’s last 100 posts once (owned read, about $0.001 per post)?')}><History className="h-4 w-4" /> Import X history</AppButton>
          <AppButton size="sm" variant="outline" loading={busy === 'prepare'} onClick={() => act('prepare', { action: 'run', task: 'prepare' }, 'Prepare step ran')}><RefreshCw className="h-4 w-4" /> Run prepare</AppButton>
          <AppButton size="sm" variant="outline" loading={busy === 'publish'} onClick={() => act('publish', { action: 'run', task: 'publish' }, 'Publish step ran', c.dryRun ? undefined : 'This can publish the next due post to the real X account. Continue?')}><Play className="h-4 w-4" /> Run publish</AppButton>
        </Card>
      </Section>

      <Section title={`Today (${d.today.length})`}>{d.today.length ? <div className="space-y-2">{d.today.map((p) => <PostRow key={p.id} p={p} />)}</div> : <p className="text-sm text-muted-foreground">Nothing written for today yet.</p>}</Section>
      <Section title={`Upcoming (${d.upcoming.length})`}>{d.upcoming.length ? <div className="space-y-2">{d.upcoming.slice(0, 16).map((p) => <PostRow key={p.id} p={p} />)}</div> : <p className="text-sm text-muted-foreground">Nothing queued for the next 3 days.</p>}</Section>

      <Section title="Content bank">
        <Card className="space-y-3 p-4 text-sm" data-testid="x-bank">
          <p>Queued: <strong>{d.bank.queued}</strong> · Drafts: <strong>{d.bank.drafts}</strong> · {d.bank.byFormat.map((f) => `${f.key} ${f.count}`).join(' · ')}</p>
          <p className="text-xs text-muted-foreground">Library: {d.bank.library.approved} approved assets ({d.bank.library.videos} videos, {d.bank.library.carousels} carousels), {d.bank.library.neverUsed} never used, {d.bank.library.rejected} rejected by privacy review · {d.bank.library.templatesRendered} branded cards rendered.</p>
          {d.plans.map((pl) => (
            <div key={pl.weekStart}>
              <p className="mb-1 text-xs font-semibold">Week of {pl.weekStart} · {pl.status}</p>
              <div className="grid grid-cols-7 gap-1">
                {[...new Set(pl.slots.map((s) => s.date))].map((date) => (
                  <div key={date} className="space-y-1">
                    <p className="text-center text-[10px] text-muted-foreground">{date.slice(5)}</p>
                    {pl.slots.filter((s) => s.date === date).map((s) => (
                      <div key={s.index} title={`${s.time} ${s.role} · ${s.format} · ${s.media}${s.link ? ' · link' : ''} · ${s.status}${s.note ? ` · ${s.note}` : ''}`} className={`rounded px-1 py-0.5 text-center text-[10px] ${SLOT_BG[s.status] ?? 'bg-muted'}`}>
                        {s.format.slice(0, 4)}{s.link ? '🔗' : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Performance (30 days)">
        <Card className="space-y-3 p-4 text-sm" data-testid="x-performance">
          <div className="grid grid-cols-2 gap-1">
            <span>Posts: <strong>{pf.posts}</strong></span>
            <span>Impressions: <strong>{pf.impressions}</strong></span>
            <span>Engagements: <strong>{pf.engagements}</strong></span>
            <span>Profile visits: <strong>{pf.profileVisits}</strong></span>
            <span>Link clicks: <strong>{pf.linkClicks}</strong></span>
            <span>Website visits: <strong>{pf.websiteVisits}</strong></span>
            <span>Sign-ups: <strong>{pf.signups}</strong></span>
            <span>Parties created: <strong>{pf.partiesCreated}</strong></span>
            <span>Checkouts: <strong>{pf.checkouts}</strong></span>
            <span>Purchases: <strong>{pf.purchases}</strong></span>
          </div>
          <RankTable title="Top formats" rows={pf.topFormats} />
          <RankTable title="Top slot roles" rows={pf.topRoles} />
          <RankTable title="Top hook styles" rows={pf.topHooks} />
          <RankTable title="Top CTAs" rows={pf.topCtas} />
          {pf.topPosts.length ? <div className="space-y-2"><p className="text-xs font-semibold text-muted-foreground">Top content (business score)</p>{pf.topPosts.map((p) => <PostRow key={p.id} p={p} />)}</div> : null}
        </Card>
      </Section>

      <Section title="Decisions">
        <Card className="space-y-2 p-4 text-sm">
          {d.decisions.length ? d.decisions.map((x, i) => <p key={i}><Pill className={x.action === 'increase' ? 'bg-emerald-100 text-emerald-800' : x.action === 'decrease' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}>{x.action}</Pill> {x.reason}</p>) : <p className="text-muted-foreground">No decisions yet — the engine needs at least 6 scored posts (and 3 per group).</p>}
          {d.recommendations.filter((r) => !d.decisions.some((x) => x.reason === r)).map((r, i) => <p key={i} className="text-xs text-muted-foreground">• {r}</p>)}
        </Card>
      </Section>
    </div>
  )
}
