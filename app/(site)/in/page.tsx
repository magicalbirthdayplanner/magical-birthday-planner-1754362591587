import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarCheck, IndianRupee, ListChecks, MapPin, MessageCircle, PartyPopper, Users } from 'lucide-react'
import { INDIA_ENABLED } from '@/lib/country/countries'
import { IndiaLandingTracker, IndiaPricingNote } from '@/components/site/IndiaLanding'

export const metadata: Metadata = {
  title: 'Birthday party planner for families in India',
  description:
    'Plan the celebration, skip the chaos. Find party venues near your PIN code, organise guests, plan activities and food, manage your budget in ₹ and share invitations on WhatsApp.',
  alternates: { canonical: '/in', languages: { 'en-US': '/', 'en-IN': '/in', 'x-default': '/' } },
  openGraph: {
    locale: 'en_IN',
    title: 'Plan the celebration. Skip the chaos.',
    description: 'Venues near your PIN code, guests and RSVPs, activities, food and a budget in ₹ — with invitations you share on WhatsApp.',
    url: '/in',
  },
}

/**
 * India landing page. Same product and themes as everywhere; this page explains what works locally (PIN codes, ₹,
 * WhatsApp). Claims are limited to what the app does — no venue counts, no customer numbers.
 */
const BENEFITS = [
  { icon: MapPin, title: 'Find nearby venues', body: 'Party halls, kids’ play areas, restaurants, activity centres, cake shops, decorators and entertainers near your PIN code — on a map, from Google.' },
  { icon: Users, title: 'Organise the guest list', body: 'Families, kids and adults in one list. Phone numbers stay private to you.' },
  { icon: ListChecks, title: 'Plan activities and food', body: 'Games, crafts, a menu and a dated checklist built around your child’s age and interests.' },
  { icon: IndianRupee, title: 'Manage your budget in ₹', body: 'Your budget, estimates and spending in rupees — nothing is converted or mixed with dollars.' },
  { icon: MessageCircle, title: 'Share invitations on WhatsApp', body: 'A beautiful invitation with an RSVP link, ready to send to your WhatsApp chats and groups.' },
  { icon: CalendarCheck, title: 'Collect RSVPs in one place', body: 'Guests reply from the link — no app, no account. You see who’s coming at a glance.' },
]

const FAQ = [
  { q: 'Do I need to install an app?', a: 'No. Magical Birthday Planner works in your phone’s browser, and you can add it to your home screen.' },
  { q: 'Do guests need an account to RSVP?', a: 'No. They open your invitation link, say yes, maybe or no, and you see it in your guest list.' },
  { q: 'Is it only for Indian-style parties?', a: 'No. Every theme is available — superheroes, princesses, space, dinosaurs and more — and you plan the party you want.' },
  { q: 'Can I plan a party in another country?', a: 'Yes. Each party has its own country. You can plan a party in India from anywhere, or a party in the United States from India.' },
  { q: 'Does WhatsApp send the invitations for me?', a: 'You send them. We open WhatsApp with your invitation and link ready; you choose the chats. We never message anyone on your behalf.' },
]

export default function IndiaLandingPage() {
  if (!INDIA_ENABLED) notFound()
  return (
    <div className="min-h-screen bg-magic pb-16">
      <IndiaLandingTracker />
      <header className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">🇮🇳 For families in India</span>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">Plan the celebration. Skip the chaos.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground text-balance">
          One place for your child’s birthday: venues near your PIN code, your guest list, activities, food, a budget in rupees and invitations you share on WhatsApp.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
          <Link href="/start?country=IN" className="tap flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25" data-testid="india-start">
            <PartyPopper className="h-5 w-5" /> Start planning — it’s free
          </Link>
          <Link href="/pricing" className="tap flex min-h-[48px] items-center justify-center rounded-full border border-border bg-background px-6 font-semibold">See plans</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="What you can do">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary" aria-hidden><Icon className="h-5 w-5" /></span>
            <h2 className="mt-3 text-lg font-bold">{title}</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-12 max-w-3xl px-4 text-center" aria-labelledby="in-pricing">
        <h2 id="in-pricing" className="font-display text-3xl font-extrabold">Start free</h2>
        <p className="mt-2 text-muted-foreground">Create your party, discover venues, use the checklist and themes for free. Pay once per party only if you want guests &amp; RSVP and AI help.</p>
        <IndiaPricingNote />
      </section>

      <section className="mx-auto mt-12 max-w-3xl px-4" aria-labelledby="in-faq">
        <h2 id="in-faq" className="text-center font-display text-3xl font-extrabold">Questions</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card p-4">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {f.q}
                <span className="text-primary transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
