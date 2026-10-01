'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Chip } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { useParty } from '@/components/app/PartyProvider'
import { updateParty, type Party } from '@/lib/data/parties'
import { friendlyError } from '@/lib/data/api'
import { INTERESTS, type InterestId } from '@/lib/discovery/taxonomy'
import { settingFromVenueType, venueTypeFromSetting } from '@/lib/discovery/party-context'
import { normalizeZip } from '@/lib/geo/zip'
import { localToday } from '@/lib/planning/checklist'

export function PartyEditSheet({ party, open, onOpenChange, focus }: { party: Party; open: boolean; onOpenChange: (o: boolean) => void; focus?: string | null }) {
  const { replaceParty } = useParty()
  const { mutate } = useSWRConfig()
  const [f, setF] = useState(() => toForm(party))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setF(toForm(party))
      setError(null)
    }
  }, [open, party])

  async function save() {
    setError(null)
    const zip = normalizeZip(f.zip)
    if (!f.name.trim()) return setError('Please enter a name.')
    if (!zip) return setError('Please enter a 5-digit US ZIP code.')
    if (!f.date || f.date < localToday()) return setError('Please pick a date that hasn’t passed.')
    const age = Number(f.age)
    const guests = Number(f.guests)
    if (!(age >= 1 && age <= 14)) return setError('Age should be between 1 and 14.')
    if (!(guests >= 1 && guests <= 200)) return setError('Guests should be between 1 and 200.')
    setBusy(true)
    try {
      const patch: Parameters<typeof updateParty>[1] = {
        child_name: f.name.trim(),
        child_age: age,
        party_date: f.date,
        guest_count: guests,
        budget: f.budget ? Number(f.budget) : null,
        venue_type: venueTypeFromSetting(f.setting),
        interests: f.interests,
      }
      if (zip !== party.zip_code) {
        const res = await fetch(`/api/discovery/zip?zip=${zip}`)
        if (!res.ok) {
          setBusy(false)
          return setError('We couldn’t find that ZIP code.')
        }
        const z = await res.json()
        Object.assign(patch, { zip_code: zip, latitude: z.lat, longitude: z.lng, city: z.city, state: z.state })
      }
      const updated = await updateParty(party.id, patch)
      replaceParty(updated)
      // Discovery depends on ZIP, interests, age, budget and vibe.
      await mutate((key) => Array.isArray(key) && key[0] === 'discovery' && key[1] === party.id, undefined, { revalidate: true })
      toast.success('Party updated')
      onOpenChange(false)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Party details"
      footer={
        <AppButton block size="lg" loading={busy} onClick={save}>
          Save changes
        </AppButton>
      }
    >
      <div className="space-y-4 pb-2">
        <TextField label="Child’s name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Turning" inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, '') })} />
          <TextField label="Guests" inputMode="numeric" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value.replace(/\D/g, '') })} />
        </div>
        <TextField label="Party date" type="date" min={localToday()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="ZIP code" inputMode="numeric" autoFocus={focus === 'zip'} value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} maxLength={10} />
          <TextField label="Budget ($)" inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, '') })} placeholder="Not sure" />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Vibe</legend>
          <div className="flex gap-2">
            {(['indoor', 'outdoor', 'either'] as const).map((s) => (
              <Chip key={s} active={f.setting === s} onClick={() => setF({ ...f, setting: s })}>
                {s === 'indoor' ? '🏠 Indoor' : s === 'outdoor' ? '🌳 Outdoor' : '✨ Either'}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Interests</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = f.interests.includes(i.id)
              return (
                <Chip key={i.id} active={on} onClick={() => setF({ ...f, interests: on ? f.interests.filter((x) => x !== i.id) : [...f.interests, i.id] })}>
                  {i.emoji} {i.label}
                </Chip>
              )
            })}
          </div>
        </fieldset>
        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  )
}

function toForm(p: Party) {
  return {
    name: p.child_name,
    age: String(p.child_age ?? ''),
    guests: String(p.guest_count ?? ''),
    date: p.party_date,
    zip: p.zip_code ?? '',
    budget: p.budget != null ? String(Math.round(Number(p.budget))) : '',
    setting: settingFromVenueType(p.venue_type),
    interests: (p.interests ?? []) as InterestId[],
  }
}
