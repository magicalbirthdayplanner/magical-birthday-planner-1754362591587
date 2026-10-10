'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import Link from 'next/link'
import { Megaphone, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AppButton, Card, Chip, EmptyState, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { apiFetch, friendlyError } from '@/lib/data/api'

type Plan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO'
type Duration = '24h' | '7d' | '30d' | 'none'
type Source = 'founding' | 'admin_override' | 'purchase' | 'trial' | 'free'
interface AdminUser {
  id: string
  email: string | null
  name: string | null
  createdAt: string | null
  role: string | null
  plan: string
  source: Source
  trialActive: boolean
  override: { plan: string; expiresAt: string | null } | null
}
interface AuditEntry { id: number; at: string; by: string; target: string | null; action: string; oldPlan: string | null; newPlan: string | null; expiresAt: string | null }

const PLANS: Plan[] = ['FREE', 'STARTER', 'PLUS', 'PRO']
const DURATIONS: { id: Duration; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'none', label: 'No expiration' },
]
const title = (p: string) => p.charAt(0) + p.slice(1).toLowerCase()
export const SOURCE_LABEL: Record<Source, string> = { founding: 'Founding family (free Pro)', admin_override: 'Admin override', purchase: 'Purchased', trial: 'Trial', free: 'Free' }
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const ACTION_LABEL: Record<string, string> = { override_set: 'Override set', override_changed: 'Override changed', override_removed: 'Override removed', override_expired: 'Override expired', role_granted: 'Role granted', role_revoked: 'Role revoked' }

/** Plan + override controls for one user (also used for "My account"). */
function PlanControls({ user, onChanged, testId }: { user: AdminUser; onChanged: () => void; testId: string }) {
  const [plan, setPlan] = useState<Plan>((PLANS as string[]).includes(user.override?.plan ?? user.plan) ? ((user.override?.plan ?? user.plan) as Plan) : 'FREE')
  const [duration, setDuration] = useState<Duration>('none')
  const [busy, setBusy] = useState<'apply' | 'remove' | null>(null)
  async function apply() {
    setBusy('apply')
    try {
      await apiFetch('/api/admin/override', { method: 'POST', body: JSON.stringify({ userId: user.id, plan, duration }) })
      toast.success(`${user.email ?? 'User'} → ${title(plan)} (admin override)`)
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }
  async function remove() {
    setBusy('remove')
    try {
      await apiFetch('/api/admin/override', { method: 'DELETE', body: JSON.stringify({ userId: user.id }) })
      toast.success('Override removed — normal billing/trial state restored')
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-3" data-testid={testId}>
      <p className="text-sm">
        Current plan: <strong data-testid="effective-plan">{title(user.plan)}</strong>{' '}
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground" data-testid="plan-source">
          {SOURCE_LABEL[user.source]}
        </span>
        {user.override ? <span className="block text-xs text-muted-foreground">Override {user.override.expiresAt ? `expires ${fmt(user.override.expiresAt)}` : 'never expires'}</span> : null}
      </p>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Plan">
        {PLANS.map((p) => (
          <Chip key={p} role="radio" aria-checked={plan === p} active={plan === p} onClick={() => setPlan(p)} className="h-11 justify-center">
            {title(p)}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Override duration">
        {DURATIONS.map((d) => (
          <Chip key={d.id} role="radio" aria-checked={duration === d.id} active={duration === d.id} onClick={() => setDuration(d.id)} className="h-11 justify-center">
            {d.label}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <AppButton block loading={busy === 'apply'} onClick={apply}>
          Apply override
        </AppButton>
        <AppButton variant="outline" block loading={busy === 'remove'} disabled={!user.override} onClick={remove}>
          Remove override
        </AppButton>
      </div>
    </div>
  )
}

export function AdminScreen() {
  const { user } = useAuth()
  const session = useSWR(user ? ['admin-session', user.id] : null, () => apiFetch<{ admin: boolean; userId: string }>('/api/admin/session'), { shouldRetryOnError: false })
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const isAdmin = !!session.data?.admin
  const stats = useSWR(isAdmin ? 'admin-stats' : null, () => apiFetch<{ users: number; paidUsers: number; freeUsers: number; overrides: number; unresolvedPayments: number; foundingMembers: number; foundingSeats: number }>('/api/admin/stats'))
  const me = useSWR(isAdmin && user?.email ? ['admin-me', user.email] : null, () => apiFetch<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(user!.email!)}`).then((r) => r.users.find((u) => u.id === user!.id) ?? null))
  const users = useSWR(isAdmin ? ['admin-users', term] : null, () => apiFetch<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(term)}`).then((r) => r.users))
  const audit = useSWR(isAdmin ? 'admin-audit' : null, () => apiFetch<{ entries: AuditEntry[] }>('/api/admin/audit').then((r) => r.entries))
  const refresh = () => {
    void me.mutate()
    void users.mutate()
    void audit.mutate()
    void stats.mutate()
  }

  if (session.isLoading || (!session.data && !session.error && user)) {
    return (
      <div className="space-y-4 px-4 pt-6" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    )
  }
  // Non-admins (and signed-out visitors) see a plain not-found: no admin information.
  if (!isAdmin) return <EmptyState icon="🔍" title="Page not found" body="This page doesn’t exist." />

  const picked = users.data?.find((u) => u.id === selected) ?? null
  return (
    <div className="pb-6" data-testid="admin-screen">
      <PageHeader title="Admin" subtitle="Super Admin tools — changes here are audited" back="/more" />

      <Section title="My account">
        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" /> Super Admin
          </p>
          <p className="text-xs text-muted-foreground">Quick test plan — an admin override, never a purchase.</p>
          {me.data ? <PlanControls key={`${me.data.plan}-${me.data.source}`} user={me.data} onChanged={refresh} testId="my-plan" /> : <Skeleton className="h-32 w-full" />}
        </Card>
      </Section>

      <Section title="Marketing">
        <Link href="/admin/marketing" className="tap flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold shadow-sm active:bg-muted" data-testid="admin-marketing-link">
          <Megaphone className="h-4 w-4 text-primary" /> Founder marketing agent (X)
        </Link>
      </Section>

      <Section title="System">
        <Card className="grid grid-cols-2 gap-3 p-4 text-sm" data-testid="admin-stats">
          <span>Users: <strong>{stats.data?.users ?? '…'}</strong></span>
          <span>Paid users: <strong>{stats.data?.paidUsers ?? '…'}</strong></span>
          <span>Free users: <strong>{stats.data?.freeUsers ?? '…'}</strong></span>
          <span>Overrides: <strong>{stats.data?.overrides ?? '…'}</strong></span>
          <span className="col-span-2" data-testid="admin-founding">Founding families: <strong>{stats.data ? `${stats.data.foundingMembers} of ${stats.data.foundingSeats}` : '…'}</strong></span>
          {stats.data?.unresolvedPayments ? (
            <span className="col-span-2 rounded-xl bg-destructive/10 px-3 py-2 font-semibold text-destructive" role="alert" data-testid="admin-unresolved-payments">
              {stats.data.unresolvedPayments} paid purchase{stats.data.unresolvedPayments === 1 ? '' : 's'} not matched to a party — reconcile (see BILLING_SECURITY.md)
            </span>
          ) : null}
        </Card>
      </Section>

      <Section title="Users">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setTerm(q.trim())
            setSelected(null)
          }}
        >
          <div className="flex-1">
            <TextField label="Search users" hideLabel placeholder="Search by email or name…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
          </div>
          <AppButton type="submit" variant="outline" aria-label="Search">
            <Search className="h-4 w-4" />
          </AppButton>
        </form>
        <Card className="mt-3 divide-y divide-border" data-testid="admin-user-list">
          {users.isLoading ? <Skeleton className="m-4 h-16" /> : null}
          {users.data?.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No users found.</p> : null}
          {users.data?.map((u) => (
            <button key={u.id} type="button" onClick={() => setSelected(u.id === selected ? null : u.id)} className="tap flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-muted" aria-expanded={u.id === selected}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.name || u.email}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
              </span>
              <span className="shrink-0 text-right text-xs">
                <strong className="block text-sm">{title(u.plan)}</strong>
                {SOURCE_LABEL[u.source]}
              </span>
            </button>
          ))}
        </Card>
        {picked ? (
          <Card className="mt-3 space-y-2 p-4" data-testid="admin-user-detail">
            <p className="font-semibold">{picked.name || 'User'}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{picked.email}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{fmt(picked.createdAt)}</dd>
              <dt className="text-muted-foreground">Trial</dt>
              <dd>{picked.trialActive ? 'Active' : 'Not active'}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{picked.role === 'super_admin' ? 'Super Admin' : 'User'}</dd>
            </dl>
            <PlanControls key={`${picked.id}-${picked.plan}-${picked.source}`} user={picked} onChanged={refresh} testId="user-plan" />
          </Card>
        ) : null}
      </Section>

      <Section title="Audit history">
        <Card className="divide-y divide-border" data-testid="admin-audit">
          {audit.data?.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No admin actions yet.</p> : null}
          {audit.data?.map((a) => (
            <div key={a.id} className="px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">{fmt(a.at)} · {a.by}</p>
              <p>
                <strong>{ACTION_LABEL[a.action] ?? a.action}</strong> {a.target ? `· ${a.target}` : ''}
              </p>
              {a.oldPlan || a.newPlan ? (
                <p className="text-xs text-muted-foreground">
                  {a.oldPlan ? title(a.oldPlan) : '—'} → {a.newPlan ? title(a.newPlan) : '—'}
                  {a.action.startsWith('override_s') || a.action === 'override_changed' ? ` · ${a.expiresAt ? `until ${fmt(a.expiresAt)}` : 'no expiration'}` : ''}
                </p>
              ) : null}
            </div>
          ))}
        </Card>
      </Section>
    </div>
  )
}
