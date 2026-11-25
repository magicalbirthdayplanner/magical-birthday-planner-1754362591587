'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { AlertOctagon, AlertTriangle, ChevronRight, Info, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AppButton, Card, Chip, EmptyState, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { apiFetch } from '@/lib/data/api'
import { FUNNEL } from '@/lib/admin/insights'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------- API shapes
interface FunnelStep { id: string; label: string; devices: number; fromPrevious: number | null; stoppedHere: number }
interface Problem { severity: 'critical' | 'serious' | 'warning'; title: string; detail: string; count: number; lastAt: string | null }
interface UserRow { id: string; name: string | null; email: string | null; joinedAt: string; confirmed: boolean; lastActive: string | null; plan: string; parties: number; eventsInRange: number; aiOk: number; aiFailed: number; source: string | null }
interface PartyRow {
  id: string; owner: string | null; ownerId: string; child: string; age: number; date: string | null; daysAway: number | null; time: string | null; place: string | null; country: string | null
  theme: string | null; interests: string[]; guestCount: number | null; budget: number | null; status: string | null; venues: string[]; guestsAdded: number; rsvpsYes: number
  invitations: number; invitesShared: number; activities: number; checklistDone: number; checklistTotal: number; aiOk: number; aiFailed: number; createdAt: string; updatedAt: string
}
interface DeviceRow { id: string; userId: string | null; userName: string | null; firstAt: string; lastAt: string; source: string; events: number; pages: string[]; furthest: number; country: string | null }
interface Insights {
  range: { days: number; since: string; dayList: string[] }
  totals: { visitors: number; santaVisitors: number; accounts: number; parties: number; allUsers: number; allParties: number }
  funnel: FunnelStep[]
  days: { day: string; visitors: number; started: number; accounts: number; parties: number }[]
  sources: { source: string; devices: number; started: number; accounts: number; parties: number }[]
  features: { event: string; label: string; times: number; people: number }[]
  problems: Problem[]
  users: UserRow[]
  parties: PartyRow[]
  devices: DeviceRow[]
}
interface Timeline {
  devices: number
  truncated: boolean
  events: { at: string; event: string; label: string; detail: string; path: string | null; signedIn: boolean; device: string | null }[]
  ai: { feature: string; status: string; error_code: string | null; provider: string | null; model: string | null; duration_ms: number | null; created_at: string }[]
  emails: { email_type: string | null; subject: string | null; status: string | null; error_message: string | null; created_at: string | null }[]
}

// ---------------------------------------------------------------- formatting (New York time, like the reports)
const TZ = 'America/New_York'
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const partyDate = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date')
const pct = (x: number | null) => (x == null ? '' : `${Math.round(x * 100)}%`)
const ago = (iso: string | null) => {
  if (!iso) return '—'
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (m < 60) return `${Math.max(1, m)} min ago`
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}
const stepLabel = (i: number) => FUNNEL[i]?.label ?? '—'

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]
type Tab = 'overview' | 'users' | 'parties' | 'visitors'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'parties', label: 'Parties' },
  { id: 'visitors', label: 'Visitors' },
]

// ---------------------------------------------------------------- small pieces
function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  )
}

const SEVERITY = {
  critical: { Icon: AlertOctagon, label: 'Critical', cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
  serious: { Icon: AlertTriangle, label: 'Needs attention', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300' },
  warning: { Icon: Info, label: 'Worth a look', cls: 'border-border bg-muted text-foreground' },
} as const

function Problems({ items }: { items: Problem[] }) {
  if (!items.length) return <Card className="p-4 text-sm text-muted-foreground">No problems found in this period.</Card>
  return (
    <div className="space-y-2" data-testid="insights-problems">
      {items.map((p) => {
        const s = SEVERITY[p.severity]
        return (
          <div key={p.title} className={cn('rounded-2xl border p-3 text-sm', s.cls)} role={p.severity === 'critical' ? 'alert' : undefined}>
            <p className="flex items-center gap-2 font-semibold">
              <s.Icon className="h-4 w-4 shrink-0" aria-hidden /> <span className="sr-only">{s.label}: </span>
              {p.title}
            </p>
            <p className="mt-1 text-foreground/80">{p.detail}</p>
            {p.lastAt ? <p className="mt-0.5 text-xs text-muted-foreground">Last: {when(p.lastAt)}</p> : null}
          </div>
        )
      })}
    </div>
  )
}

/** Horizontal bars, one hue: how many devices reached each step, with the share kept from the step before. */
function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, steps[0]?.devices ?? 1)
  return (
    <Card className="space-y-2.5 p-4" data-testid="insights-funnel">
      {steps.map((s, i) => (
        <div key={s.id} title={`${s.label}: ${s.devices} people${s.fromPrevious != null ? ` (${pct(s.fromPrevious)} of the step before)` : ''} · ${s.stoppedHere} stopped here`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{s.label}</span>
            <span className="shrink-0 tabular-nums">
              <strong>{s.devices}</strong>
              {i > 0 ? <span className="ml-1.5 text-xs text-muted-foreground">{pct(s.fromPrevious)}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-full bg-muted">
            <div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.max(s.devices ? 2 : 0, (s.devices / max) * 100)}%` }} />
          </div>
          {s.stoppedHere > 0 && i < steps.length - 1 ? <p className="mt-0.5 text-xs text-muted-foreground">{s.stoppedHere} stopped here</p> : null}
        </div>
      ))}
      <p className="pt-1 text-xs text-muted-foreground">Birthday planner only (Magical Santa visitors are in Visitors). People = browsers. A step counts everyone who got that far or further; the % is the share of the step above.</p>
    </Card>
  )
}

function Table({ head, rows, testId }: { head: string[]; rows: (string | number)[][]; testId?: string }) {
  return (
    <Card className="overflow-x-auto p-0" data-testid={testId}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {head.map((h, i) => <th key={h} className={cn('px-3 py-2 font-semibold', i > 0 && 'text-right')}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-border/50 last:border-0">
              {r.map((c, i) => <td key={i} className={cn('px-3 py-1.5', i > 0 && 'text-right tabular-nums')}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/** Everything one person (or one browser) did, grouped by day, plus their AI requests and emails. */
function ActivityTimeline({ userId, device }: { userId?: string; device?: string }) {
  const key = userId ? `userId=${userId}` : `device=${device}`
  const { data, error, isLoading } = useSWR(['admin-timeline', key], () => apiFetch<Timeline>(`/api/admin/insights/timeline?${key}`))
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error || !data) return <p className="text-sm text-destructive">Couldn’t load the activity.</p>
  const groups = new Map<string, Timeline['events']>()
  for (const e of data.events) {
    const d = dayLabel(e.at)
    groups.set(d, [...(groups.get(d) ?? []), e])
  }
  return (
    <div className="space-y-3" data-testid="insights-timeline">
      <p className="text-xs text-muted-foreground">
        {data.events.length} actions{userId ? ` on ${data.devices} browser${data.devices === 1 ? '' : 's'}, including before they signed in` : ''}
        {data.truncated ? ' (latest 1,500 shown)' : ''} · times are New York time
      </p>
      {data.ai.length ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">AI requests</p>
          <ul className="mt-1 space-y-1 text-sm">
            {data.ai.map((a, i) => (
              <li key={i} className={cn('rounded-lg px-2 py-1', a.status === 'failed' ? 'bg-destructive/10' : 'bg-muted')}>
                {when(a.created_at)} · {a.feature.replace(/_/g, ' ')} · <strong>{a.status}</strong>
                {a.error_code ? ` · ${a.error_code}` : ''}
                {a.duration_ms ? ` · ${(a.duration_ms / 1000).toFixed(1)}s` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.emails.length ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Emails</p>
          <ul className="mt-1 space-y-1 text-sm">
            {data.emails.map((m, i) => (
              <li key={i}>{when(m.created_at)} · {m.email_type ?? 'email'} · {m.status}{m.error_message ? ` · ${m.error_message}` : ''}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {[...groups.entries()].reverse().map(([d, evs]) => (
        <div key={d}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{d}</p>
          <ol className="mt-1 space-y-1 border-l-2 border-border pl-3">
            {[...evs].reverse().map((e, i) => (
              <li key={i} className="text-sm">
                <span className="tabular-nums text-xs text-muted-foreground">{timeOnly(e.at)}</span> <strong className="font-semibold">{e.label}</strong>
                {e.detail ? <span className="text-muted-foreground"> · {e.detail}</span> : null}
                {e.path ? <span className="block truncate text-xs text-muted-foreground">{e.path}{e.signedIn ? ' · signed in' : ''}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function PartyCard({ p, onOwner }: { p: PartyRow; onOwner?: () => void }) {
  const progress: [string, string][] = [
    ['Venue', p.venues.length ? p.venues.join(', ') : '—'],
    ['Theme', p.theme ? p.theme.replace(/-/g, ' ') : '—'],
    ['Guests added', p.guestsAdded ? `${p.guestsAdded}${p.rsvpsYes ? ` (${p.rsvpsYes} yes)` : ''}` : '0'],
    ['Invitations', p.invitations ? `${p.invitations} (shared ${p.invitesShared}×)` : '0'],
    ['Activities', String(p.activities)],
    ['Checklist', p.checklistTotal ? `${p.checklistDone}/${p.checklistTotal}` : '—'],
    ['AI', p.aiOk || p.aiFailed ? `${p.aiOk} worked · ${p.aiFailed} failed` : 'not used'],
  ]
  return (
    <Card className="space-y-2 p-4 text-sm" data-testid="insights-party">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{p.child}, {p.age}</p>
          <p className="text-muted-foreground">{partyDate(p.date)}{p.daysAway != null ? ` · ${p.daysAway >= 0 ? `in ${p.daysAway} days` : `${-p.daysAway} days ago`}` : ''}</p>
          <p className="text-muted-foreground">{p.place}{p.interests.length ? ` · loves ${p.interests.join(', ')}` : ''}</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{(p.status ?? 'planning').toLowerCase()}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {progress.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={cn('min-w-0 truncate', (v === '0' || v === '—' || v === 'not used') && 'text-muted-foreground')}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Created {when(p.createdAt)}
        {p.updatedAt !== p.createdAt ? ` · last change ${when(p.updatedAt)}` : ' · not changed since'}
        {p.owner ? (
          <>
            {' · by '}
            {onOwner ? <button type="button" className="font-semibold text-primary underline" onClick={onOwner}>{p.owner}</button> : p.owner}
          </>
        ) : null}
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------- screen
export function InsightsScreen() {
  const { user } = useAuth()
  const session = useSWR(user ? ['admin-session', user.id] : null, () => apiFetch<{ admin: boolean }>('/api/admin/session'), { shouldRetryOnError: false })
  const isAdmin = !!session.data?.admin
  const [days, setDays] = useState(7)
  const [tab, setTab] = useState<Tab>('overview')
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [openDevice, setOpenDevice] = useState<string | null>(null)
  const { data, error, isLoading, mutate, isValidating } = useSWR(isAdmin ? ['admin-insights', days] : null, () => apiFetch<Insights>(`/api/admin/insights?days=${days}`), { revalidateOnFocus: false })

  if (session.isLoading || (!session.data && !session.error && user)) return <div className="space-y-4 px-4 pt-6" aria-busy="true"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full rounded-3xl" /></div>
  if (!isAdmin) return <EmptyState icon="🔍" title="Page not found" body="This page doesn’t exist." />

  const showUser = (id: string) => {
    setTab('users')
    setOpenUser(id)
    setTimeout(() => document.getElementById(`user-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <div className="pb-6" data-testid="insights-screen">
      <PageHeader
        title="Usage"
        subtitle="Real people only — your accounts and test accounts are left out"
        back="/admin"
        action={
          <AppButton variant="outline" size="sm" onClick={() => void mutate()} aria-label="Refresh" loading={isValidating && !isLoading}>
            <RefreshCw className="h-4 w-4" />
          </AppButton>
        }
      />
      <div className="space-y-3 px-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <Chip key={p.days} role="radio" aria-checked={days === p.days} active={days === p.days} onClick={() => setDays(p.days)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label="View">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn('min-h-[44px] rounded-xl text-sm font-semibold transition-colors', tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-4 pt-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : error || !data ? (
        <p className="px-4 pt-4 text-sm text-destructive">Couldn’t load the usage report.</p>
      ) : tab === 'overview' ? (
        <>
          <Section title={`${PERIODS.find((p) => p.days === days)?.label ?? `${days} days`} at a glance`}>
            <div className="grid grid-cols-3 gap-2" data-testid="insights-totals">
              <Stat label="Visitors" value={data.totals.visitors} sub={data.totals.santaVisitors ? `+${data.totals.santaVisitors} on Santa` : 'browsers'} />
              <Stat label="New accounts" value={data.totals.accounts} sub={`${data.totals.allUsers} in total`} />
              <Stat label="New parties" value={data.totals.parties} sub={`${data.totals.allParties} in total`} />
            </div>
          </Section>
          <Section title="Problems">
            <Problems items={data.problems} />
          </Section>
          <Section title="Where people drop off">
            <Funnel steps={data.funnel} />
          </Section>
          <Section title="By day">
            <Table testId="insights-days" head={['Day', 'Visitors', 'Started', 'Accounts', 'Parties']} rows={[...data.days].reverse().map((d) => [shortDay(d.day), d.visitors, d.started, d.accounts, d.parties])} />
          </Section>
          <Section title="Where visitors come from">
            <Table testId="insights-sources" head={['Source', 'Visitors', 'Started', 'Accounts', 'Parties']} rows={data.sources.map((s) => [s.source, s.devices, s.started, s.accounts, s.parties])} />
          </Section>
          <Section title="What people use">
            {data.features.some((f) => f.times) ? (
              <Table testId="insights-features" head={['Feature', 'Times', 'People']} rows={data.features.filter((f) => f.times).sort((a, b) => b.people - a.people || b.times - a.times).map((f) => [f.label, f.times, f.people])} />
            ) : null}
            {data.features.some((f) => !f.times) ? (
              <p className="mt-2 text-xs text-muted-foreground" data-testid="insights-unused">
                <strong>Not used by anyone in this period:</strong> {data.features.filter((f) => !f.times).map((f) => f.label.toLowerCase()).join(' · ')}
              </p>
            ) : null}
          </Section>
        </>
      ) : tab === 'users' ? (
        <Section title={`${data.users.length} people`}>
          <div className="space-y-2" data-testid="insights-users">
            {data.users.length === 0 ? <Card className="p-4 text-sm text-muted-foreground">No sign-ups yet.</Card> : null}
            {data.users.map((u) => {
              const open = openUser === u.id
              const theirParties = data.parties.filter((p) => p.ownerId === u.id)
              return (
                <Card key={u.id} id={`user-${u.id}`} className="scroll-mt-20 p-0">
                  <button type="button" className="tap flex w-full items-start justify-between gap-3 p-4 text-left" aria-expanded={open} onClick={() => setOpenUser(open ? null : u.id)}>
                    <span className="min-w-0 text-sm">
                      <span className="block font-bold">{u.name ?? u.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Joined {when(u.joinedAt)} · active {ago(u.lastActive)}{u.source ? ` · via ${u.source}` : ''}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1 text-xs">
                        {!u.confirmed ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">never entered code</span> : null}
                        <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">{u.plan}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5">{u.parties} {u.parties === 1 ? 'party' : 'parties'}</span>
                        {u.aiOk || u.aiFailed ? <span className={cn('rounded-full px-2 py-0.5', u.aiFailed ? 'bg-destructive/10 text-destructive' : 'bg-muted')}>AI {u.aiOk} ok · {u.aiFailed} failed</span> : null}
                      </span>
                    </span>
                    <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
                  </button>
                  {open ? (
                    <div className="space-y-3 border-t border-border p-4" data-testid="insights-user-detail">
                      {theirParties.map((p) => <PartyCard key={p.id} p={p} />)}
                      <ActivityTimeline userId={u.id} />
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </Section>
      ) : tab === 'parties' ? (
        <Section title={`${data.parties.length} parties`}>
          <div className="space-y-2" data-testid="insights-parties">
            {data.parties.length === 0 ? <Card className="p-4 text-sm text-muted-foreground">No parties yet.</Card> : null}
            {data.parties.map((p) => <PartyCard key={p.id} p={p} onOwner={() => showUser(p.ownerId)} />)}
          </div>
        </Section>
      ) : (
        <Section title={`Latest ${data.devices.length} visitors`}>
          <div className="space-y-2" data-testid="insights-visitors">
            {data.devices.map((d) => {
              const open = openDevice === d.id
              const deviceId = d.id.startsWith('user:') ? null : d.id
              return (
                <Card key={d.id} className="p-0">
                  <button type="button" className="tap flex w-full items-start justify-between gap-3 p-3 text-left text-sm" aria-expanded={open} onClick={() => setOpenDevice(open ? null : d.id)}>
                    <span className="min-w-0">
                      <span className="block font-semibold">{d.userName ?? 'Anonymous visitor'} <span className="font-normal text-muted-foreground">· {d.source}{d.country ? ` · ${d.country}` : ''}</span></span>
                      <span className="block text-xs text-muted-foreground">{when(d.firstAt)} → {when(d.lastAt)} · {d.events} actions</span>
                      <span className="block text-xs">Got as far as: <strong>{stepLabel(d.furthest)}</strong></span>
                      <span className="block truncate text-xs text-muted-foreground">{d.pages.join(' → ')}</span>
                    </span>
                    <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
                  </button>
                  {open ? <div className="border-t border-border p-3">{deviceId ? <ActivityTimeline device={deviceId} /> : d.userId ? <ActivityTimeline userId={d.userId} /> : null}</div> : null}
                </Card>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}
