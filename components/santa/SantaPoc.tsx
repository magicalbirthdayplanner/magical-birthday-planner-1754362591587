'use client'

/** Proof-of-concept harness for the live Santa call: fill in a child profile, then call Santa. Not the product UI. */
import { useMemo, useRef, useState } from 'react'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { SANTA_STYLE_GUIDE, SANTA_STYLES, SantaChildProfileSchema, santaGreeting, type SantaStyle } from '@/lib/santa/persona'
import { SantaCall, type SantaCallApi } from './SantaCall'
import { StorybookSanta, type SantaMode } from './StorybookSanta'
import { PhotoSanta } from './PhotoSanta'

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6)

export function SantaPoc() {
  const [form, setForm] = useState({ firstName: 'Emma', pronunciation: '', age: '6', style: 'traditional' as SantaStyle, loves: 'dinosaurs, drawing, unicorns', celebrate: 'learned to ride a bicycle', encourage: 'reading', wishes: 'a red bike', avoid: '', kind: 'visit' as 'visit' | 'preview', maxSeconds: '180', avatar: 'simli' as 'photo' | 'storybook' | 'simli', face: 'victor' })
  const [calling, setCalling] = useState(false)
  const [look, setLook] = useState<SantaMode>('speaking')
  const [lookKind, setLookKind] = useState<'photo' | 'storybook'>('photo')
  const [error, setError] = useState<string | null>(null)
  const callId = useRef<string | null>(null)

  const profile = useMemo(
    () =>
      SantaChildProfileSchema.safeParse({
        firstName: form.firstName,
        pronunciation: form.pronunciation,
        age: Number(form.age),
        style: form.style,
        loves: list(form.loves),
        celebrate: list(form.celebrate),
        encourage: list(form.encourage),
        wishes: list(form.wishes),
        avoid: form.avoid,
      }),
    [form],
  )
  const maxSeconds = Math.min(600, Math.max(30, Number(form.maxSeconds) || 180))

  const api: SantaCallApi = useMemo(() => {
    const body = (extra: object) => JSON.stringify({ profile: profile.success ? profile.data : null, kind: form.kind, maxSeconds, avatar: form.avatar === 'simli' ? 'simli' : 'storybook', face: form.avatar === 'simli' ? form.face : undefined, ...extra })
    return {
      begin: () => apiFetch<{ avatarToken: string | null; maxSeconds: number }>('/api/santa/poc', { method: 'POST', body: body({ action: 'begin' }) }).catch((e) => { throw new Error(friendlyError(e)) }),
      negotiate: async (sdp) => {
        const r = await apiFetch<{ answerSdp: string; callId: string }>('/api/santa/poc', { method: 'POST', body: body({ action: 'negotiate', sdp }) }).catch((e) => { throw new Error(friendlyError(e)) })
        callId.current = r.callId
        return r.answerSdp
      },
      ended: () => {
        const id = callId.current
        callId.current = null
        if (id) void apiFetch('/api/santa/poc', { method: 'POST', body: JSON.stringify({ action: 'end', callId: id }) }).catch(() => {})
      },
    }
  }, [profile, form.kind, form.avatar, form.face, maxSeconds])

  if (calling) {
    return (
      <div className="relative">
        <SantaCall api={api} label={form.kind === 'preview' ? 'Preview' : 'Test call'} showCaptions look={form.avatar === 'storybook' ? 'storybook' : 'photo'} />
        <button onClick={() => setCalling(false)} className="fixed bottom-24 left-3 z-10 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-black">← Edit details</button>
      </div>
    )
  }

  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-base" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      {hint && <span className="text-xs text-black/55">{hint}</span>}
    </label>
  )

  return (
    <div className="mx-auto max-w-lg space-y-4 p-5">
      <h1 className="text-2xl font-extrabold">Santa call — proof of concept</h1>
      <p className="text-sm text-black/60">Internal test page. Nothing about the child is stored. Use headphones or a quiet room the first time.</p>
      <div className="overflow-hidden rounded-2xl border border-black/10">
        {lookKind === 'photo' ? (
          <PhotoSanta stream={null} audioContext={null} mode={look} demo className="block aspect-[3/4] w-full" />
        ) : (
          <StorybookSanta stream={null} audioContext={null} mode={look} demo className="block aspect-[3/4] w-full" />
        )}
        <div className="flex gap-2 bg-black/5 px-2 pt-2">
          {(['photo', 'storybook'] as const).map((k) => (
            <button key={k} onClick={() => setLookKind(k)} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold ${lookKind === k ? 'bg-[#0f2a1d] text-white' : 'bg-white'}`}>{k === 'photo' ? 'Photo Santa' : 'Storybook Santa'}</button>
          ))}
        </div>
        <div className="flex gap-2 bg-black/5 p-2" data-testid="santa-look">
          {(['speaking', 'listening', 'idle'] as const).map((m) => (
            <button key={m} onClick={() => setLook(m)} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold ${look === m ? 'bg-[#d62634] text-white' : 'bg-white'}`}>{m}</button>
          ))}
        </div>
      </div>
      {field('firstName', 'Child’s first name')}
      {field('pronunciation', 'How to say it (optional)', 'e.g. EM-ah')}
      {field('age', 'Age (2–12)')}
      <label className="block">
        <span className="text-sm font-bold">Santa’s manner</span>
        <select className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-base" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value as SantaStyle })}>
          {SANTA_STYLES.map((s) => <option key={s} value={s}>{SANTA_STYLE_GUIDE[s].label} — {SANTA_STYLE_GUIDE[s].parentHint}</option>)}
        </select>
      </label>
      {field('loves', 'Loves', 'comma-separated')}
      {field('celebrate', 'Celebrate', 'comma-separated')}
      {field('encourage', 'Encourage', 'comma-separated')}
      {field('wishes', 'Christmas wishes', 'comma-separated')}
      {field('avoid', 'Anything Santa should avoid?')}
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="text-sm font-bold">Kind</span>
          <select className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-base" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'visit' | 'preview' })}>
            <option value="visit">Visit</option>
            <option value="preview">Parent preview</option>
          </select>
        </label>
        <div className="flex-1">{field('maxSeconds', 'Length (s, 30–600)')}</div>
      </div>
      <label className="block">
        <span className="text-sm font-bold">Santa’s look</span>
        <select className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-base" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value as 'photo' | 'storybook' | 'simli' })}>
          <option value="photo">Photo Santa (ours, animated in the browser, no avatar vendor)</option>
          <option value="storybook">Storybook Santa (ours, illustrated)</option>
          <option value="simli">Simli photoreal face (placeholder face until the Santa face is built)</option>
        </select>
      </label>
      {form.avatar === 'simli' && (
        <label className="block">
          <span className="text-sm font-bold">Placeholder face (Simli preset — not Santa yet)</span>
          <select className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-base" value={form.face} onChange={(e) => setForm({ ...form, face: e.target.value })}>
            {['victor', 'gearwright', 'hank', 'fred'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}
      {profile.success ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm"><b>Santa will open with:</b> “{santaGreeting(profile.data)}”</p>
      ) : (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Check the details: {profile.error.issues[0]?.path.join('.')} — {profile.error.issues[0]?.message}</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={!profile.success} onClick={() => { setError(null); setCalling(true) }} className="w-full rounded-full bg-[#d62634] py-4 text-lg font-extrabold text-white disabled:opacity-40">
        Call Santa
      </button>
    </div>
  )
}
