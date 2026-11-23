'use client'

/** The paid Santa call. The ledger (server) decides if a call may start, for how long, and whether it counted. */
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { SantaCall, type SantaCallApi, type SantaEndReason } from './SantaCall'
import { SantaLink, SantaShell } from './ui'
import { minutesLabel, priceLabel, SANTA_PACK, SANTA_PACKS } from '@/lib/santa/packs'

export function SantaCallPage() {
  const params = useSearchParams()
  const childId = params.get('child') ?? ''
  const { user, loading } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [ended, setEnded] = useState<{ reason: SantaEndReason; message: string | null } | null>(null)
  const sessionRef = useRef<string | null>(null)

  const api: SantaCallApi = useMemo(
    () => ({
      begin: async () => {
        try {
          const r = await apiFetch<{ sessionId: string; avatarToken: string | null; maxSeconds: number }>('/api/santa/sessions', { method: 'POST', body: JSON.stringify({ childId }) })
          sessionRef.current = r.sessionId
          track('santa_call_started')
          return { avatarToken: r.avatarToken, maxSeconds: r.maxSeconds }
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      negotiate: async (sdp) => {
        const id = sessionRef.current
        if (!id) throw new Error('We couldn’t reach Santa just now. Please try again.')
        try {
          const r = await apiFetch<{ answerSdp: string }>(`/api/santa/sessions/${id}`, { method: 'POST', body: JSON.stringify({ action: 'sdp', sdp }) })
          return r.answerSdp
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      connected: () => {
        track('santa_call_connected')
        const id = sessionRef.current
        if (id) void apiFetch(`/api/santa/sessions/${id}`, { method: 'POST', body: JSON.stringify({ action: 'connected' }) }).catch(() => null)
      },
      ended: (reason) => {
        track('santa_call_ended', { reason })
        const id = sessionRef.current
        sessionRef.current = null
        if (id) void apiFetch(`/api/santa/sessions/${id}`, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'end', reason }) }).catch(() => null)
      },
    }),
    [childId],
  )

  if (loading) return null
  if (!user || !childId) {
    return (
      <SantaShell className="pt-24 text-center">
        <p className="text-lg font-bold">Please open your Santa page to start the call.</p>
        <div className="mt-6"><SantaLink href="/santa/ready">Go to my Santa page</SantaLink></div>
      </SantaShell>
    )
  }

  if (ended) {
    const happy = ended.reason === 'time_up' || ended.reason === 'parent_ended'
    return (
      <SantaShell className="flex flex-col items-center pt-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/holidays/art/santa-live.webp" alt="" className="h-36 w-36 rounded-full object-cover object-[50%_28%] ring-8 ring-white" />
        {happy ? (
          <>
            <h1 className="mt-6 text-[30px] font-extrabold leading-tight">What a magical call! 🎄</h1>
            <p className="mt-2 text-[17px] text-[#2b1d14]/65">{ended.reason === 'time_up' ? 'Santa had to hurry back to the workshop — but he’d love to talk again!' : 'Santa had to hurry back to the workshop. Merry Christmas!'}</p>
            <div className="mt-8 w-full space-y-3">
              {ended.reason === 'time_up' && <SantaLink href={`/santa/ready?child=${childId}&topup=1`}>Add {minutesLabel(SANTA_PACKS[SANTA_PACK].seconds)} more · {priceLabel(SANTA_PACKS[SANTA_PACK].priceCents)}</SantaLink>}
              <SantaLink href={`/santa/ready?child=${childId}`} variant={ended.reason === 'time_up' ? 'outline' : 'primary'}>Back to my Santa page</SantaLink>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-[28px] font-extrabold leading-tight">Oops — the line to the North Pole wobbled</h1>
            <p className="mt-2 text-[17px] text-[#2b1d14]/65">{ended.message ?? 'Let’s try again.'} You only pay for the time Santa actually talked.</p>
            <div className="mt-8 w-full space-y-3">
              <button onClick={() => { setEnded(null); setAttempt((a) => a + 1) }} className="inline-flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#c8202e] px-6 text-[17px] font-extrabold text-white">Try again</button>
              <Link href={`/santa/ready?child=${childId}`} className="block py-3 font-bold text-[#2b1d14]/60">Back to my Santa page</Link>
            </div>
          </>
        )}
      </SantaShell>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f2a1d]">
      <SantaCall key={attempt} api={api} onEnded={(reason, message) => setEnded({ reason, message })} startLabel="Tap to call Santa 🎅" />
    </div>
  )
}
