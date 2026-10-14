'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Chip } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { CountrySelect } from '@/components/app/CountrySelect'
import { useParty } from '@/components/app/PartyProvider'
import { updateParty, type Party } from '@/lib/data/parties'
import { friendlyError } from '@/lib/data/api'
import { INTERESTS, type InterestId } from '@/lib/discovery/taxonomy'
import { settingFromVenueType, venueTypeFromSetting } from '@/lib/discovery/party-context'
import { countryConfig, selectableCountries, timezoneFor, type CountryCode } from '@/lib/country/countries'
import { currencySymbol } from '@/lib/country/format'
import { normalizePostal, postalFormatError, postalInputFilter } from '@/lib/country/postal'
import { localToday } from '@/lib/planning/checklist'
import { track } from '@/lib/analytics/client'

const clip = (v: string, n: number) => v.trim().slice(0, n) || null

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

  const cc = countryConfig(f.country)
  const countryChanged = f.country !== countryConfig(party.country_code).code
  const showCountry = selectableCountries().length > 1 || cc.code !== 'US'

  async function save() {
    setError(null)
    const zip = normalizePostal(f.country, f.zip)
    if (!f.name.trim()) return setError('Please enter a name.')
    if (!zip) return setError(postalFormatError(f.country))
    if (!f.date || f.date < localToday()) return setError('Please pick a date that hasn’t passed.')
    const age = Number(f.age)
    const guests = Number(f.guests)
    if (!(age >= 1 && age <= 14)) return setError('Age should be between 1 and 14.')
    if (!(guests >= 1 && guests <= 200)) return setError('Guests should be between 1 and 200.')
    if (f.budget && Number(f.budget) > cc.budget.max) return setError('That budget looks too large — please check it.')
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
        address_line1: clip(f.line1, 200),
        address_line2: clip(f.line2, 200),
        locality: cc.addressFields.includes('locality') ? clip(f.locality, 120) : null,
        district: cc.addressFields.includes('district') ? clip(f.district, 120) : null,
        city: clip(f.city, 120),
        state: clip(f.state, 120),
      }
      if (countryChanged) Object.assign(patch, { country_code: f.country, timezone: timezoneFor(f.country) })
      if (zip !== party.zip_code || countryChanged) {
        const res = await fetch(`/api/discovery/zip?zip=${zip}&country=${f.country}`)
        if (!res.ok) {
          setBusy(false)
          return setError(`We couldn’t find that ${cc.postal.label}.`)
        }
        const z = await res.json()
        // A new postal code relocates the party; the city/state the lookup found replace the old ones unless typed.
        Object.assign(patch, {
          zip_code: zip,
          latitude: z.lat,
          longitude: z.lng,
          city: f.cityEdited ? patch.city : z.city ?? null,
          state: f.stateEdited ? patch.state : z.state ?? null,
          ...(cc.addressFields.includes('district') && !f.district.trim() ? { district: z.district ?? null } : {}),
        })
      }
      const updated = await updateParty(party.id, patch)
      replaceParty(updated)
      if (countryChanged) track('country_selected', { country: f.country, from: 'party_edit' })
      // Discovery depends on country, postal code, interests, age, budget and vibe.
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
        {showCountry ? (
          <CountrySelect
            label="Country of the party"
            value={f.country}
            testId="party-country"
            onChange={(c: CountryCode) => setF({ ...f, country: c, zip: '', city: '', state: '', locality: '', district: '', cityEdited: false, stateEdited: false })}
            hint={countryChanged && f.budget ? `Amounts are not converted: your budget and costs will be shown in ${countryConfig(f.country).currency}. Please check them.` : undefined}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <TextField label={cc.postal.label} inputMode="numeric" autoFocus={focus === 'zip'} value={f.zip} placeholder={cc.postal.example} onChange={(e) => setF({ ...f, zip: postalInputFilter(f.country, e.target.value) })} maxLength={cc.postal.maxLength} />
          <TextField label={`Budget (${currencySymbol(f.country)})`} inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, '') })} placeholder="Not sure" />
        </div>
        <details className="rounded-2xl border border-border p-3" open={!!(f.line1 || f.locality)}>
          <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium">Event address (optional)</summary>
          <div className="space-y-3 pt-1">
            <TextField label="Address line 1" autoComplete="address-line1" value={f.line1} maxLength={200} onChange={(e) => setF({ ...f, line1: e.target.value })} placeholder={cc.code === 'IN' ? 'Flat / house no., building' : 'Street address'} />
            <TextField label="Address line 2 (optional)" autoComplete="address-line2" value={f.line2} maxLength={200} onChange={(e) => setF({ ...f, line2: e.target.value })} placeholder={cc.code === 'IN' ? 'Street, landmark' : 'Apt, suite'} />
            {cc.addressFields.includes('locality') ? (
              <TextField label="Locality / area" value={f.locality} maxLength={120} onChange={(e) => setF({ ...f, locality: e.target.value })} />
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <TextField label={cc.code === 'IN' ? 'City / town' : 'City'} autoComplete="address-level2" value={f.city} maxLength={120} onChange={(e) => setF({ ...f, city: e.target.value, cityEdited: true })} />
              {cc.addressFields.includes('district') ? (
                <TextField label="District" value={f.district} maxLength={120} onChange={(e) => setF({ ...f, district: e.target.value })} />
              ) : (
                <TextField label={cc.stateLabel} autoComplete="address-level1" value={f.state} maxLength={120} onChange={(e) => setF({ ...f, state: e.target.value, stateEdited: true })} />
              )}
            </div>
            {cc.addressFields.includes('district') ? (
              <TextField label={cc.stateLabel} autoComplete="address-level1" value={f.state} maxLength={120} onChange={(e) => setF({ ...f, state: e.target.value, stateEdited: true })} />
            ) : null}
            <p className="text-xs text-muted-foreground">Only you see this. Guests see what you write on the invitation.</p>
          </div>
        </details>
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
    country: countryConfig(p.country_code).code,
    zip: p.zip_code ?? '',
    budget: p.budget != null ? String(Math.round(Number(p.budget))) : '',
    setting: settingFromVenueType(p.venue_type),
    interests: (p.interests ?? []) as InterestId[],
    line1: p.address_line1 ?? '',
    line2: p.address_line2 ?? '',
    locality: p.locality ?? '',
    district: p.district ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    cityEdited: false,
    stateEdited: false,
  }
}
