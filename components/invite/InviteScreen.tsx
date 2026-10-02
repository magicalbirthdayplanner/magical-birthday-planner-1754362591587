'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useParty } from '@/components/app/PartyProvider'
import { AppButton, Card, EmptyState, LinkButton, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { TextArea, TextField } from '@/components/app/fields'
import { useChosenVenue, useGuests, useInvitation } from '@/lib/data/hooks'
import { emailInvitations, inviteUrl, markInvitationShared, rotateInvitationToken, saveInvitation, type InvitationInput, type PartyInvitation } from '@/lib/data/invitations'
import { completeTaskByKey } from '@/lib/data/checklist'
import { friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import { INVITE_DESIGNS, InvitationCard } from './InvitationCard'

export function InviteScreen() {
  const { party } = useParty()
  const { mutate } = useSWRConfig()
  const invitation = useInvitation(party?.id)
  const chosen = useChosenVenue(party?.id)
  const guests = useGuests(party?.id)
  const [emailing, setEmailing] = useState(false)
  const [form, setForm] = useState<InvitationInput>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (invitation.isLoading || dirty) return
    const inv = invitation.data
    const venue = chosen.data
    setForm({
      headline: inv?.headline ?? '',
      message: inv?.message ?? 'Come celebrate with cake, games and lots of fun!',
      host_name: inv?.host_name ?? '',
      location_text: inv?.location_text ?? (venue ? `${venue.name}${venue.address ? `\n${venue.address}` : ''}` : ''),
      start_time: inv?.start_time?.slice(0, 5) ?? '14:00',
      end_time: inv?.end_time?.slice(0, 5) ?? '16:00',
      rsvp_by: inv?.rsvp_by ?? '',
      design: inv?.design ?? 'classic',
    })
  }, [invitation.data, invitation.isLoading, chosen.data, dirty])

  if (!party) return <EmptyState icon="💌" title="No party yet" action={<LinkButton href="/start" block>Plan a party</LinkButton>} />
  const set = (patch: Partial<InvitationInput>) => {
    setDirty(true)
    setForm((f) => ({ ...f, ...patch }))
  }

  async function persist(): Promise<PartyInvitation | null> {
    setSaving(true)
    try {
      const saved = await saveInvitation(party!.id, form)
      await invitation.mutate(saved, { revalidate: false })
      setDirty(false)
      return saved
    } catch (e) {
      toast.error(friendlyError(e, 'Couldn’t save the invitation.'))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function afterShare(inv: PartyInvitation, channel: string) {
    await markInvitationShared(inv)
    await completeTaskByKey(party!.id, 'send-invites').catch(() => undefined)
    await Promise.all([invitation.mutate(), mutate(['checklist', party!.id])])
    track('invitation_shared', { channel, design: inv.design })
  }

  async function share(channel: 'native' | 'copy' | 'sms' | 'email') {
    const inv = dirty || !invitation.data ? await persist() : invitation.data
    if (!inv) return
    const url = inviteUrl(inv.token)
    const first = party!.child_name.split(' ')[0]
    const text = `You’re invited to ${first}’s birthday party! RSVP here:`
    try {
      if (channel === 'native' && navigator.share) {
        await navigator.share({ title: `${first}’s birthday party`, text, url })
      } else if (channel === 'sms') {
        window.location.href = `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`
      } else if (channel === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(`${first}’s birthday party`)}&body=${encodeURIComponent(`${text}\n${url}`)}`
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Invite link copied')
      }
      await afterShare(inv, channel === 'native' && !navigator.share ? 'copy' : channel)
    } catch {
      /* share sheet dismissed */
    }
  }

  const view = {
    childName: party.child_name,
    childAge: party.child_age,
    partyDate: party.party_date,
    startTime: form.start_time,
    endTime: form.end_time,
    locationText: form.location_text,
    headline: form.headline,
    message: form.message,
    hostName: form.host_name,
    rsvpBy: form.rsvp_by,
    design: form.design,
  }

  return (
    <div className="pb-4">
      <PageHeader back="/plan" title="Invitation" subtitle={invitation.data?.share_count ? `Shared ${invitation.data.share_count}× · RSVPs land in Guests` : 'Create it, preview it, text the link.'} />
      {invitation.isLoading ? (
        <div className="px-4">
          <Skeleton className="h-96 w-full rounded-[32px]" />
        </div>
      ) : (
        <>
          <div className="px-4">
            <InvitationCard inv={view} />
          </div>
          <div className="no-scrollbar mt-4 flex justify-center gap-3 px-4" role="radiogroup" aria-label="Design">
            {INVITE_DESIGNS.map((d) => (
              <button key={d.id} type="button" role="radio" aria-checked={form.design === d.id} onClick={() => set({ design: d.id })} className="tap flex flex-col items-center gap-1 text-xs font-medium">
                <span className={cn('h-11 w-11 rounded-full border-2', d.swatch, form.design === d.id ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border')} />
                {d.label}
              </button>
            ))}
          </div>

          <Section title="Share" className="pt-5">
            <AppButton block size="lg" variant="magic" loading={saving} onClick={() => share('native')}>
              <Share2 className="h-5 w-5" /> Share invitation
            </AppButton>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ['sms', MessageCircle, 'Text'],
                  ['email', Mail, 'Email'],
                  ['copy', Copy, 'Copy link'],
                ] as const
              ).map(([ch, Icon, label]) => (
                <button key={ch} type="button" onClick={() => share(ch)} className="tap flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-sm font-medium active:bg-muted">
                  <Icon className="h-5 w-5 text-primary" /> {label}
                </button>
              ))}
            </div>
            {(() => {
              const pending = (guests.data ?? []).filter((g) => g.email && g.invite_status === 'NOT_SENT').length
              return pending ? (
                <AppButton
                  variant="outline"
                  block
                  className="mt-3"
                  loading={emailing}
                  onClick={async () => {
                    setEmailing(true)
                    try {
                      if (dirty || !invitation.data) await persist()
                      const r = await emailInvitations(party!.id)
                      await Promise.all([guests.mutate(), invitation.mutate(), mutate(['checklist', party!.id])])
                      if (r.sent) {
                        await completeTaskByKey(party!.id, 'send-invites').catch(() => undefined)
                        track('invitation_shared', { channel: 'email', count: r.sent })
                        toast.success(`Invitation emailed to ${r.sent} famil${r.sent === 1 ? 'y' : 'ies'}`)
                      }
                      if (r.failed) toast.error(`${r.failed} email${r.failed === 1 ? '' : 's'} couldn’t be sent`)
                    } catch (e) {
                      toast.error(friendlyError(e, 'Couldn’t send emails.'))
                    } finally {
                      setEmailing(false)
                    }
                  }}
                >
                  <Mail className="h-4 w-4" /> Email {pending} guest{pending === 1 ? '' : 's'} with an email address
                </AppButton>
              ) : null
            })()}
            <p className="mt-2 text-center text-xs text-muted-foreground">Anyone with the link can see the invitation and RSVP. Your other party details stay private.</p>
            {invitation.data ? (
              <button
                type="button"
                className="mt-2 block w-full text-center text-xs font-semibold text-muted-foreground underline underline-offset-4"
                onClick={async () => {
                  if (!window.confirm('Turn off the current link and create a new one? People with the old link won’t be able to RSVP.')) return
                  try {
                    const next = await rotateInvitationToken(invitation.data!)
                    await invitation.mutate(next, { revalidate: false })
                    toast.success('New link created — the old one no longer works')
                  } catch (e) {
                    toast.error(friendlyError(e))
                  }
                }}
              >
                Reset link
              </button>
            ) : null}
          </Section>

          <Section title="Details">
            <Card className="space-y-4 p-4">
              <TextField label="Headline (optional)" value={form.headline ?? ''} onChange={(e) => set({ headline: e.target.value })} placeholder={`${party.child_name.split(' ')[0]}’s Birthday Party`} maxLength={120} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Starts" type="time" value={form.start_time ?? ''} onChange={(e) => set({ start_time: e.target.value })} />
                <TextField label="Ends" type="time" value={form.end_time ?? ''} onChange={(e) => set({ end_time: e.target.value })} />
              </div>
              <TextArea label="Where" value={form.location_text ?? ''} onChange={(e) => set({ location_text: e.target.value })} rows={2} maxLength={200} placeholder="Venue name and address" />
              <TextArea label="Message" value={form.message ?? ''} onChange={(e) => set({ message: e.target.value })} maxLength={1000} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="From" value={form.host_name ?? ''} onChange={(e) => set({ host_name: e.target.value })} placeholder="The Smiths" maxLength={80} />
                <TextField label="RSVP by" type="date" value={form.rsvp_by ?? ''} max={party.party_date} onChange={(e) => set({ rsvp_by: e.target.value })} />
              </div>
              <AppButton block variant="outline" loading={saving} disabled={!dirty} onClick={persist}>
                {dirty ? 'Save changes' : 'Saved'}
              </AppButton>
            </Card>
          </Section>
        </>
      )}
    </div>
  )
}
