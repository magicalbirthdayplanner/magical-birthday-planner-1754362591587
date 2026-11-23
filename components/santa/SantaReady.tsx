'use client'

/** The parent's Santa page: time with Santa (buy / top up), a calm "get ready" checklist and one big button. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Headphones, Loader2, Pencil, Plus, ShieldCheck, Trash2, Users, Volume2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { minutesLabel, priceLabel, TOPUP_QUANTITIES } from '@/lib/santa/packs'
import type { SantaChildProfile } from '@/lib/santa/persona'
import { SantaButton, SantaCard, SantaLink, SantaShell } from './ui'
import { SantaSignIn } from './SantaSignIn'

interface Me {
  children: { id: string; approved: boolean; profile: SantaChildProfile | null }[]
  secondsLeft: number
  hasTalked: boolean
  checkoutAvailable: boolean
  refStatus: string | null
  price: { pack: string; seconds: number; cents: number }
}

/** Buy time with Santa: 3, 6 or 9 minutes. */
export function TimePicker({ me, cta, onBuy, busy }: { me: Me; cta: string; onBuy: (qty: number) => void; busy: boolean }) {
  const [qty, setQty] = useState<number>(1)
  return (
    <>
      <div className="mt-4 space-y-3" role="radiogroup" aria-label="Time with Santa">
        {TOPUP_QUANTITIES.map((q) => (
          <button key={q} type="button" role="radio" aria-checked={qty === q} onClick={() => setQty(q)} className={`flex w-full items-center gap-4 rounded-3xl border-2 bg-white px-5 py-4 text-left transition active:scale-[0.99] ${qty === q ? 'border-[#c8202e] shadow-[0_10px_24px_-14px_rgba(200,32,46,0.6)]' : 'border-transparent'}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${qty === q ? 'border-[#c8202e] bg-[#c8202e] text-white' : 'border-[#2b1d14]/25'}`}>{qty === q && <Check className="h-4 w-4" />}</span>
            <span className="flex-1">
              <span className="block text-[18px] font-extrabold">{minutesLabel(me.price.seconds * q)} with Santa</span>
              {q === 1 && <span className="block text-[14px] text-[#2b1d14]/60">Perfect for a first hello</span>}
              {q === 2 && <span className="block text-[14px] text-[#2b1d14]/60">Great for chatty children or siblings</span>}
              {q === 3 && <span className="block text-[14px] text-[#2b1d14]/60">One now, more on Christmas Eve</span>}
            </span>
            <span className="text-[20px] font-extrabold">{priceLabel(me.price.cents * q)}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 text-[14px] text-[#2b1d14]/70"><ShieldCheck className="h-5 w-5 shrink-0 text-[#0f2a1d]" /> You only use time while Santa is talking — unused time stays in your account. Secure checkout by Dodo Payments.</p>
      {me.checkoutAvailable ? (
        <div className="sticky bottom-0 -mx-5 mt-6 bg-[#fbf6ec]/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
          <SantaButton loading={busy} onClick={() => onBuy(qty)}>{cta} · {priceLabel(me.price.cents * qty)}</SantaButton>
        </div>
      ) : (
        <SantaCard className="mt-6 bg-[#fff8e8] text-[15px]">Santa calls open very soon — we’re polishing the sleigh! Your child’s details are saved.</SantaCard>
      )}
    </>
  )
}

export function SantaReady() {
  const router = useRouter()
  const params = useSearchParams()
  const ref = params.get('ref')
  const { user, loading: authLoading } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [confirming, setConfirming] = useState(!!ref)
  const [topUp, setTopUp] = useState(params.get('topup') === '1')
  const [childId, setChildId] = useState<string | null>(params.get('child'))

  const load = useCallback(async (withRef?: string | null) => {
    try {
      const m = await apiFetch<Me>(`/api/santa/me${withRef ? `?ref=${encodeURIComponent(withRef)}` : ''}`)
      setMe(m)
      return m
    } catch (e) {
      setError(friendlyError(e))
      return null
    }
  }, [])

  useEffect(() => {
    if (user && !ref) void load()
  }, [user, ref, load])

  // Back from checkout: wait until OUR ledger says this checkout was paid (never trust the URL).
  useEffect(() => {
    if (!ref || !user) return
    let tries = 0
    let stop = false
    const tick = async () => {
      const m = await load(ref)
      if (stop) return
      if (m?.refStatus === 'completed' || m?.refStatus === 'failed' || ++tries >= 30) {
        setConfirming(false)
        if (m?.refStatus === 'completed') track('santa_purchase_confirmed')
        if (m?.refStatus === 'failed') setError('The payment didn’t go through. Nothing was charged — please try again.')
        router.replace(childId ? `/santa/ready?child=${childId}` : '/santa/ready')
        return
      }
      setTimeout(tick, 2000)
    }
    void tick()
    return () => {
      stop = true
    }
  }, [ref, user, load, router, childId])

  const child = useMemo(() => me?.children.find((c) => c.id === childId) ?? me?.children[0] ?? null, [me, childId])
  const name = child?.profile?.firstName ?? 'your child'

  const buy = async (quantity: number) => {
    setPaying(true)
    setError(null)
    track('santa_checkout_started', { quantity, topup: !!me && me.secondsLeft > 0 })
    try {
      const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>('/api/santa/checkout', { method: 'POST', body: JSON.stringify({ pack: me?.price.pack ?? 'SANTA_TIME', quantity }) })
      window.location.href = checkoutUrl
    } catch (e) {
      setPaying(false)
      setError(friendlyError(e))
    }
  }

  const remove = async () => {
    if (!child || !window.confirm(`Delete ${name}’s details? Santa will forget everything you told him.`)) return
    await apiFetch(`/api/santa/children?id=${child.id}`, { method: 'DELETE' }).catch(() => null)
    setChildId(null)
    void load()
  }

  if (authLoading) return <SantaShell><Loader2 className="mx-auto mt-24 h-8 w-8 animate-spin text-[#2b1d14]/40" /></SantaShell>
  if (!user) {
    return (
      <SantaShell className="pt-10">
        <SantaSignIn next="/santa/ready" onSignedIn={() => void load()} title="Sign in to your Santa calls" subtitle="Enter the email you used — we’ll send a 6-digit code." />
        <p className="mt-6 text-center text-[15px]">New here? <Link href="/santa/create" className="font-bold text-[#c8202e]">Create a Santa call</Link></p>
      </SantaShell>
    )
  }
  if (!me) return <SantaShell><Loader2 className="mx-auto mt-24 h-8 w-8 animate-spin text-[#2b1d14]/40" />{confirming && <p className="mt-4 text-center font-bold">Confirming your payment…</p>}{error && <p className="mt-4 text-center text-[#c8202e]">{error}</p>}</SantaShell>
  if (!child) {
    return (
      <SantaShell className="pt-16 text-center">
        <h1 className="text-[28px] font-extrabold">Let’s set up your Santa call</h1>
        <p className="mt-2 text-[#2b1d14]/65">Tell Santa about your child — it takes 2 minutes.</p>
        <div className="mt-6"><SantaLink href="/santa/create">Get started</SantaLink></div>
      </SantaShell>
    )
  }

  const hasTime = me.secondsLeft >= 20

  return (
    <SantaShell className="pb-10">
      <div className="relative -mx-5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/holidays/art/santa-live.webp" alt="" className="h-[30dvh] min-h-[220px] w-full object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#fbf6ec]" />
      </div>

      {me.children.length > 1 && (
        <div className="-mt-6 relative flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Children">
          {me.children.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === child.id} onClick={() => setChildId(c.id)} className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-extrabold ${c.id === child.id ? 'bg-[#0f2a1d] text-white' : 'bg-white'}`}>
              {c.profile?.firstName ?? 'Child'}
            </button>
          ))}
        </div>
      )}

      <h1 className="relative mt-2 text-[30px] font-extrabold leading-tight">
        {confirming ? 'Confirming your payment…' : hasTime && !topUp ? `Santa is ready to call ${name}!` : hasTime ? 'Add more time with Santa' : `Choose ${name}’s time with Santa`}
      </h1>

      {confirming && (
        <SantaCard className="mt-4 flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-[#c8202e]" /><p className="text-[15px]">This usually takes a few seconds. Please keep this page open.</p></SantaCard>
      )}

      {!confirming && hasTime && !topUp && (
        <>
          <p className="mt-2 text-[16px] text-[#2b1d14]/65">You have <b className="text-[#2b1d14]">{minutesLabel(me.secondsLeft)}</b> with Santa{me.hasTalked ? ' left' : ''}.</p>
          <SantaCard className="mt-5">
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-[#2b1d14]/50">Before you start</p>
            <ul className="mt-3 space-y-3 text-[15px]">
              <li className="flex gap-3"><Volume2 className="h-5 w-5 shrink-0 text-[#c8202e]" /> Turn the volume up and find a quiet spot.</li>
              <li className="flex gap-3"><Users className="h-5 w-5 shrink-0 text-[#c8202e]" /> Stay close by — you can end the call any time.</li>
              <li className="flex gap-3"><Headphones className="h-5 w-5 shrink-0 text-[#c8202e]" /> Hold the phone at arm’s length so Santa can hear {name} clearly.</li>
            </ul>
          </SantaCard>
          <button type="button" onClick={() => setTopUp(true)} className="mt-4 w-full py-2 text-[15px] font-bold text-[#c8202e]">+ Add more time</button>
          <div className="sticky bottom-0 -mx-5 mt-2 bg-[#fbf6ec]/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
            <SantaLink href={`/santa/call?child=${child.id}`}>Call Santa now</SantaLink>
          </div>
        </>
      )}

      {!confirming && (!hasTime || topUp) && (
        <>
          <p className="mt-2 text-[16px] text-[#2b1d14]/65">
            {hasTime ? <>You have {minutesLabel(me.secondsLeft)} left. Add more — it never expires.</> : <>{name}’s details are saved. Pay once — no subscription.</>}
          </p>
          <TimePicker me={me} busy={paying} onBuy={buy} cta={hasTime ? 'Add time' : 'Continue to payment'} />
          {hasTime && <button type="button" onClick={() => setTopUp(false)} className="mt-3 w-full py-2 text-[15px] font-bold text-[#2b1d14]/55">Back</button>}
        </>
      )}

      {error && <p role="alert" className="mt-4 text-[15px] font-semibold text-[#c8202e]">{error}</p>}

      <div className="mt-8 grid grid-cols-2 gap-2 text-[15px] font-bold">
        <Link href={`/santa/create?child=${child.id}`} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3"><Pencil className="h-4 w-4" /> Edit details</Link>
        <Link href="/santa/create" onClick={() => localStorage.removeItem('mbp.santa.draft')} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3"><Plus className="h-4 w-4" /> Add a child</Link>
      </div>
      <button type="button" onClick={remove} className="mt-6 flex w-full items-center justify-center gap-2 py-2 text-[14px] font-bold text-[#2b1d14]/50"><Trash2 className="h-4 w-4" /> Delete {name}’s details</button>
    </SantaShell>
  )
}
