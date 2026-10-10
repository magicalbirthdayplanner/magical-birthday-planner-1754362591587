'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ExternalLink, Megaphone, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AppButton, Card, Chip, EmptyState, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { TextArea, TextField } from '@/components/app/fields'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { PILLARS, PILLAR_LABEL, type MarketingPost, type Pillar } from '@/lib/marketing/types'

type AdminPost = MarketingPost & { imageUrl: string | null; pillarLabel: string }
interface Stats { posts: number; impressions: number; engagementRate: number | null; profileVisitRate: number | null; linkClickRate: number | null; landingVisits: number; signups: number; partiesCreated: number; purchases: number; revenueMinor: number }
interface Overview {
  config: {
    dryRun: boolean; autonomousAllowed: boolean; autonomousSwitch: boolean; autonomousEffective: boolean; autoDraft: boolean; postsPerDay: number; postTimes: string[]; timezone: string
    minGapMinutes: number; urlShare: number; maxChars: number; imageProvider: string; launchDate: string; xConfigured: boolean; aiConfigured: boolean; cronConfigured: boolean; briefEmail: boolean
  }
  today: AdminPost[]; upcoming: AdminPost[]; drafts: AdminPost[]; published: AdminPost[]; failed: AdminPost[]
  performance: { last30: Stats; insights: { computedAt: string; sampleSize: number; recommendations: string[]; pillarMultipliers: Record<string, number>; data: { byPillar?: (Stats & { key: string })[] } } | null }
  brief: { date: string; text: string } | null
  next: { pillar: Pillar; label: string; reason: string; topic: string; slot: string | null }
  audit: { id: number; postId: string | null; action: string; createdAt: string }[]
}

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const pct = (x: number | null | undefined) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)
const num = (x: number | null | undefined) => (x === null || x === undefined ? 'n/a' : x.toLocaleString('en-US'))
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-foreground', approved: 'bg-secondary text-primary', scheduled: 'bg-secondary text-primary', publishing: 'bg-accent text-accent-foreground',
  published: 'bg-emerald-100 text-emerald-800', dry_run: 'bg-amber-100 text-amber-900', failed: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground',
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className ?? ''}`}>{children}</span>
}

function PostCard({ post, cfg, onChanged }: { post: AdminPost; cfg: Overview['config']; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(post.text)
  const [when, setWhen] = useState('')
  const [url, setUrl] = useState('')
  const unconfirmed = post.status === 'failed' && post.publishErrorCode === 'publish_unconfirmed'

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (action === 'publish_now') {
      const msg = cfg.dryRun ? 'DRY-RUN: this records what would be published. Nothing is sent to X. Continue?' : 'This publishes to the real X account NOW. Continue?'
      if (!window.confirm(msg)) return
    }
    if (unconfirmed && ['approve', 'schedule', 'publish_now'].includes(action)) {
      if (!window.confirm('X did not confirm this post earlier. Check the X account first. Confirm it was NOT posted?')) return
      extra.confirmNotPosted = true
    }
    setBusy(action)
    try {
      if (action === 'delete') await apiFetch(`/api/admin/marketing/posts/${post.id}`, { method: 'DELETE' })
      else await apiFetch(`/api/admin/marketing/posts/${post.id}`, { method: 'POST', body: JSON.stringify({ action, ...extra }) })
      toast.success(action === 'publish_now' && cfg.dryRun ? 'Dry-run recorded — nothing was posted' : 'Done')
      setEditing(false)
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const v = post.validation as { errors?: { message: string }[]; warnings?: { message: string }[]; weightedLength?: number; maxLength?: number }
  const editable = ['draft', 'approved', 'scheduled', 'failed'].includes(post.status)
  return (
    <Card className="space-y-3 p-4" data-testid="marketing-post">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={STATUS_STYLE[post.status]}>{post.status === 'dry_run' ? 'dry-run' : post.status}</Badge>
        <Badge className="bg-secondary text-primary">{post.pillarLabel}</Badge>
        {post.autonomous ? <Badge className="bg-muted">autonomous</Badge> : null}
        <span className="text-muted-foreground">
          {post.publishedAt ? `Published ${fmt(post.publishedAt)}` : post.dryRunAt ? `Simulated ${fmt(post.dryRunAt)}` : post.scheduledAt ? `Scheduled ${fmt(post.scheduledAt)}` : `Created ${fmt(post.createdAt)}`}
        </span>
      </div>
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt={post.imageAlt ?? ''} className="w-full rounded-xl border border-border" loading="lazy" />
      ) : post.imageStatus === 'failed' ? <p className="text-xs text-muted-foreground">Image generation failed — posts as text only.</p> : null}
      {editing ? (
        <div className="space-y-2">
          <TextArea label="Post text" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={6} />
          <p className="text-xs text-muted-foreground">Keep the link exactly as it is (or remove it). Edited posts need approval again.</p>
          <div className="flex gap-2">
            <AppButton size="sm" loading={busy === 'edit'} onClick={() => act('edit', { text })}>Save</AppButton>
            <AppButton size="sm" variant="ghost" onClick={() => { setEditing(false); setText(post.text) }}>Cancel</AppButton>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{post.text}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Topic: {post.topic}
        {typeof v.weightedLength === 'number' ? ` · ${v.weightedLength}/${v.maxLength} chars` : ''}
        {post.linkUrl ? ' · with link' : ''}
        {post.similarityScore !== null ? ` · closest past post ${Math.round(post.similarityScore * 100)}% similar` : ''}
      </p>
      {v.errors?.length ? <ul className="list-disc pl-5 text-xs text-destructive">{v.errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul> : null}
      {v.warnings?.length ? <ul className="list-disc pl-5 text-xs text-amber-800">{v.warnings.map((e, i) => <li key={i}>{e.message}</li>)}</ul> : null}
      {post.publishError ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{post.publishError}</p> : null}
      {post.status === 'published' ? (
        <div className="grid grid-cols-4 gap-2 text-center text-xs" data-testid="post-metrics">
          {[
            ['Impr.', post.metrics.impressions], ['Likes', post.metrics.likes], ['Reposts', post.metrics.reposts], ['Replies', post.metrics.replies],
            ['Bookm.', post.metrics.bookmarks], ['Profile', post.metrics.profileVisits], ['Clicks', post.metrics.linkClicks], ['Visits', post.attribution.landingVisits],
            ['Sign-ups', post.attribution.signups], ['Parties', post.attribution.partiesCreated], ['Checkouts', post.attribution.checkouts], ['Purchases', post.attribution.purchases],
          ].map(([k, val]) => (
            <div key={k as string} className="rounded-xl bg-muted px-1 py-2">
              <strong className="block text-sm">{num(val as number | null)}</strong>
              {k}
            </div>
          ))}
        </div>
      ) : null}
      {post.dryRunPayload ? <p className="text-xs text-amber-900">Dry-run: this is exactly what would have been posted{post.imagePath ? ' (with the image)' : ''}. Nothing was sent to X.</p> : null}
      {post.externalPostUrl ? (
        <a href={post.externalPostUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          View on X <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      {editable && !editing ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {['draft', 'failed'].includes(post.status) ? <AppButton size="sm" loading={busy === 'approve'} onClick={() => act('approve')}>Approve</AppButton> : null}
            <AppButton size="sm" variant="secondary" loading={busy === 'schedule'} onClick={() => act('schedule', when ? { at: new Date(when).toISOString() } : {})}>
              {when ? 'Schedule at time' : 'Schedule next slot'}
            </AppButton>
            <AppButton size="sm" variant="magic" loading={busy === 'publish_now'} onClick={() => act('publish_now')}>{cfg.dryRun ? 'Publish now (dry-run)' : 'Publish now'}</AppButton>
            <AppButton size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</AppButton>
            <AppButton size="sm" variant="outline" loading={busy === 'regenerate'} onClick={() => act('regenerate')}>Regenerate</AppButton>
            <AppButton size="sm" variant="ghost" loading={busy === 'cancel'} onClick={() => act('cancel')}>Cancel</AppButton>
            {post.status === 'draft' ? <AppButton size="sm" variant="danger" loading={busy === 'delete'} onClick={() => window.confirm('Delete this draft?') && act('delete')}>Delete draft</AppButton> : null}
          </div>
          <TextField label="Schedule time (optional)" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} hint={`Empty = next free slot (${cfg.postTimes.join(', ')} ${cfg.timezone}). Times here are in your browser's time zone.`} />
        </div>
      ) : null}
      {post.status === 'cancelled' ? <AppButton size="sm" variant="danger" loading={busy === 'delete'} onClick={() => window.confirm('Delete this post?') && act('delete')}>Delete</AppButton> : null}
      {unconfirmed ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField label="It was posted? Paste the X URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://x.com/…/status/…" />
          </div>
          <AppButton size="sm" variant="outline" loading={busy === 'link_external'} onClick={() => act('link_external', { url })}>Link</AppButton>
        </div>
      ) : null}
    </Card>
  )
}

function PostList({ posts, cfg, onChanged, empty }: { posts: AdminPost[]; cfg: Overview['config']; onChanged: () => void; empty: string }) {
  if (!posts.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return <div className="space-y-3">{posts.map((p) => <PostCard key={`${p.id}-${p.updatedAt}`} post={p} cfg={cfg} onChanged={onChanged} />)}</div>
}

export function MarketingAdminScreen() {
  const { user } = useAuth()
  const session = useSWR(user ? ['admin-session', user.id] : null, () => apiFetch<{ admin: boolean }>('/api/admin/session'), { shouldRetryOnError: false })
  const isAdmin = !!session.data?.admin
  const data = useSWR(isAdmin ? 'admin-marketing' : null, () => apiFetch<Overview>('/api/admin/marketing'), { revalidateOnFocus: true })
  const [pillar, setPillar] = useState<Pillar | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = () => void data.mutate()

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(action + (body.task ?? ''))
    try {
      const r = await apiFetch<{ account?: { username: string; accessLevel: string | null; canPost: boolean } }>('/api/admin/marketing', { method: 'POST', body: JSON.stringify({ action, ...body }) })
      if (r.account && !r.account.canPost) toast.warning(`Connected as @${r.account.username}, but the token is READ-ONLY (${r.account.accessLevel}). Set the X app to “Read and write”, then regenerate the access token.`, { duration: 12_000 })
      else toast.success(r.account ? `${success} @${r.account.username}${r.account.accessLevel ? ` (${r.account.accessLevel})` : ''}` : success)
      refresh()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  if (session.isLoading || (!session.data && !session.error && user)) {
    return (
      <div className="space-y-4 px-4 pt-6" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    )
  }
  if (!isAdmin) return <EmptyState icon="🔍" title="Page not found" body="This page doesn’t exist." />
  if (data.error) return <EmptyState icon="⚠️" title="Marketing data unavailable" body={friendlyError(data.error)} />
  const d = data.data
  if (!d) return <div className="px-4 pt-6"><Skeleton className="h-64 w-full rounded-3xl" /></div>
  const c = d.config
  const ins = d.performance.insights
  const s = d.performance.last30

  return (
    <div className="pb-6" data-testid="marketing-admin">
      <PageHeader title="Founder marketing" subtitle="X founder agent — every action is audited" back="/admin" />
      <div className="px-4">
        <a href="/admin/marketing/x" className="tap flex min-h-[48px] items-center justify-center rounded-2xl bg-hero px-4 text-sm font-semibold text-white" data-testid="x-growth-link">
          X growth engine — budget, weekly content bank, performance →
        </a>
      </div>

      <Section title="Control">
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className={c.dryRun ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}>{c.dryRun ? 'DRY-RUN — nothing reaches X' : 'LIVE — posts reach X'}</Badge>
            <Badge className={c.xConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>X credentials {c.xConfigured ? 'set' : 'missing'}</Badge>
            <Badge className={c.aiConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>AI {c.aiConfigured ? 'ready' : 'not configured'}</Badge>
            <Badge className={c.cronConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>Scheduler {c.cronConfigured ? 'ready' : 'needs CRON_SECRET'}</Badge>
            <Badge className="bg-muted">Images: {c.imageProvider}</Badge>
          </div>
          <div className="rounded-2xl border border-border p-3" data-testid="autonomous-control">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">AUTONOMOUS PUBLISHING: {c.autonomousEffective ? 'ON' : 'OFF'}</p>
                <p className="text-xs text-muted-foreground">
                  {c.autonomousAllowed ? 'Environment allows it (AUTONOMOUS_PUBLISHING=true).' : 'Locked by the environment: set AUTONOMOUS_PUBLISHING=true to allow it.'} Switch: {c.autonomousSwitch ? 'on' : 'off'}.
                  {c.autonomousEffective ? ` The agent writes, schedules and ${c.dryRun ? 'simulates (dry-run)' : 'publishes'} up to ${c.postsPerDay} post${c.postsPerDay > 1 ? 's' : ''}/day at ${c.postTimes.join(', ')} ${c.timezone}.` : ' Scheduled posts wait; drafts are created for your review.'}
                </p>
              </div>
              <AppButton size="sm" className="shrink-0 whitespace-nowrap" variant={c.autonomousSwitch ? 'outline' : 'primary'} disabled={!c.autonomousAllowed && !c.autonomousSwitch} loading={busy === 'settings'}
                onClick={() => (c.autonomousSwitch || window.confirm(c.dryRun ? 'Turn ON autonomous mode (dry-run: simulated only)?' : 'Turn ON autonomous publishing to the real X account?')) && post('settings', { autonomousEnabled: !c.autonomousSwitch }, c.autonomousSwitch ? 'Autonomous publishing OFF' : 'Autonomous publishing ON')}>
                {c.autonomousSwitch ? 'Turn off' : 'Turn on'}
              </AppButton>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Generate a draft</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pillar">
              <Chip role="radio" aria-checked={pillar === null} active={pillar === null} onClick={() => setPillar(null)}>Agent decides</Chip>
              {PILLARS.map((p) => (
                <Chip key={p} role="radio" aria-checked={pillar === p} active={pillar === p} onClick={() => setPillar(p)}>{PILLAR_LABEL[p]}</Chip>
              ))}
            </div>
            <AppButton block variant="magic" loading={busy === 'generate'} onClick={() => post('generate', { pillar }, 'Draft created')}>
              <Sparkles className="h-4 w-4" /> Generate draft
            </AppButton>
            <p className="text-xs text-muted-foreground">Takes 15–45 seconds. Next up: <strong>{d.next.label}</strong> — {d.next.topic}. {d.next.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AppButton size="sm" variant="outline" loading={busy === 'verify_x'} onClick={() => post('verify_x', {}, 'X connected as')}>Check X connection</AppButton>
            <AppButton size="sm" variant="outline" loading={busy === 'runrefresh'} onClick={() => post('run', { task: 'refresh' }, 'Metrics, learning and brief refreshed')}><RefreshCw className="h-4 w-4" /> Refresh metrics</AppButton>
            <AppButton size="sm" variant="outline" loading={busy === 'runpublish'} onClick={() => post('run', { task: 'publish' }, 'Scheduler publish step ran')}>Run publish step</AppButton>
          </div>
        </Card>
      </Section>

      <Section title="Today’s post"><PostList posts={d.today} cfg={c} onChanged={refresh} empty="Nothing scheduled or posted today." /></Section>
      <Section title={`Drafts (${d.drafts.length})`}><PostList posts={d.drafts} cfg={c} onChanged={refresh} empty="No drafts. Generate one above." /></Section>
      <Section title="Upcoming"><PostList posts={d.upcoming} cfg={c} onChanged={refresh} empty="Nothing scheduled." /></Section>
      {d.failed.length ? <Section title="Needs attention"><PostList posts={d.failed} cfg={c} onChanged={refresh} empty="" /></Section> : null}

      <Section title="Performance (last 30 days)">
        <Card className="space-y-3 p-4 text-sm" data-testid="marketing-performance">
          <div className="grid grid-cols-2 gap-2">
            <span>Posts: <strong>{s.posts}</strong></span>
            <span>Impressions: <strong>{num(s.impressions)}</strong></span>
            <span>Engagement: <strong>{pct(s.engagementRate)}</strong></span>
            <span>Profile-visit rate: <strong>{pct(s.profileVisitRate)}</strong></span>
            <span>Link-click rate: <strong>{pct(s.linkClickRate)}</strong></span>
            <span>Website visits: <strong>{s.landingVisits}</strong></span>
            <span>Sign-ups: <strong>{s.signups}</strong></span>
            <span>Parties created: <strong>{s.partiesCreated}</strong></span>
            <span>Purchases: <strong>{s.purchases}</strong></span>
          </div>
          <div>
            <p className="font-semibold">What the data says{ins ? ` (${fmt(ins.computedAt)}, ${ins.sampleSize} posts)` : ''}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">{(ins?.recommendations ?? ['No analysis yet — it runs every few days once posts have metrics.']).map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
          {ins?.data.byPillar?.length ? (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th>Pillar</th><th>Posts</th><th>Eng.</th><th>Profile</th><th>Clicks</th><th>Sign-ups</th></tr></thead>
              <tbody>
                {ins.data.byPillar.map((g) => (
                  <tr key={g.key}><td>{PILLAR_LABEL[g.key as Pillar] ?? g.key}</td><td>{g.posts}</td><td>{pct(g.engagementRate)}</td><td>{pct(g.profileVisitRate)}</td><td>{pct(g.linkClickRate)}</td><td>{g.signups}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Card>
      </Section>

      <Section title="Published & simulated"><PostList posts={d.published} cfg={c} onChanged={refresh} empty="Nothing published yet." /></Section>

      <Section title="Daily brief">
        <Card className="p-4">
          {d.brief ? <pre className="whitespace-pre-wrap break-words font-sans text-sm" data-testid="marketing-brief">{d.brief.text}</pre> : <p className="text-sm text-muted-foreground">The first brief is written by the next scheduler run.</p>}
        </Card>
      </Section>

      <Section title="Activity">
        <Card className="divide-y divide-border">
          {d.audit.length ? d.audit.map((a) => (
            <p key={a.id} className="flex items-center gap-2 px-4 py-2 text-xs"><Megaphone className="h-3.5 w-3.5 text-muted-foreground" /> {fmt(a.createdAt)} · <strong>{a.action}</strong></p>
          )) : <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>}
        </Card>
      </Section>
    </div>
  )
}
