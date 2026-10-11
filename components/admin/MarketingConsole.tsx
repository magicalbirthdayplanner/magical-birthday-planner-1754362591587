'use client'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CalendarDays, ChevronDown, ChevronRight, ExternalLink, History, Pause, Play, PlugZap, RefreshCw, Sparkles, Square } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AppButton, Card, EmptyState, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { TextArea } from '@/components/app/fields'
import { apiFetch, friendlyError } from '@/lib/data/api'

type Tab = 'general' | 'x' | 'instagram' | 'facebook'
type Status = 'GREEN' | 'YELLOW' | 'RED'
const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'x', label: 'X' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

interface Post {
  id: string; platform: string; status: string; format: string; roleLabel: string | null; pillarLabel: string; topic: string
  scheduledAt: string | null; publishedAt: string | null; dryRunAt: string | null; text: string; poll: { options: string[] } | null; threadParts: string[] | null
  link: boolean; source: string; autonomous: boolean; approved: boolean; thumbs: { url: string | null; kind: string }[]; externalPostUrl: string | null
  businessScore: number | null; estCostUsd: number | null; metrics: Record<string, number | null>; attribution: Record<string, number | string | null>
  error: string | null; errorCode: string | null; validation: { ok: boolean; errors: string[]; warnings: string[]; length: number | null }
}
interface Slot { index: number | null; time: string; at: string; roleLabel: string | null; format: string; media: string; link: boolean; status: string; note: string | null; post: Post | null }
interface Day { date: string; weekday: string; slots: Slot[]; unwritten: number }
interface PB { budget: number; spent: number; today: number; projected: number; remaining: number; status: Status; byOperation: Record<string, { units: number; cost: number }> }
interface Budget { month: string; daysLeft: number; x: PB & { reserve: number; dailyAllowance: number }; ai: PB; image: { spent: number }; video: { spent: number }; notes: string[] }
interface PlatformData {
  platform: Tab; label: string; enabled: boolean; paused: boolean; credentials: boolean; dryRun: boolean; autonomousEffective: boolean
  cadence: { postsPerDay: number; postTimes: string[]; timezone: string; maxChars: number }
  days: Day[]; recent: Post[]
  performance: { posts: number; impressions: number; engagements: number; linkClicks: number; websiteVisits: number; signups: number; partiesCreated: number; purchases: number; topFormats: { key: string; posts: number; avgScore: number; signups: number }[]; topRoles: { key: string; posts: number; avgScore: number; signups: number }[] }
  budget: Budget | null
}
interface GeneralData {
  config: { dryRun: boolean; autonomousAllowed: boolean; autonomousSwitch: boolean; autonomousEffective: boolean; timezone: string; aiConfigured: boolean; bankDays: number }
  platforms: { platform: Tab; label: string; enabled: boolean; paused: boolean; credentials: boolean; postsPerDay: number; postTimes: string[]; queued: number; drafts: number; daysWritten: number; bankDays: number }[]
  budget: Budget
  brief: { date: string; text: string } | null
  decisions: { action: string; reason: string }[]
  recommendations: string[]
  audit: { id: number; action: string; createdAt: string; detail: Record<string, unknown> }[]
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`
const when = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-900', scheduled: 'bg-secondary text-primary', approved: 'bg-secondary text-primary', publishing: 'bg-accent text-accent-foreground',
  published: 'bg-emerald-100 text-emerald-800', dry_run: 'bg-amber-100 text-amber-900', failed: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground',
  unwritten: 'bg-muted text-muted-foreground', skipped: 'bg-destructive/10 text-destructive', planned: 'bg-muted text-muted-foreground',
}
const BUDGET_STYLE: Record<Status, string> = { GREEN: 'bg-emerald-100 text-emerald-800', YELLOW: 'bg-amber-100 text-amber-900', RED: 'bg-destructive/10 text-destructive' }

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className ?? ''}`}>{children}</span>
}

async function post(body: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>('/api/admin/marketing', { method: 'POST', body: JSON.stringify(body) })
}

// ---- one post, with every action -----------------------------------------------------------------------------------

function PostCard({ p, dryRun, onChanged }: { p: Post; dryRun: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(p.text)
  const unconfirmed = p.status === 'failed' && p.errorCode === 'publish_unconfirmed'
  const editable = ['draft', 'approved', 'scheduled', 'failed'].includes(p.status)

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (action === 'publish_now' && !window.confirm(dryRun ? 'DRY-RUN: record what would be published (nothing is sent). Continue?' : `Publish this to ${p.platform === 'x' ? 'X' : p.platform === 'instagram' ? 'Instagram' : 'Facebook'} now?`)) return
    if (unconfirmed && ['approve', 'publish_now'].includes(action)) {
      if (!window.confirm('The platform did not confirm this post earlier. Check the account first. Confirm it was NOT posted?')) return
      extra.confirmNotPosted = true
    }
    if (action === 'delete' && !window.confirm('Delete this post?')) return
    setBusy(action)
    try {
      if (action === 'delete') await apiFetch(`/api/admin/marketing/posts/${p.id}`, { method: 'DELETE' })
      else await apiFetch(`/api/admin/marketing/posts/${p.id}`, { method: 'POST', body: JSON.stringify({ action, ...extra }) })
      toast.success({ approve: 'Approved — it goes out at its time', publish_now: dryRun ? 'Dry-run recorded' : 'Published', regenerate: 'Rewritten', cancel: 'Cancelled', edit: 'Saved — approve it again', delete: 'Deleted' }[action] ?? 'Done')
      setEditing(false)
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2" data-testid="console-post">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Pill className={STATUS_STYLE[p.status] ?? 'bg-muted'}>{p.status === 'scheduled' ? (p.autonomous ? 'queued (auto)' : 'approved') : p.status === 'dry_run' ? 'dry-run' : p.status}</Pill>
        <Pill className="bg-muted">{p.format}{p.link ? ' · link' : ''}</Pill>
        {p.source === 'library' ? <Pill className="bg-muted">evergreen</Pill> : null}
        {p.estCostUsd ? <span className="text-muted-foreground">{usd(p.estCostUsd)}</span> : null}
        {p.validation.length !== null ? <span className="text-muted-foreground">{p.validation.length} chars</span> : null}
      </div>
      {p.thumbs.length ? (
        <div className="flex gap-1.5 overflow-x-auto">
          {p.thumbs.map((t, i) =>
            t.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={t.url} alt="" className="h-20 w-28 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
            ) : (
              <span key={i} className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs">{t.kind === 'video' ? '▶ video' : t.kind}</span>
            ),
          )}
        </div>
      ) : null}
      {editing ? (
        <div className="space-y-2">
          <TextArea label="Post text" hideLabel value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={4000} />
          <div className="flex gap-2">
            <AppButton size="sm" loading={busy === 'edit'} onClick={() => act('edit', { text })}>Save</AppButton>
            <AppButton size="sm" variant="ghost" onClick={() => { setEditing(false); setText(p.text) }}>Cancel</AppButton>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.text}</p>
      )}
      {p.poll ? <p className="text-xs text-muted-foreground">Options: {p.poll.options.join(' · ')}</p> : null}
      {p.threadParts?.length ? <div className="space-y-1 border-l-2 border-border pl-2 text-xs text-muted-foreground">{p.threadParts.map((t, i) => <p key={i}>{t}</p>)}</div> : null}
      {p.validation.errors.length ? <ul className="list-disc pl-5 text-xs text-destructive">{p.validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
      {p.error ? <p className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">{p.error}</p> : null}
      {p.status === 'published' || p.status === 'dry_run' ? (
        <p className="text-xs text-muted-foreground">
          {p.status === 'published' ? `${when(p.publishedAt)} · ${p.metrics.impressions ?? 'n/a'} views · ${p.metrics.likes ?? 'n/a'} likes · ${p.metrics.replies ?? 'n/a'} comments · ${String(p.attribution.signups ?? 0)} sign-ups · score ${p.businessScore ?? 'n/a'}` : `Simulated ${when(p.dryRunAt)} — nothing was sent`}
          {p.externalPostUrl ? (
            <a href={p.externalPostUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-primary">
              Open <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </p>
      ) : null}
      {editable && !editing ? (
        <div className="flex flex-wrap gap-1.5">
          {['draft', 'failed'].includes(p.status) ? <AppButton size="sm" loading={busy === 'approve'} disabled={!p.validation.ok} onClick={() => act('approve')}>Approve</AppButton> : null}
          <AppButton size="sm" variant="magic" loading={busy === 'publish_now'} disabled={!p.validation.ok} onClick={() => act('publish_now')}>Publish now</AppButton>
          <AppButton size="sm" variant="outline" loading={busy === 'regenerate'} onClick={() => act('regenerate')}>Regenerate</AppButton>
          <AppButton size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</AppButton>
          <AppButton size="sm" variant="ghost" loading={busy === 'cancel'} onClick={() => act('cancel')}>Cancel</AppButton>
          {p.status === 'draft' ? <AppButton size="sm" variant="ghost" loading={busy === 'delete'} onClick={() => act('delete')}>Delete</AppButton> : null}
        </div>
      ) : null}
      {p.status === 'cancelled' ? <AppButton size="sm" variant="ghost" loading={busy === 'delete'} onClick={() => act('delete')}>Delete</AppButton> : null}
    </div>
  )
}

// ---- shared bits ---------------------------------------------------------------------------------------------------

function ConnectionButton({ platform, label }: { platform: Tab; label: string }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  return (
    <div className="space-y-1">
      <AppButton size="sm" variant="outline" loading={busy} onClick={async () => {
        setBusy(true)
        try {
          const r = (await post({ action: 'check_connection', platform })) as { ok: boolean; message: string }
          setResult(r)
          ;(r.ok ? toast.success : toast.error)(`${label}: ${r.message}`)
        } catch (e) {
          setResult({ ok: false, message: friendlyError(e) })
        } finally {
          setBusy(false)
        }
      }}>
        <PlugZap className="h-4 w-4" /> Check {label} connection
      </AppButton>
      {result ? <p className={`text-xs ${result.ok ? 'text-emerald-700' : 'text-destructive'}`}>{result.ok ? '✓ ' : '✕ '}{result.message}</p> : null}
    </div>
  )
}

function BudgetPanel({ b }: { b: Budget }) {
  return (
    <Card className="space-y-2 p-4 text-sm" data-testid="console-budget">
      <div className="flex items-center justify-between">
        <span className="font-semibold">X budget · {b.month} · {b.daysLeft} days left</span>
        <Pill className={BUDGET_STYLE[b.x.status]}>{b.x.status}</Pill>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <span>Budget: <strong>{usd(b.x.budget)}</strong></span>
        <span>Spent: <strong>{usd(b.x.spent)}</strong></span>
        <span>Projected: <strong>{usd(b.x.projected)}</strong></span>
        <span>Remaining: <strong>{usd(b.x.remaining)}</strong></span>
        <span>Today: <strong>{usd(b.x.today)}</strong> / {usd(b.x.dailyAllowance)}</span>
        <span>AI: <strong>{usd(b.ai.spent)}</strong> / {usd(b.ai.budget)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${b.x.status === 'RED' ? 'bg-destructive' : b.x.status === 'YELLOW' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (b.x.projected / Math.max(0.01, b.x.budget)) * 100)}%` }} />
      </div>
      {Object.keys(b.x.byOperation).length ? (
        <table className="w-full text-xs"><tbody>{Object.entries(b.x.byOperation).map(([k, v]) => <tr key={k} className="border-t border-border"><td className="py-1">{k}</td><td className="py-1 text-right">{v.units}</td><td className="py-1 text-right">{usd(v.cost)}</td></tr>)}</tbody></table>
      ) : null}
      {b.notes.map((n, i) => <p key={i} className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">{n}</p>)}
      <p className="text-xs text-muted-foreground">Instagram and Facebook API calls are free; only X bills per call.</p>
    </Card>
  )
}

// ---- General tab ---------------------------------------------------------------------------------------------------

function GeneralTab({ d, refresh, onOpen }: { d: GeneralData; refresh: () => void; onOpen: (t: Tab) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const c = d.config
  async function act(key: string, body: Record<string, unknown>, ok: string, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return
    setBusy(key)
    try {
      await post(body)
      toast.success(ok)
      refresh()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <Section title="Publishing">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill className={c.dryRun ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}>{c.dryRun ? 'DRY-RUN — nothing is sent' : 'LIVE'}</Pill>
            <Pill className={c.autonomousAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>Scheduler {c.autonomousAllowed ? 'enabled' : 'disabled (AUTONOMOUS_PUBLISHING)'}</Pill>
            <Pill className={c.aiConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>AI {c.aiConfigured ? 'ready' : 'not configured'}</Pill>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3" data-testid="autonomous-control">
            <div>
              <p className="font-bold">AUTONOMOUS PUBLISHING: {c.autonomousEffective ? 'ON' : 'OFF'}</p>
              <p className="text-xs text-muted-foreground">{c.autonomousEffective ? 'The engine publishes its written posts at their times — no approval needed. You can still edit, regenerate or cancel anything below.' : 'Only posts you approve go out (at their time). Everything else waits as drafts.'}</p>
            </div>
            <AppButton size="sm" className="shrink-0 whitespace-nowrap" variant={c.autonomousSwitch ? 'outline' : 'primary'} disabled={!c.autonomousAllowed} loading={busy === 'auto'}
              onClick={() => act('auto', { action: 'settings', autonomousEnabled: !c.autonomousSwitch }, c.autonomousSwitch ? 'Autonomous publishing OFF' : 'Autonomous publishing ON', c.autonomousSwitch ? undefined : 'Let the engine publish its posts without approval?')}>
              {c.autonomousSwitch ? 'Turn off' : 'Turn on'}
            </AppButton>
          </div>
        </Card>
      </Section>

      <Section title="Platforms">
        <div className="space-y-2">
          {d.platforms.map((p) => (
            <Card key={p.platform} className="space-y-2 p-4 text-sm" data-testid={`platform-${p.platform}`}>
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="font-bold text-primary" onClick={() => onOpen(p.platform)}>{p.label} →</button>
                <div className="flex flex-wrap gap-1 text-xs">
                  <Pill className={p.credentials ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>{p.credentials ? 'credentials set' : 'not connected'}</Pill>
                  <Pill className={p.enabled ? (p.paused ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800') : 'bg-muted'}>{p.enabled ? (p.paused ? 'paused' : 'active') : 'off (env)'}</Pill>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{p.postsPerDay}/day at {p.postTimes.join(', ')} · {p.queued} queued · {p.drafts} drafts · {p.daysWritten}/{p.bankDays} days written ahead</p>
              <div className="flex flex-wrap items-start gap-2">
                <ConnectionButton platform={p.platform} label={p.label} />
                {p.enabled ? (
                  <AppButton size="sm" variant="outline" loading={busy === `pause-${p.platform}`} onClick={() => act(`pause-${p.platform}`, { action: 'pause', platform: p.platform, paused: !p.paused }, p.paused ? `${p.label} resumed` : `${p.label} paused`)}>
                    {p.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {p.paused ? 'Resume publishing' : 'Pause publishing'}
                  </AppButton>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Run now">
        <Card className="flex flex-wrap gap-2 p-4">
          <AppButton size="sm" variant="outline" loading={busy === 'prepare'} onClick={() => act('prepare', { action: 'run', task: 'prepare' }, 'Prepared: metrics, learning, content, brief')}><RefreshCw className="h-4 w-4" /> Run daily prepare</AppButton>
          <AppButton size="sm" variant="outline" loading={busy === 'publish'} onClick={() => act('publish', { action: 'run', task: 'publish' }, 'Publish step ran', c.dryRun ? undefined : 'Publish whatever is due right now on every active platform?')}><Play className="h-4 w-4" /> Publish what’s due</AppButton>
        </Card>
      </Section>

      <Section title="Budget"><BudgetPanel b={d.budget} /></Section>

      <Section title="What the data says">
        <Card className="space-y-1 p-4 text-sm">
          {d.decisions.length ? d.decisions.map((x, i) => <p key={i}><Pill className={x.action === 'increase' ? 'bg-emerald-100 text-emerald-800' : x.action === 'decrease' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}>{x.action}</Pill> {x.reason}</p>) : null}
          {d.recommendations.filter((r) => !d.decisions.some((x) => x.reason === r)).map((r, i) => <p key={i} className="text-xs text-muted-foreground">• {r}</p>)}
          {!d.decisions.length && !d.recommendations.length ? <p className="text-muted-foreground">No analysis yet.</p> : null}
        </Card>
      </Section>

      <Section title="Daily brief">
        <Card className="p-4">{d.brief ? <pre className="whitespace-pre-wrap break-words font-sans text-sm">{d.brief.text}</pre> : <p className="text-sm text-muted-foreground">The first brief comes with the next daily prepare.</p>}</Card>
      </Section>

      <Section title="Activity">
        <Card className="divide-y divide-border">
          {d.audit.length ? d.audit.map((a) => <p key={a.id} className="px-4 py-2 text-xs">{when(a.createdAt)} · <strong>{a.action}</strong>{typeof a.detail?.platform === 'string' ? ` · ${a.detail.platform}` : ''}</p>) : <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>}
        </Card>
      </Section>
    </>
  )
}

// ---- platform tab --------------------------------------------------------------------------------------------------

function PlatformTab({ d, refresh }: { d: PlatformData; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set(d.days.slice(0, 2).map((x) => x.date)))
  const [filling, setFilling] = useState<{ done: number; remaining: number } | null>(null)
  const stop = useRef(false)
  const unwrittenDays = d.days.filter((x) => x.unwritten > 0).length

  async function act(key: string, body: Record<string, unknown>, ok: string) {
    setBusy(key)
    try {
      await post(body)
      toast.success(ok)
      refresh()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  async function fill() {
    stop.current = false
    setFilling({ done: 0, remaining: unwrittenDays })
    let done = 0
    try {
      for (;;) {
        if (stop.current) break
        const r = (await post({ action: 'write_next_day', platform: d.platform })) as { date: string | null; remaining: number }
        if (!r.date) break
        done++
        setFilling({ done, remaining: r.remaining })
        if (done % 3 === 0) refresh()
        if (!r.remaining) break
      }
      toast.success(`${d.label}: ${done} day${done === 1 ? '' : 's'} written`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setFilling(null)
      refresh()
    }
  }

  const toggle = (date: string) => setOpen((s) => { const n = new Set(s); if (n.has(date)) n.delete(date); else n.add(date); return n })
  const pf = d.performance

  return (
    <>
      <Section title={`${d.label} status`}>
        <Card className="space-y-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill className={d.credentials ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>{d.credentials ? 'credentials set' : 'not connected'}</Pill>
            <Pill className={d.enabled ? (d.paused ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800') : 'bg-muted'}>{d.enabled ? (d.paused ? 'publishing paused' : 'active') : 'not enabled (MARKETING_PLATFORMS)'}</Pill>
            <Pill className={d.dryRun ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}>{d.dryRun ? 'DRY-RUN' : 'LIVE'}</Pill>
            <Pill className="bg-muted">{d.autonomousEffective ? 'autonomous' : 'approval needed'}</Pill>
          </div>
          <p className="text-xs text-muted-foreground">{d.cadence.postsPerDay} posts/day at {d.cadence.postTimes.join(', ')} ({d.cadence.timezone}) · up to {d.cadence.maxChars} characters</p>
          <div className="flex flex-wrap items-start gap-2">
            <ConnectionButton platform={d.platform} label={d.label} />
            {d.enabled ? (
              <AppButton size="sm" variant="outline" loading={busy === 'pause'} onClick={() => act('pause', { action: 'pause', platform: d.platform, paused: !d.paused }, d.paused ? 'Resumed' : 'Paused')}>
                {d.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {d.paused ? 'Resume publishing' : 'Pause publishing'}
              </AppButton>
            ) : null}
            <AppButton size="sm" variant="outline" loading={busy === 'history'} onClick={() => act('history', { action: 'import_history', platform: d.platform }, 'Existing posts imported')}>
              <History className="h-4 w-4" /> Import existing posts
            </AppButton>
          </div>
        </Card>
      </Section>

      {d.budget ? <Section title="Budget"><BudgetPanel b={d.budget} /></Section> : null}

      <Section title="Content engine — next 30 days">
        <Card className="space-y-3 p-4 text-sm">
          <p>{d.days.length - unwrittenDays}/{d.days.length} days written · {d.days.reduce((a, x) => a + x.slots.filter((s) => s.post?.status === 'draft').length, 0)} drafts waiting · {d.days.reduce((a, x) => a + x.slots.filter((s) => s.post && ['scheduled', 'approved'].includes(s.post.status)).length, 0)} queued</p>
          {filling ? (
            <div className="flex items-center gap-3">
              <p className="text-xs">Writing… {filling.done} done, {filling.remaining} to go (each day takes ~10–30 s)</p>
              <AppButton size="sm" variant="ghost" onClick={() => { stop.current = true }}><Square className="h-4 w-4" /> Stop</AppButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AppButton size="sm" variant="magic" disabled={!unwrittenDays} onClick={fill}><Sparkles className="h-4 w-4" /> Write all unwritten days ({unwrittenDays})</AppButton>
              <AppButton size="sm" variant="outline" loading={busy === 'next'} disabled={!unwrittenDays} onClick={() => act('next', { action: 'write_next_day', platform: d.platform }, 'Next day written')}><CalendarDays className="h-4 w-4" /> Write next day</AppButton>
            </div>
          )}
        </Card>
        <div className="mt-3 space-y-2" data-testid="console-schedule">
          {d.days.map((day) => {
            const isOpen = open.has(day.date)
            const drafts = day.slots.filter((s) => s.post?.status === 'draft').length
            return (
              <Card key={day.date} className="p-0">
                <button type="button" onClick={() => toggle(day.date)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left" aria-expanded={isOpen}>
                  <span className="flex items-center gap-2 font-semibold">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{day.weekday}</span>
                  <span className="flex flex-wrap justify-end gap-1 text-xs">
                    {day.slots.map((s, i) => <span key={i} title={`${s.time} ${s.roleLabel ?? ''} ${s.status}`} className={`h-2.5 w-2.5 rounded-full ${s.status === 'unwritten' ? 'bg-muted-foreground/30' : s.status === 'draft' ? 'bg-amber-400' : ['scheduled', 'approved'].includes(s.status) ? 'bg-primary' : s.status === 'published' ? 'bg-emerald-500' : s.status === 'failed' || s.status === 'skipped' ? 'bg-destructive' : 'bg-muted-foreground/60'}`} />)}
                  </span>
                </button>
                {isOpen ? (
                  <div className="space-y-3 border-t border-border px-4 py-3">
                    {day.unwritten || drafts ? (
                      <div className="flex flex-wrap gap-2">
                        {day.unwritten ? <AppButton size="sm" variant="outline" loading={busy === `w-${day.date}`} onClick={() => act(`w-${day.date}`, { action: 'write_day', platform: d.platform, date: day.date }, `${day.weekday} written`)}><Sparkles className="h-4 w-4" /> Write this day</AppButton> : null}
                        {drafts ? <AppButton size="sm" loading={busy === `a-${day.date}`} onClick={() => act(`a-${day.date}`, { action: 'approve_day', platform: d.platform, date: day.date }, `${day.weekday}: drafts approved`)}>Approve all {drafts} drafts</AppButton> : null}
                      </div>
                    ) : null}
                    {day.slots.length ? day.slots.map((s, i) => (
                      <div key={i} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                          <span className="text-sm">{s.time}</span>
                          {s.roleLabel ? <Pill className="bg-secondary text-primary">{s.roleLabel}</Pill> : null}
                          {!s.post ? <Pill className={STATUS_STYLE[s.status] ?? 'bg-muted'}>{s.status === 'unwritten' ? `planned · ${s.format}${s.link ? ' · link' : ''}` : s.status}</Pill> : null}
                          {s.note && !s.post ? <span className="font-normal text-muted-foreground">{s.note}</span> : null}
                        </p>
                        {s.post ? <PostCard p={s.post} dryRun={d.dryRun} onChanged={refresh} /> : null}
                      </div>
                    )) : <p className="text-xs text-muted-foreground">No slots planned — write this day to plan it.</p>}
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      </Section>

      <Section title="Last 14 days">
        {d.recent.length ? <div className="space-y-2">{d.recent.map((p) => <Card key={p.id} className="p-4"><PostCard p={p} dryRun={d.dryRun} onChanged={refresh} /></Card>)}</div> : <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
      </Section>

      <Section title="Performance (30 days)">
        <Card className="space-y-2 p-4 text-sm">
          <div className="grid grid-cols-2 gap-1">
            <span>Posts: <strong>{pf.posts}</strong></span>
            <span>Views: <strong>{pf.impressions}</strong></span>
            <span>Engagements: <strong>{pf.engagements}</strong></span>
            <span>Link clicks: <strong>{pf.linkClicks}</strong></span>
            <span>Website visits: <strong>{pf.websiteVisits}</strong></span>
            <span>Sign-ups: <strong>{pf.signups}</strong></span>
            <span>Parties: <strong>{pf.partiesCreated}</strong></span>
            <span>Purchases: <strong>{pf.purchases}</strong></span>
          </div>
          {[['Formats', pf.topFormats], ['Roles', pf.topRoles]].map(([t, rows]) => (rows as PlatformData['performance']['topFormats']).length ? (
            <table key={t as string} className="w-full text-xs"><tbody>{(rows as PlatformData['performance']['topFormats']).slice(0, 5).map((r) => <tr key={r.key} className="border-t border-border"><td className="py-1">{t as string}: {r.key}</td><td className="text-right">{r.posts} posts</td><td className="text-right">score {r.avgScore}</td><td className="text-right">{r.signups} sign-ups</td></tr>)}</tbody></table>
          ) : null)}
        </Card>
      </Section>
    </>
  )
}

// ---- the console ---------------------------------------------------------------------------------------------------

export function MarketingConsole() {
  const { user } = useAuth()
  const session = useSWR(user ? ['admin-session', user.id] : null, () => apiFetch<{ admin: boolean }>('/api/admin/session'), { shouldRetryOnError: false })
  const isAdmin = !!session.data?.admin
  const [tab, setTab] = useState<Tab>('general')
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && TABS.some((x) => x.id === t)) setTab(t as Tab)
  }, [])
  const choose = (t: Tab) => {
    setTab(t)
    window.history.replaceState(null, '', t === 'general' ? window.location.pathname : `?tab=${t}`)
  }
  const data = useSWR(isAdmin ? ['admin-marketing', tab] : null, () => apiFetch<GeneralData | PlatformData>(`/api/admin/marketing?tab=${tab}`), { revalidateOnFocus: true })
  const refresh = () => void data.mutate()

  if (session.isLoading || (!session.data && !session.error && user)) return <div className="space-y-4 px-4 pt-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full rounded-3xl" /></div>
  if (!isAdmin) return <EmptyState icon="🔍" title="Page not found" body="This page doesn’t exist." />

  return (
    <div className="pb-6" data-testid="marketing-console">
      <PageHeader title="Marketing" subtitle="X · Instagram · Facebook — one content engine, every action audited" back="/admin" />
      <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)} className={`tap min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {data.error ? <EmptyState icon="⚠️" title="Couldn’t load this tab" body={friendlyError(data.error)} /> : !data.data ? (
        <div className="space-y-3 px-4 pt-4"><Skeleton className="h-32 w-full rounded-3xl" /><Skeleton className="h-64 w-full rounded-3xl" /></div>
      ) : tab === 'general' ? (
        <GeneralTab d={data.data as GeneralData} refresh={refresh} onOpen={choose} />
      ) : (
        <PlatformTab key={tab} d={data.data as PlatformData} refresh={refresh} />
      )}
    </div>
  )
}
