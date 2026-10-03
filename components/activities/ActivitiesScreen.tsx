'use client'
/**
 * Activities tab: the party's activities (planned + saved ideas), "✨ Create an activity", add your own, and
 * gentle prompts when the guest count or theme moved since an activity was made. Cards open the detail sheet.
 */
import { useState } from 'react'
import { Check, ChevronRight, Clock, Plus } from 'lucide-react'
import { useParty } from '@/components/app/PartyProvider'
import { AppButton, Card, EmptyState, LinkButton, Section, Skeleton } from '@/components/app/ui'
import { useAICapabilities } from '@/components/ai/useAI'
import { HostStudioSheet } from '@/components/experience/HostStudioSheet'
import { act } from '@/components/experience/apply'
import { addActivityToTimeline, setActivityStatus, useExperience, type Activity, type Experience } from '@/lib/data/experience'
import { activitySummary, costRange, formatMinutes, guestDrift } from '@/lib/experience/model'
import { fromRow } from '@/lib/experience/view'
import { activityMeta } from './ActivitySections'
import { ActivityCreatorSheet } from './ActivityCreatorSheet'
import { ActivityDetailSheet } from './ActivityDetailSheet'
import { ActivityFormSheet } from './ActivityFormSheet'
import { usePartyFacts } from './usePartyFacts'

export function ActivitiesScreen() {
  const { party, isLoading } = useParty()
  const exp = useExperience(party?.id)
  const facts = usePartyFacts(party)
  const caps = useAICapabilities(party?.id)
  const studio = caps.get('activity_studio')
  const host = caps.get('host_content')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null })
  const [intro, setIntro] = useState<{ kind: 'activity_intro'; activityId: string } | null>(null)

  if (isLoading || (party && !exp.data && !exp.error)) {
    return (
      <div className="space-y-3 px-4 pt-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    )
  }
  if (!party) return <EmptyState icon="🎈" title="No party yet" body="Plan a party first, then fill it with activities." action={<LinkButton href="/start" block size="lg">Plan a party</LinkButton>} />
  const data: Experience = exp.data ?? { activities: [], timeline: [], food: [], host: [], linked: { tasks: new Set(), shopping: new Map(), budget: new Set() } }
  const planned = data.activities.filter((a) => a.status === 'planned')
  const ideas = data.activities.filter((a) => a.status === 'idea')
  const sum = activitySummary(data.activities)
  const drifted = planned.filter((a) => guestDrift(a.designed_for_guests, facts?.guests))
  const opened = data.activities.find((a) => a.id === openId) ?? null
  const studioOn = !!studio?.enabled
  const studioUsable = studioOn && studio!.allowed && studio!.remaining !== 0

  return (
    <div className="pb-4">
      <div className="px-4 pt-5">
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">Activities</h1>
        {facts?.label ? <p className="mt-1 text-sm font-semibold text-primary">{facts.label}</p> : null}
        <p className="mt-1 text-sm text-muted-foreground">{sum.planned ? `${sum.planned} planned · ${formatMinutes(sum.minutes)}${facts?.minutes ? ` of ${formatMinutes(facts.minutes)}` : ''}${sum.estimatedCost ? ` · about ${costRange(sum.estimatedCost)}` : ''}` : 'Games, crafts and treasure hunts for the party.'}</p>
      </div>

      {studioOn ? (
        <div className="px-4 pt-4">
          {studioUsable ? (
            <button type="button" onClick={() => setCreating(true)} className="tap block w-full text-left" data-testid="create-activity">
              <Card className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-hero text-xl text-white" aria-hidden>✨</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Create an activity</span>
                  <span className="block text-sm text-muted-foreground">Tell us what you have in mind and we’ll create it for your party.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Card>
            </button>
          ) : (
            <a href={`/pricing?upgrade=${(studio!.upgradeTo ?? 'plus').toLowerCase()}`} className="tap block">
              <Card className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-xl" aria-hidden>✨</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Create an activity</span>
                  <span className="block text-sm text-muted-foreground">{studio!.allowed ? 'You’ve used this party’s AI suggestions' : `Included with ${studio!.upgradeTo ? studio!.upgradeTo.charAt(0) + studio!.upgradeTo.slice(1).toLowerCase() : 'a paid plan'}`}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Card>
            </a>
          )}
        </div>
      ) : null}

      {drifted.length && studioUsable ? (
        <div className="px-4 pt-3">
          <Card className="p-4 text-sm" role="status">
            ✨ You now have {facts?.guests} guests. {drifted.length === 1 ? `“${drifted[0].name}” was` : `${drifted.length} activities were`} made for fewer or more — open {drifted.length === 1 ? 'it' : 'one'} and tap <span className="font-semibold">Adjust it</span> to update quantities. Nothing changes until you choose.
          </Card>
        </div>
      ) : null}

      <Section title="✨ Your party activities" className="pt-5" action={<button type="button" onClick={() => setForm({ open: true, activity: null })} className="tap -my-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Add your own</button>}>
        {planned.length ? (
          <div className="space-y-3">{planned.map((a) => <ActivityCard key={a.id} a={a} data={data} onOpen={() => setOpenId(a.id)} partyId={party.id} />)}</div>
        ) : (
          <Card className="p-5 text-center text-sm text-muted-foreground">No activities yet. {studioUsable ? 'Create one with ✨ or add your own.' : 'Add your own to start.'}</Card>
        )}
      </Section>

      {ideas.length ? (
        <Section title="Saved ideas">
          <div className="space-y-3">{ideas.map((a) => <ActivityCard key={a.id} a={a} data={data} onOpen={() => setOpenId(a.id)} partyId={party.id} />)}</div>
        </Section>
      ) : null}

      {studioOn ? <ActivityCreatorSheet partyId={party.id} open={creating} onOpenChange={setCreating} basedOn={facts?.basedOn ?? 'Based on your party details.'} onUsed={() => caps.mutate()} /> : null}
      <ActivityDetailSheet
        partyId={party.id}
        partyDate={party.party_date}
        activity={opened}
        experience={data}
        facts={{ guests: facts?.guests ?? null, theme: facts?.theme ?? null }}
        aiEditing={studioUsable}
        basedOn={facts?.basedOn}
        open={!!opened}
        onOpenChange={(o) => !o && setOpenId(null)}
        onEdit={(a) => { setOpenId(null); setForm({ open: true, activity: a }) }}
        onIntro={host?.enabled && host.allowed ? (a) => { setOpenId(null); setIntro({ kind: 'activity_intro', activityId: a.id }) } : undefined}
        onUsed={() => caps.mutate()}
      />
      <ActivityFormSheet partyId={party.id} activity={form.activity} open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} context={{ guests: facts?.guests ?? null, theme: facts?.theme ?? null }} />
      {host?.enabled ? <HostStudioSheet basedOn={facts?.basedOn} partyId={party.id} open={!!intro} onOpenChange={(o) => !o && setIntro(null)} activities={data.activities} saved={data.host} preset={intro} onUsed={() => caps.mutate()} /> : null}
    </div>
  )
}

function ActivityCard({ a, data, onOpen, partyId }: { a: Activity; data: Experience; onOpen: () => void; partyId: string }) {
  const v = fromRow(a)
  const onTimeline = data.timeline.some((t) => t.activity_id === a.id)
  return (
    <Card className="overflow-hidden" data-testid="activity-card">
      <button type="button" onClick={onOpen} className="tap block w-full p-4 text-left active:bg-muted" aria-label={`Open ${a.name}`}>
        <p className="font-display text-lg font-bold leading-snug"><span aria-hidden>{v.emoji}</span> {a.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{activityMeta(v)}</p>
        {v.description ? <p className="mt-2 line-clamp-2 text-[15px]">{v.description}</p> : null}
        <p className="mt-2 text-sm"><span className="font-semibold">Estimated cost:</span> {costRange(a.estimated_cost)}{v.materials.length ? <span className="text-muted-foreground"> · {v.materials.length} supplies</span> : null}</p>
      </button>
      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {a.status === 'planned' ? (
          <span className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-success"><Check className="h-4 w-4" /> Added</span>
        ) : (
          <AppButton size="sm" className="min-h-[44px]" onClick={() => act(partyId, () => setActivityStatus(a.id, 'planned'), 'Added to your party.')}>Add to party</AppButton>
        )}
        {a.status === 'planned' ? (
          onTimeline ? <span className="inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> On timeline</span> : (
            <AppButton size="sm" variant="outline" className="min-h-[44px]" onClick={() => act(partyId, () => addActivityToTimeline(a, data.timeline), 'Added to your timeline.')}><Clock className="h-4 w-4" /> Add to timeline</AppButton>
          )
        ) : null}
        <AppButton size="sm" variant="ghost" className="ml-auto min-h-[44px]" onClick={onOpen}>Details</AppButton>
      </div>
    </Card>
  )
}
