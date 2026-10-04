"use client"

import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PlanCards, PlanComparison } from "@/components/billing/PlanCards"
import { usePlanStatus } from "@/components/billing/usePlanStatus"
import { track } from "@/lib/analytics/client"
import { PLAN_INFO, type Plan } from "@/lib/entitlements"

/** Answers reflect actual behaviour (lib/entitlements.ts, lib/billing/*, lib/ai/*) and the Terms. */
const FAQS: { q: string; a: string }[] = [
  { q: "What's included in Free?", a: "Create a party, discover and save real local venues on a map, a dated party checklist, our curated themes, and your party plan with your own activities. Free doesn't include guests & RSVP or any AI features." },
  { q: "What's included in Starter?", a: "Everything in Free, plus guests & RSVP (an invitation link, emailed invitations and RSVPs collected for you) and AI planning: Plan My Party, AI theme ideas, the AI checklist and the AI Activity Studio." },
  { q: "What's included in Plus?", a: "Everything in Starter, plus AI that handles the details: the Food Planner, Budget Assistant, Invitation Writer, party-day Timeline and Shopping List." },
  { q: "What's included in Pro?", a: "Everything in Plus, plus the AI Party Host (welcome speech, activity intros, cake moment and closing words, thank-you and reminder messages) and the AI Party Experience, which designs the whole party together." },
  { q: "What's the difference between Starter and Plus?", a: "Starter helps you build the plan — the big picture, themes, activities and the checklist. Plus takes on the details: food quantities, budget, invitation wording, the party-day timeline and the shopping list. Plus also gives you more AI requests per party (25 instead of 10)." },
  { q: "What's the difference between Plus and Pro?", a: "Plus organizes the party. Pro helps on the day itself: what to say and when, personal thank-you notes, and a complete party experience designed in one go. Pro gives you 50 AI requests per party." },
  { q: "Is AI included?", a: "AI is included in Starter, Plus and Pro. Free doesn't include AI features." },
  { q: "How does AI usage work?", a: "Each time you ask the AI for something, it uses one request from your party's allowance (10 on Starter, 25 on Plus, 50 on Pro). Reopening something you already generated is free, and a request that fails doesn't use your party's allowance. For fair use, each account can make up to 10 AI requests per hour and per day, and the AI may occasionally be busy at very high demand." },
  { q: "Is RSVP included?", a: "Guests & RSVP are part of Starter and every plan above it. Your guests never need an account to reply." },
  { q: "Can I upgrade after creating a party?", a: "Yes. Everything you already planned stays exactly as it is, and the new features are available right away." },
  { q: "What happens if I upgrade during my trial?", a: "New accounts get a free 24-hour trial of Starter's guest & RSVP features (AI isn't part of the trial). If you buy a plan during the trial, your plan replaces the trial straight away." },
  { q: "Is the price per party or per month?", a: "Neither is a subscription: it's a one-time payment. Your plan unlocks its features on your account, for the parties you plan with it. Nothing renews or charges you again." },
  { q: "What happens to my party if I downgrade?", a: "There's no automatic downgrade. If a plan ends (for example after a refund), your parties, guests and saved plans stay. Paid features — like adding guests or using AI — are locked until you upgrade again." },
  { q: "Can I continue using my party after the event?", a: "Yes. Your party stays in your account after the big day, with its guests, plan and notes." },
]

function PricingContent() {
  const status = usePlanStatus()
  const params = useSearchParams()
  const upgrade = params.get("upgrade")?.toUpperCase()
  const highlight = (["STARTER", "PLUS", "PRO"] as const).find((p) => p === upgrade) ?? null
  const owned = status.ownedPlan
  const from = params.get("from")

  useEffect(() => {
    track("pricing_viewed", { highlight: highlight ?? undefined, from: from ?? undefined })
  }, [highlight, from])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 pb-16">
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center">
        <span className="inline-block rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white">One-time payment · No subscriptions</span>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Explore. Plan. Organize. Experience.</h1>
        <p className="mt-3 text-lg text-gray-600">Start free. Add AI when you want help building the plan, handling the details, or making the day itself magical.</p>
        {status.onTrial ? (
          <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-700" data-testid="trial-note">
            You’re on a free 24-hour trial with Starter’s guest &amp; RSVP features. You can choose any plan at any time.
          </p>
        ) : owned !== "FREE" && status.loaded ? (
          <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-700" data-testid="owned-note">
            You’re on <strong>{PLAN_INFO[owned as Plan].name}</strong>. Plans above it are shown as upgrades.
          </p>
        ) : null}
      </header>

      <div className="px-4">
        <PlanCards highlight={highlight} />
      </div>

      <section className="mt-16 px-4" aria-labelledby="compare">
        <h2 id="compare" className="text-center font-display text-3xl font-extrabold text-gray-900">Compare plans</h2>
        <p className="mb-6 mt-2 text-center text-gray-600">What each plan adds, by what it does for you.</p>
        <PlanComparison />
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4" aria-labelledby="faq">
        <h2 id="faq" className="text-center font-display text-3xl font-extrabold text-gray-900">Questions</h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-white p-4">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-semibold text-gray-900">
                {f.q}
                <span className="text-primary transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Payments are processed securely by Dodo Payments. See our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </section>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PricingContent />
    </Suspense>
  )
}
