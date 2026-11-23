'use client'

/** Free 30-second preview: no sign-up, no card. Optional first name (used for this call only, never stored). */
import { useMemo, useRef, useState } from 'react'
import { Mic, PlayCircle } from 'lucide-react'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { SANTA_PACK, SANTA_PACKS, priceLabel } from '@/lib/santa/packs'
import { SantaCall, type SantaCallApi } from './SantaCall'
import { SantaButton, SantaLink, SantaShell } from './ui'

export function SantaTry() {
  const [name, setName] = useState('')
  const [stage, setStage] = useState<'intro' | 'call' | 'done'>('intro')
  const [message, setMessage] = useState<string | null>(null)
  const session = useRef<{ id: string; token: string } | null>(null)
  const nameOk = /^[\p{L}\p{M}' .-]{0,40}$/u.test(name.trim())

  const api: SantaCallApi = useMemo(
    () => ({
      begin: async () => {
        try {
          const r = await apiFetch<{ sessionId: string; previewToken: string; avatarToken: string | null; maxSeconds: number }>('/api/santa/preview', { method: 'POST', body: '{}' })
          session.current = { id: r.sessionId, token: r.previewToken }
          track('santa_call_started', { preview: true })
          return { avatarToken: r.avatarToken, maxSeconds: r.maxSeconds }
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      negotiate: async (sdp) => {
        const s = session.current
        if (!s) throw new Error('We couldn’t reach Santa just now. Please try again.')
        try {
          const r = await apiFetch<{ answerSdp: string }>(`/api/santa/preview/${s.id}`, { method: 'POST', body: JSON.stringify({ action: 'sdp', token: s.token, sdp, firstName: name.trim() || undefined }) })
          return r.answerSdp
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      connected: () => track('santa_call_connected', { preview: true }),
      ended: (reason) => {
        track('santa_call_ended', { preview: true, reason })
        const s = session.current
        session.current = null
        if (s) void apiFetch(`/api/santa/preview/${s.id}`, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'end', token: s.token, reason }) }).catch(() => null)
      },
    }),
    [name],
  )

  if (stage === 'call') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f2a1d]">
        <SantaCall api={api} label="Free preview" startLabel="Tap to say hi to Santa 🎅" goodbye="Say a quick, warm goodbye in ONE short sentence, and mention that a grown-up can book a longer call with Santa. Then stop." onEnded={(reason, msg) => { setMessage(reason === 'time_up' || reason === 'parent_ended' ? null : msg); setStage('done') }} />
      </div>
    )
  }

  const price = priceLabel(SANTA_PACKS[SANTA_PACK].priceCents)

  if (stage === 'done') {
    return (
      <SantaShell className="flex flex-col items-center pt-14 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/holidays/art/santa-live.webp" alt="" className="h-32 w-32 rounded-full object-cover object-[50%_28%] ring-8 ring-white" />
        <h1 className="mt-6 text-[30px] font-extrabold leading-tight">{message ? 'Santa couldn’t connect' : 'Santa says: see you soon! 🎄'}</h1>
        <p className="mt-2 text-[17px] text-[#2b1d14]/65">{message ?? 'In a real call, Santa knows your child’s name, what they love and what they’re proud of — and talks for as long as you like.'}</p>
        <div className="mt-8 w-full space-y-3">
          <SantaLink href="/santa/create">Create your Santa call · {price} for 3 min</SantaLink>
          <button type="button" onClick={() => { setMessage(null); setStage('intro') }} className="w-full py-3 font-bold text-[#2b1d14]/60">Try the preview again</button>
        </div>
      </SantaShell>
    )
  }

  return (
    <SantaShell className="pb-10">
      <div className="relative -mx-5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/holidays/art/santa-live.webp" alt="Santa in his workshop" className="h-[42dvh] min-h-[280px] w-full object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#fbf6ec]" />
        <span className="absolute left-4 top-4 rounded-full bg-[#e9ac26] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#3b1d00]">Free · 30 seconds · No sign-up</span>
      </div>
      <h1 className="-mt-4 relative text-[30px] font-extrabold leading-tight">Say hi to Santa — free</h1>
      <p className="mt-2 text-[16px] text-[#2b1d14]/65">A real, live 30-second hello, so you can see and hear Santa before you book.</p>
      <label className="mt-6 block">
        <span className="text-[15px] font-extrabold">Who’s saying hi? <span className="font-semibold text-[#2b1d14]/50">(optional)</span></span>
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="First name, e.g. Emma" autoComplete="off" autoCapitalize="words" className="mt-2 h-14 w-full rounded-2xl border-2 border-[#2b1d14]/12 bg-white px-4 text-[18px] font-bold outline-none focus:border-[#c8202e]" />
        {!nameOk && <span className="mt-1 block text-sm font-semibold text-[#c8202e]">Letters only, please.</span>}
      </label>
      <p className="mt-3 flex items-start gap-2 text-[14px] text-[#2b1d14]/60"><Mic className="h-4 w-4 shrink-0" /> Your browser will ask for the microphone so Santa can hear you. Nothing is recorded or saved.</p>
      <div className="sticky bottom-0 -mx-5 mt-6 bg-[#fbf6ec]/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
        <SantaButton disabled={!nameOk} onClick={() => { track('santa_setup_started', { where: 'preview' }); setStage('call') }}><PlayCircle className="h-5 w-5" /> Start free preview</SantaButton>
        <p className="mt-2 text-center text-[13px] text-[#2b1d14]/55">Full calls: {price} for 3 minutes · top up anytime</p>
      </div>
    </SantaShell>
  )
}
