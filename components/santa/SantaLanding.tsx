'use client'

import { useEffect, useRef, useState } from 'react'
import { Gift, Heart, Mic, PlayCircle, ShieldCheck, Smartphone, Sparkles, Star, Tablet, Laptop } from 'lucide-react'
import { track } from '@/lib/analytics/client'
import { SANTA_PACK, SANTA_PACKS, priceLabel } from '@/lib/santa/packs'

const PRICE = priceLabel(SANTA_PACKS[SANTA_PACK].priceCents)
import { SantaCard, SantaLink, SantaShell } from './ui'

const FAQ: { q: string; a: string }[] = [
  { q: 'Do I need to download an app?', a: 'No. Magical Santa works in the browser on iPhone, Android phones, iPads and tablets. Just tap the link, allow the microphone, and Santa is ready.' },
  { q: 'Is it really live?', a: 'Yes. Santa listens and answers what your child actually says, in real time. It isn’t a pre-recorded message.' },
  { q: 'Is Santa a real person?', a: 'Santa is a friendly AI character. If your child sincerely asks, Santa answers honestly and kindly. You stay nearby and can end the call at any time.' },
  { q: 'What will Santa talk about?', a: 'What you tell us: what your child loves, something to celebrate, something to encourage, and their Christmas wish. You can also list topics Santa should avoid. Santa never asks for addresses, schools or other personal details, and never promises a specific present.' },
  { q: 'Is the call recorded?', a: 'No. We don’t record calls or keep what was said. You can delete your child’s details at any time.' },
  { q: 'Can I try it first?', a: 'Yes — tap “Try a free 30-second preview”. No sign-up, no card. Santa will say hello and chat for a moment so you can see and hear him.' },
  { q: 'How does pricing work?', a: `${PRICE} buys 3 minutes of live talk with Santa. Want more? Top up 3 minutes at a time, whenever you like. Time is only used while Santa is actually talking, and whatever you don’t use stays in your account.` },
  { q: 'What if something goes wrong?', a: 'You only pay for time Santa actually talked — a call that doesn’t connect costs nothing, and if the line drops, the rest of your time is still there. Still not happy? Email us and we’ll make it right.' },
]

export function SantaLanding() {
  useEffect(() => track('santa_landing_view'), [])
  // The sticky CTA appears only once the hero buttons have scrolled away (it would cover "Try free" otherwise).
  const heroCta = useRef<HTMLDivElement>(null)
  const [showSticky, setShowSticky] = useState(false)
  useEffect(() => {
    const el = heroCta.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const cta = (where: string) => () => track('santa_setup_started', { where })

  return (
    <SantaShell className="px-0 pb-28">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/holidays/art/santa-portrait.webp" alt="Santa waving hello from his workshop" className="h-[62dvh] min-h-[420px] w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-[#fbf6ec]" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-extrabold text-[#2b1d14] shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/holidays/icons/icon-192.png" alt="" className="h-6 w-6 rounded-md" /> Magical Santa
        </div>
      </section>
      <section className="-mt-24 relative px-5">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0f2a1d] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#f6d27a]">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f6d27a] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#f6d27a]" /></span>
          Live from the North Pole · No app needed
        </p>
        <h1 className="mt-3 text-[34px] font-extrabold leading-[1.08] tracking-tight">Your child can talk to Santa tonight.</h1>
        <p className="mt-3 text-[17px] leading-snug text-[#2b1d14]/70">A live video call where Santa knows their name, their dog, their elf and what they’re proud of — and talks back. Ready in 2 minutes, no waiting.</p>
        <div ref={heroCta} className="mt-5 space-y-3">
          <div onClick={cta('hero')}>
            <SantaLink href="/santa/create">Create your Santa call</SantaLink>
          </div>
          <SantaLink href="/santa/try" variant="outline"><PlayCircle className="h-5 w-5 text-[#c8202e]" /> Try a free 30-second preview</SantaLink>
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-[#2b1d14]/60">{PRICE} for 3 minutes · Top up anytime · No subscription</p>
      </section>

      {/* No app */}
      <section className="mt-8 px-5">
        <SantaCard className="flex items-center gap-4 bg-[#0f2a1d] text-white">
          <div className="flex gap-1.5 text-[#f6d27a]" aria-hidden><Smartphone /><Tablet /><Laptop /></div>
          <p className="text-[15px] font-bold leading-snug">No app to download. Works on iPhone, Android and tablets — right in your browser.</p>
        </SantaCard>
      </section>

      {/* How it works */}
      <section className="mt-10 px-5">
        <h2 className="text-[24px] font-extrabold">How it works</h2>
        <ol className="mt-4 space-y-3">
          {[
            ['Tell Santa about your child', 'Their name, what they love, something to celebrate. Takes 2 minutes.'],
            ['Check what Santa will say', 'See exactly what Santa knows and how he’ll say hello. You approve it.'],
            ['Hand over the phone', 'Santa says hello by name and chats with your child, live.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-2xl bg-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c8202e] text-lg font-extrabold text-white">{i + 1}</span>
              <div>
                <p className="font-extrabold">{t}</p>
                <p className="text-[15px] text-[#2b1d14]/65">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What Santa knows */}
      <section className="mt-10 px-5">
        <h2 className="text-[24px] font-extrabold">Santa knows what matters</h2>
        <SantaCard className="mt-4">
          <p className="rounded-2xl rounded-tl-sm bg-[#fbf6ec] p-4 text-[16px] leading-snug">
            “Ho, ho, ho! Hello, <b>Emma</b>! I heard you <b>learned to ride your bike</b> this year — that’s wonderful! Do you still love <b>dinosaurs</b>?”
          </p>
          <ul className="mt-4 space-y-2 text-[15px]">
            <li className="flex gap-2"><Heart className="h-5 w-5 shrink-0 text-[#c8202e]" /> What they love — dinosaurs, drawing, football…</li>
            <li className="flex gap-2"><Star className="h-5 w-5 shrink-0 text-[#e9ac26]" /> Something to celebrate or encourage</li>
            <li className="flex gap-2"><Sparkles className="h-5 w-5 shrink-0 text-[#c8202e]" /> Pets, siblings and your family elf — by name</li>
            <li className="flex gap-2"><Gift className="h-5 w-5 shrink-0 text-[#0f2a1d]" /> Their Christmas wish (Santa never promises gifts)</li>
            <li className="flex gap-2"><Mic className="h-5 w-5 shrink-0 text-[#2b1d14]" /> Gentle, funny, playful or classic Santa — you choose</li>
          </ul>
        </SantaCard>
      </section>

      {/* Pricing */}
      <section className="mt-10 px-5" id="prices">
        <h2 className="text-[24px] font-extrabold">One simple price</h2>
        <SantaCard className="mt-4 border-2 border-[#e9ac26]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold">3 minutes with Santa</p>
              <p className="text-[15px] text-[#2b1d14]/65">A live, personal video call</p>
            </div>
            <p className="text-[34px] font-extrabold leading-none">{PRICE}</p>
          </div>
          <ul className="mt-4 space-y-1.5 text-[15px] text-[#2b1d14]/80">
            <li>✓ Want more? Top up 3 minutes at a time</li>
            <li>✓ Only pay for time Santa actually talks</li>
            <li>✓ Unused time stays in your account</li>
            <li>✓ No subscription, ever</li>
          </ul>
        </SantaCard>
        <p className="mt-3 text-center text-[14px] text-[#2b1d14]/60">Not sure yet? <a href="/santa/try" className="font-bold text-[#c8202e]">Try 30 seconds free</a> — no sign-up.</p>
      </section>

      {/* Trust */}
      <section className="mt-10 px-5">
        <SantaCard className="bg-[#fff8e8]">
          <div className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="text-[#0f2a1d]" /> You’re in charge</div>
          <ul className="mt-3 space-y-2 text-[15px] leading-snug text-[#2b1d14]/80">
            <li>• You decide everything Santa knows — and what he should avoid.</li>
            <li>• No recordings. We don’t keep what was said.</li>
            <li>• Santa never asks for addresses, schools or contact details.</li>
            <li>• You can end the call at any time.</li>
            <li>• You only pay for time Santa actually talks.</li>
          </ul>
        </SantaCard>
      </section>

      {/* FAQ */}
      <section className="mt-10 px-5">
        <h2 className="text-[24px] font-extrabold">Questions parents ask</h2>
        <div className="mt-3 divide-y divide-[#2b1d14]/10 rounded-3xl bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-extrabold">
                {f.q}
                <span className="text-xl text-[#c8202e] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-snug text-[#2b1d14]/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-10 px-5 text-center text-xs text-[#2b1d14]/50">Magical Santa is part of the Magical family. Santa is an AI character. © 2026</p>

      {/* Sticky CTA */}
      <div className={`fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-[#2b1d14]/8 bg-[#fbf6ec]/95 px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 backdrop-blur transition-transform duration-300 ${showSticky ? 'translate-y-0' : 'translate-y-full'}`} onClick={cta('sticky')}>
        <SantaLink href="/santa/create">Create your Santa call · {PRICE}</SantaLink>
      </div>
    </SantaShell>
  )
}
