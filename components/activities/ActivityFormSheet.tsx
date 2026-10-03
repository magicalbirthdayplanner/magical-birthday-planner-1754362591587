'use client'
/** Add your own activity, or edit one (the parent's edit is marked so AI never silently replaces it). */
import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Chip } from '@/components/app/ui'
import { TextArea, TextField } from '@/components/app/fields'
import { useAuth } from '@/contexts/AuthContext'
import { createActivity, updateActivity, type Activity } from '@/lib/data/experience'
import { act } from '@/components/experience/apply'

const num = (s: string) => (s.trim() && Number.isFinite(Number(s)) ? Number(s) : null)

export function ActivityFormSheet({ partyId, activity, open, onOpenChange, context }: { partyId: string; activity: Activity | null; open: boolean; onOpenChange: (o: boolean) => void; context: { guests: number | null; theme: string | null } }) {
  const { user } = useAuth()
  const [f, setF] = useState({ name: '', description: '', minutes: '', setting: 'either' as 'indoor' | 'outdoor' | 'either', ageMin: '', ageMax: '', cost: '', materials: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setF(activity
      ? { name: activity.name, description: activity.description ?? '', minutes: activity.duration_min?.toString() ?? '', setting: (activity.setting as 'indoor' | 'outdoor' | 'either') ?? 'either', ageMin: activity.age_min?.toString() ?? '', ageMax: activity.age_max?.toString() ?? '', cost: activity.estimated_cost != null ? String(Number(activity.estimated_cost)) : '', materials: (activity.materials ?? []).join('\n') }
      : { name: '', description: '', minutes: '20', setting: 'either', ageMin: '', ageMax: '', cost: '', materials: '' })
  }, [open, activity])
  const save = async () => {
    if (!user || f.name.trim().length < 2) return
    setBusy(true)
    const input = {
      name: f.name.trim().slice(0, 120), description: f.description.trim().slice(0, 1000) || null, duration_min: num(f.minutes) != null ? Math.min(600, Math.max(0, Math.round(num(f.minutes)!))) : null, setting: f.setting,
      age_min: num(f.ageMin) != null ? Math.min(18, Math.max(0, Math.round(num(f.ageMin)!))) : null, age_max: num(f.ageMax) != null ? Math.min(18, Math.max(0, Math.round(num(f.ageMax)!))) : null,
      estimated_cost: num(f.cost) != null ? Math.min(100000, Math.max(0, num(f.cost)!)) : null, materials: f.materials.split('\n').map((m) => m.trim()).filter(Boolean).slice(0, 15).map((m) => m.slice(0, 80)),
    }
    const ok = await act(partyId, () => (activity ? updateActivity(activity.id, input) : createActivity(partyId, user.id, input, 'planned', context)), activity ? 'Activity saved.' : 'Added to your party.')
    setBusy(false)
    if (ok !== undefined) onOpenChange(false)
  }
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={activity ? 'Edit activity' : 'Add your own activity'}
      footer={<AppButton block size="lg" loading={busy} disabled={f.name.trim().length < 2} onClick={save}>{activity ? 'Save changes' : 'Add to party'}</AppButton>}
    >
      <div className="space-y-3 pb-2">
        <TextField label="Name" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Galaxy Rescue Mission" />
        <TextArea label="Description" value={f.description} maxLength={1000} rows={3} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <TextField label="Minutes" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          <TextField label="Age from" inputMode="numeric" value={f.ageMin} onChange={(e) => setF({ ...f, ageMin: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          <TextField label="Age to" inputMode="numeric" value={f.ageMax} onChange={(e) => setF({ ...f, ageMax: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Indoor or outdoor">
          {(['indoor', 'outdoor', 'either'] as const).map((v) => <Chip key={v} role="radio" aria-checked={f.setting === v} active={f.setting === v} onClick={() => setF({ ...f, setting: v })} className="capitalize">{v}</Chip>)}
        </div>
        <TextField label="Estimated cost $" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) })} hint="An estimate — what you actually spend goes in your budget." />
        <TextArea label="Supplies (one per line)" value={f.materials} rows={3} onChange={(e) => setF({ ...f, materials: e.target.value })} placeholder={'Glow sticks × 20\nSmall treasure bags × 15'} />
      </div>
    </BottomSheet>
  )
}
