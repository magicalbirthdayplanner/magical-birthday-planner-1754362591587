'use client'
/**
 * 🎤 Party Host: welcome speech, activity introductions, cake announcement, closing speech, reminder and thank-you
 * messages. Generate → Copy / Edit / Try another / Save to party. Saved pieces live on the party; nothing is sent.
 */
import { useEffect, useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, Chip } from '@/components/app/ui'
import { TextArea } from '@/components/app/fields'
import { AIError, AIProgress } from '@/components/ai/AIProgress'
import { useAIGenerate } from '@/components/ai/useAI'
import type { HostItem, HostKind, HostResult } from '@/lib/ai/features/hostContent.types'
import { removeHostContent, saveHostContent, type Activity, type HostContent } from '@/lib/data/experience'
import { act, applySuggestion } from './apply'

export const HOST_LABELS: Record<HostKind, string> = {
  welcome: 'Welcome speech', activity_intro: 'Activity introduction', cake: 'Cake announcement', closing: 'Closing speech',
  reminder: 'Reminder message', thank_you_all: 'Thank everyone', thank_you_guest: 'Thank each guest',
}
const ORDER: HostKind[] = ['welcome', 'activity_intro', 'cake', 'closing', 'reminder', 'thank_you_all', 'thank_you_guest']
const TONES = ['warm', 'playful', 'excited', 'short and sweet'] as const

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied.')
  } catch {
    toast('Select the text to copy it.')
  }
}

export function HostStudioSheet({ partyId, open, onOpenChange, activities, saved, preset, onUsed }: {
  partyId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  activities: Activity[]
  saved: HostContent[]
  preset?: { kind: HostKind; activityId?: string } | null
  onUsed?: () => void
}) {
  const gen = useAIGenerate<HostResult>('/api/ai/host')
  const [kind, setKind] = useState<HostKind>('welcome')
  const [activityId, setActivityId] = useState<string | null>(null)
  const [tone, setTone] = useState<(typeof TONES)[number]>('warm')
  useEffect(() => {
    if (open && preset) {
      setKind(preset.kind)
      if (preset.activityId) setActivityId(preset.activityId)
    }
  }, [open, preset])
  const planned = activities.filter((a) => a.status === 'planned')
  const needsActivity = kind === 'activity_intro' && !activityId
  const run = async () => {
    await gen.run({ partyId, kind, tone, ...(kind === 'activity_intro' && activityId ? { activityId } : {}), regenerate: true })
    onUsed?.()
  }
  const s = gen.state
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) gen.cancel(); onOpenChange(o) }} title="🎤 Party host" description="Speeches and messages for your party. Nothing is ever sent for you.">
      <div className="space-y-4 pb-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to write">
          {ORDER.map((k) => <Chip key={k} role="radio" aria-checked={kind === k} active={kind === k} onClick={() => { setKind(k); gen.reset() }}>{HOST_LABELS[k]}</Chip>)}
        </div>
        {kind === 'activity_intro' ? (
          planned.length ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which activity">
              {planned.map((a) => <Chip key={a.id} role="radio" aria-checked={activityId === a.id} active={activityId === a.id} onClick={() => setActivityId(a.id)}>{a.name}</Chip>)}
            </div>
          ) : <p className="text-sm text-muted-foreground">Add an activity to your party first.</p>
        ) : null}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
          {TONES.map((t) => <Chip key={t} role="radio" aria-checked={tone === t} active={tone === t} onClick={() => setTone(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</Chip>)}
        </div>
        {s.phase === 'loading' ? <AIProgress steps={['✨ Writing something special for your party…', 'Making it easy to read aloud…']} onCancel={gen.cancel} /> : null}
        {s.phase === 'error' ? <AIError message={s.code === 'provider_error' || s.code === 'invalid_response' || s.code === 'timeout' ? 'We couldn’t create that right now. Your party plan is safe.' : s.message} onRetry={s.code === 'limit_reached' || s.code === 'forbidden_plan' ? undefined : run} upgradeTo={s.code === 'forbidden_plan' || s.code === 'limit_reached' ? 'starter' : null} /> : null}
        {s.phase === 'done' ? (
          s.result.items.length ? (
            <div className="space-y-3" aria-live="polite">
              {s.result.items.map((it) => <Draft key={`${s.generationId}-${it.id}`} partyId={partyId} generationId={s.generationId} item={it} />)}
            </div>
          ) : <p className="text-sm text-muted-foreground">No confirmed guests yet — thank-yous are written for guests who said yes.</p>
        ) : null}
        {s.phase !== 'loading' ? (
          <AppButton block size="lg" variant="magic" disabled={needsActivity} onClick={run}>{s.phase === 'done' ? '✨ Try another' : `✨ Write my ${HOST_LABELS[kind].toLowerCase()}`}</AppButton>
        ) : null}
        {saved.length ? (
          <section className="space-y-2 pt-2">
            <h3 className="text-base font-bold">Saved to your party</h3>
            {saved.map((h) => <SavedPiece key={h.id} partyId={partyId} h={h} />)}
          </section>
        ) : null}
      </div>
    </BottomSheet>
  )
}

function Draft({ partyId, generationId, item }: { partyId: string; generationId: string; item: HostItem }) {
  const [text, setText] = useState(item.body)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const save = async () => {
    if (await applySuggestion(partyId, { generationId, itemId: item.id, target: 'host', ...(text.trim() !== item.body ? { edits: { body: text.trim() } } : {}) })) setSaved(true)
  }
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-primary">{item.title || HOST_LABELS[item.kind]}</p>
      {editing ? <TextArea label="Edit the text" hideLabel value={text} rows={6} maxLength={4000} onChange={(e) => setText(e.target.value)} /> : <p className="whitespace-pre-line text-[15px] leading-relaxed">{text}</p>}
      <div className="flex flex-wrap gap-2">
        <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={() => copy(text)}><Copy className="h-4 w-4" /> Copy</AppButton>
        <AppButton size="sm" variant="outline" className="min-h-[44px]" onClick={() => setEditing((x) => !x)} aria-pressed={editing}><Pencil className="h-4 w-4" /> {editing ? 'Done' : 'Edit'}</AppButton>
        {saved ? <span className="inline-flex min-h-[44px] items-center text-sm font-semibold text-success" role="status">✓ Saved</span> : <AppButton size="sm" className="min-h-[44px]" onClick={save}>Save to party</AppButton>}
      </div>
    </Card>
  )
}

function SavedPiece({ partyId, h }: { partyId: string; h: HostContent }) {
  const [text, setText] = useState(h.body)
  const [editing, setEditing] = useState(false)
  return (
    <Card className="space-y-2 p-4">
      <p className="text-sm font-semibold">{h.title || HOST_LABELS[h.kind as HostKind] || 'Message'}{h.user_edited ? <span className="ml-1 text-xs font-normal text-muted-foreground">· edited by you</span> : null}</p>
      {editing ? <TextArea label="Edit the text" hideLabel value={text} rows={6} maxLength={4000} onChange={(e) => setText(e.target.value)} /> : <p className="whitespace-pre-line text-sm leading-relaxed">{h.body}</p>}
      <div className="flex flex-wrap gap-2">
        <AppButton size="sm" variant="secondary" className="min-h-[44px]" onClick={() => copy(h.body)}><Copy className="h-4 w-4" /> Copy</AppButton>
        {editing ? (
          <AppButton size="sm" className="min-h-[44px]" onClick={async () => { await act(partyId, () => saveHostContent(h.id, text.trim()), 'Saved.'); setEditing(false) }} disabled={!text.trim()}>Save</AppButton>
        ) : (
          <AppButton size="sm" variant="outline" className="min-h-[44px]" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</AppButton>
        )}
        <button type="button" aria-label={`Delete ${h.title || 'message'}`} onClick={() => act(partyId, () => removeHostContent(h.id), 'Removed.')} className="tap flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted"><Trash2 className="h-4 w-4" /></button>
      </div>
    </Card>
  )
}
