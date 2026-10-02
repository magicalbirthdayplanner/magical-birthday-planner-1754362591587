'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronRight, Download, FileText, LogOut, Plus, Settings, Shield, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useParty } from '@/components/app/PartyProvider'
import { AppButton, Card, PageHeader, Section } from '@/components/app/ui'
import { BottomSheet } from '@/components/app/BottomSheet'
import { deleteParty } from '@/lib/data/parties'
import { friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { useInstallPrompt } from '@/components/app/useInstallPrompt'
import useSWR from 'swr'
import { apiFetch } from '@/lib/data/api'
import { cn } from '@/lib/utils'
import { AccountSettings } from './AccountSettings'

function LinkRow({ href, icon: Icon, label, external }: { href: string; icon: typeof Settings; label: string; external?: boolean }) {
  return (
    <Link href={href} target={external ? '_blank' : undefined} className="tap flex min-h-[56px] items-center gap-3 px-4 active:bg-muted">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  )
}

export function MoreScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { parties, party, setActivePartyId, refreshParties } = useParty()
  const install = useInstallPrompt()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const billing = useSWR(user ? ['billing', user.id] : null, () => apiFetch<{ plan: string; trialActive: boolean }>('/api/billing/status'), { revalidateOnFocus: true })

  useEffect(() => {
    if (window.location.hash === '#parties') document.getElementById('parties')?.scrollIntoView()
  }, [])

  const name = (user?.user_metadata?.display_name || user?.user_metadata?.full_name || '').toString()

  async function doDelete(id: string) {
    setBusy(true)
    try {
      await deleteParty(id)
      await refreshParties()
      toast('Party deleted')
      setConfirmDelete(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function onInstall() {
    if (install.canPrompt) {
      track('pwa_install_prompted')
      const outcome = await install.prompt()
      if (outcome === 'accepted') track('pwa_installed')
    } else setIosHelp(true)
  }

  return (
    <div className="pb-6">
      <PageHeader title="More" />
      <div className="px-4">
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hero text-xl font-semibold text-white">{(name || user?.email || '?').charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name || 'Your account'}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </Card>
      </div>

      <Section>
        <Link href="/pricing" className="tap flex items-center justify-between rounded-2xl border border-border bg-card p-4" data-testid="plan-row">
          <span>
            <span className="block text-sm text-muted-foreground">Your plan</span>
            <span className="block font-semibold">{billing.data ? `${billing.data.plan.charAt(0)}${billing.data.plan.slice(1).toLowerCase()}${billing.data.trialActive ? ' (trial)' : ''}` : '…'}</span>
          </span>
          <span className="text-sm font-semibold text-primary">{billing.data?.plan === 'PRO' ? 'Manage' : 'Upgrade'}</span>
        </Link>
      </Section>

      <Section title="Your parties" action={<Link href="/start" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> New party</Link>}>
        <div id="parties" />
        <Card className="divide-y divide-border">
          {parties.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No parties yet.</p> : null}
          {parties.map((p) => {
            const active = p.id === party?.id
            return (
              <div key={p.id} className="flex items-center gap-2 pr-2">
                <button type="button" onClick={() => { setActivePartyId(p.id); router.push('/home') }} className="tap flex min-h-[64px] flex-1 items-center gap-3 px-4 text-left active:bg-muted" aria-current={active ? 'true' : undefined}>
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-full text-lg', active ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>{active ? <Check className="h-5 w-5" /> : '🎂'}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.child_name} turns {p.child_age}</span>
                    <span className="block text-sm text-muted-foreground">{new Date(`${p.party_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </span>
                </button>
                <button type="button" aria-label={`Delete ${p.child_name}’s party`} onClick={() => setConfirmDelete(p.id)} className="tap flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </Card>
      </Section>

      {!install.installed ? (
        <Section>
          <button type="button" onClick={onInstall} className="tap flex w-full items-center gap-3 rounded-2xl bg-secondary p-4 text-left">
            <Download className="h-6 w-6 text-primary" />
            <span>
              <span className="block font-semibold">Add to your home screen</span>
              <span className="block text-sm text-muted-foreground">Opens full-screen, like an app.</span>
            </span>
          </button>
        </Section>
      ) : null}

      <Section title="Account">
        <AccountSettings />
      </Section>

      <Section title="About">
        <Card className="divide-y divide-border">
          <LinkRow href="/privacy" icon={Shield} label="Privacy" />
          <LinkRow href="/terms" icon={FileText} label="Terms" />
        </Card>
        <p className="mt-3 px-1 text-xs text-muted-foreground">Place data © Google Maps. ZIP code data © GeoNames (CC BY 4.0).</p>
      </Section>

      <Section>
        <AppButton
          variant="outline"
          block
          onClick={async () => {
            router.replace('/home')
            await signOut()
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </AppButton>
      </Section>

      <BottomSheet
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this party?"
        description="Guests, saved places, checklist and invitation for this party will be deleted. This can’t be undone."
        footer={
          <div className="flex gap-3">
            <AppButton variant="ghost" block onClick={() => setConfirmDelete(null)}>
              Keep it
            </AppButton>
            <AppButton variant="danger" block loading={busy} onClick={() => confirmDelete && doDelete(confirmDelete)}>
              Delete
            </AppButton>
          </div>
        }
      >
        <span />
      </BottomSheet>

      <BottomSheet open={iosHelp} onOpenChange={setIosHelp} title="Add to home screen">
        <ol className="list-inside list-decimal space-y-2 pb-4 text-[15px]">
          <li>
            Tap the <strong>Share</strong> button in Safari’s toolbar.
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Open it from your home screen any time.
          </li>
        </ol>
      </BottomSheet>
    </div>
  )
}
