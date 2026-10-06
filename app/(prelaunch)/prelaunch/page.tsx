import type { Metadata } from 'next'
import { CalendarHeart, Check, MessagesSquare, Search, ListChecks, Sparkles } from 'lucide-react'
import { Phone } from '@/components/prelaunch/Phone'
import { WaitlistForm } from '@/components/prelaunch/WaitlistForm'
import { Countdown } from '@/components/prelaunch/Countdown'
import { PrelaunchPageView, StickyJoin } from '@/components/prelaunch/PrelaunchChrome'
import { cn } from '@/lib/utils'

/**
 * The temporary pre-launch page (served at `/` from Oct 6 to Oct 12, 2026 — see lib/launch.ts).
 * Designed for 375–430 px phones first: one centered column at every width, large real screens in swipeable rails
 * on phones (a centered row from tablet up). Every screen shown is a real v1.0 screen with real AI output (child
 * names blurred). No pricing, no sign-in.
 */
export const metadata: Metadata = {
  title: { absolute: 'Magical Birthday Planner — launching October 13' },
  description: 'Your child’s birthday, magically planned. Local party places, an AI party plan, guests & RSVPs and every little detail in one place. Join the waitlist — launching October 13.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Your child’s birthday. Magically planned.',
    description: 'Magical Birthday Planner launches October 13. Join the waitlist.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Magical Birthday Planner' }],
  },
  twitter: { card: 'summary_large_image', title: 'Your child’s birthday. Magically planned.', description: 'Magical Birthday Planner launches October 13. Join the waitlist.', images: ['/og-image.png'] },
}

const INTRO = 'The venue, the plan, the guest list and all the little details in one place — with AI that helps at every step.'

const PAINS = [
  { icon: Search, title: 'Twenty tabs of party places', body: 'And still not sure what your child would actually love.' },
  { icon: MessagesSquare, title: 'RSVPs lost in the group chat', body: 'Who’s coming? How many kids? It scrolls out of sight.' },
  { icon: ListChecks, title: 'The little details pile up', body: 'Food for how many? Who’s buying plates? What happens after cake?' },
]

const STEPS = [
  { title: 'Tell us about your child', body: 'Age, what they love, your ZIP code and budget.' },
  { title: 'Get a plan built around them', body: 'Local places, a theme, activities, food and a timeline.' },
  { title: 'Keep it all in one place', body: 'Guests, RSVPs, checklist and shopping list — on your phone.' },
]

interface Shot {
  src: string
  alt: string
  caption: string
  crop?: 'top' | 'bottom'
}

const AI_SHOTS: Shot[] = [
  { src: 'ai-ask', crop: 'bottom', caption: '1 · You describe it', alt: 'The request: “My son is turning 5. He’s obsessed with dinosaurs. 10 kids, at home, 2 hours.”' },
  { src: 'ai-plan', crop: 'top', caption: '2 · You get a plan', alt: 'The result: a hands-on dinosaur expedition party at home for ten 5-year-olds, with a Dino Discovery Camp theme' },
]
const DISCOVER_SHOTS: Shot[] = [
  { src: 'discover', caption: 'Places near you', alt: 'Party places near you: 11 options matched within 20 miles' },
  { src: 'discover-why', caption: 'Why each one fits', alt: 'Why we recommend a science center: matches the child’s love of science, rated 4.8 by 278 Google reviewers, 5 miles away' },
]
const DETAIL_SHOTS: Shot[] = [
  { src: 'food', caption: 'Food', alt: 'Food plan: a menu with quantities for 10 guests and an allergy reminder' },
  { src: 'budget', caption: 'Budget', alt: 'Budget assistant: planned spend against a $150 budget, with ways to save' },
  { src: 'timeline', caption: 'Timeline', alt: 'Party-day timeline: arrival, welcome circle, fossil dig, minute by minute' },
  { src: 'shopping', caption: 'Shopping', alt: 'Shopping list built from the food plan and activities' },
  { src: 'checklist', caption: 'Checklist', alt: 'AI checklist: tasks the party still needs, with due dates' },
]
const GUEST_SHOTS: Shot[] = [
  { src: 'invitation', caption: 'Your invitation', alt: 'An invitation design: You’re invited to a 5th birthday party, Saturday November 21, 2 to 4 PM' },
  { src: 'rsvp', caption: 'Guests reply in a tap', alt: 'The RSVP page a guest sees, with the party details and an add-to-calendar button' },
  { src: 'guests', caption: 'Who’s coming', alt: 'The guest list: 6 going, 8 kids and 4 adults, with going, waiting and can’t go filters' },
]
const MAGIC_SHOTS: Shot[] = [
  { src: 'activity', caption: 'Activities', alt: 'An AI activity: a constellation hunt with steps, estimated cost and a materials list' },
  { src: 'host', caption: 'Party Host', alt: 'AI Party Host: a welcome speech for the party, ready to copy or edit' },
  { src: 'themes', caption: 'Theme ideas', alt: 'AI theme ideas: Dino Dig Discovery Lab with decorations, activities and food ideas' },
]

const HELPERS = ['Activities', 'Party Host', 'Food', 'Messages', 'Shopping', 'Timeline', 'Budget', 'What am I forgetting?', 'Theme ideas', 'Invitation wording']

const H2 = 'font-display text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-balance sm:text-4xl'
const LEAD = 'mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground text-balance'

function SectionHead({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 text-center">
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h2 id={id} className={cn('mt-2', H2)}>{title}</h2>
      {lead ? <p className={LEAD}>{lead}</p> : null}
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mx-auto mt-6 max-w-sm space-y-3 px-5 text-base leading-snug">
      {items.map((it) => (
        <li key={it} className="flex gap-3">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Real screens, large. Phones: a full-bleed horizontal rail that snaps one screen to the centre with the next one
 * peeking in (content stays inside the rail — the page never scrolls sideways). Tablet and up: a centered row.
 */
function PhoneRail({ shots, label }: { shots: Shot[]; label: string }) {
  return (
    <div className="mt-8">
      <ul
        aria-label={label}
        data-testid="phone-rail"
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[calc((100vw-min(74vw,290px))/2)] pb-2 md:snap-none md:flex-wrap md:justify-center md:gap-y-8 md:overflow-visible md:px-6"
      >
        {shots.map((s) => (
          <li key={s.src} className="w-[74vw] max-w-[290px] shrink-0 snap-center md:w-[230px]">
            <Phone src={s.src} alt={s.alt} crop={s.crop} sizes="(min-width: 768px) 230px, 74vw" />
            <p className="mt-3 text-center text-[15px] font-bold">{s.caption}</p>
          </li>
        ))}
      </ul>
      {shots.length > 1 ? (
        <p className="mt-2 text-center text-sm text-muted-foreground md:hidden" aria-hidden>
          Swipe to see more →
        </p>
      ) : null}
    </div>
  )
}

export default function PrelaunchPage() {
  return (
    <div data-testid="prelaunch-page" className="overflow-x-clip">
      <PrelaunchPageView />

      {/* ------------------------------------------------------------------ hero */}
      <section className="bg-magic">
        <div className="mx-auto max-w-xl px-5 pb-12 pt-5 text-center sm:pt-10">
          <p className="inline-flex flex-wrap items-center justify-center gap-x-2 rounded-full bg-card/85 px-3.5 py-1.5 text-sm font-bold text-primary shadow-sm ring-1 ring-primary/15" data-testid="launch-pill">
            <CalendarHeart className="h-4 w-4" aria-hidden />
            Launching October 13
            <Countdown className="font-semibold text-muted-foreground before:mr-2 before:content-['·']" />
          </p>
          <h1 className="mt-3 font-display text-[2.1rem] font-extrabold leading-[1.06] tracking-tight text-balance sm:mt-4 sm:text-5xl">
            Your child’s birthday. <span className="text-primary">Magically planned.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[17px] font-semibold leading-snug text-foreground/85 text-balance sm:text-xl">Planning a kid’s birthday shouldn’t feel like managing a project.</p>
          {/* Phones: the form comes first so it sits above the fold; the explainer follows it. */}
          <p className={cn(LEAD, 'hidden sm:block')}>{INTRO}</p>
          <div id="join" className="mx-auto mt-5 max-w-md scroll-mt-24 rounded-[1.75rem] border border-border bg-card p-4 text-left shadow-lg shadow-primary/10 sm:mt-7 sm:p-5">
            <p className="mb-3 text-center text-[15px] font-semibold leading-snug">Be first in line when Magical Birthday Planner launches October 13.</p>
            <WaitlistForm placement="hero" />
          </div>
          <p className={cn(LEAD, 'mt-5 sm:hidden')}>{INTRO}</p>
        </div>
        <div className="relative mx-auto w-full max-w-[360px] px-5 pb-14" aria-label="Real screens from Magical Birthday Planner">
          <Phone src="home" priority alt="Home screen: 47 days until the birthday, 52% planned, next step: choose a venue" className="w-[64%]" sizes="(min-width: 768px) 210px, 58vw" />
          <Phone src="ai-plan" priority alt="An AI party experience: a dinosaur discovery camp for ten 5-year-olds, with theme, decorations and budget" className="absolute right-5 top-[16%] w-[54%] rotate-[3deg]" sizes="(min-width: 768px) 180px, 48vw" />
        </div>
      </section>

      {/* ------------------------------------------------------------- problem */}
      <section className="py-14 sm:py-20" aria-labelledby="pains">
        <SectionHead id="pains" eyebrow="Sound familiar?" title="Birthday planning is a lot of little jobs." />
        <ul className="mx-auto mt-7 max-w-md space-y-3 px-5">
          {PAINS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block text-[17px] font-bold leading-snug">{title}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-card/70 py-14 sm:py-20" aria-labelledby="how">
        <SectionHead id="how" eyebrow="How it works" title="From “we should do something” to a party plan." />
        <ol className="mx-auto mt-7 max-w-md space-y-3 px-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4 rounded-3xl border border-border bg-background p-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">{i + 1}</span>
              <span>
                <span className="block text-[17px] font-bold leading-snug">{s.title}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------------- AI */}
      <section id="ai" className="scroll-mt-20 py-14 sm:py-20" aria-labelledby="ai-title">
        <SectionHead id="ai-title" eyebrow="AI party planning" title="Describe the birthday. Get the whole party back." lead="Tell us about your child and the party you have in mind. Get a plan made for them — theme, activities, food, budget and a party-day timeline." />
        <PhoneRail shots={AI_SHOTS} label="AI party planning: real screens" />
        <Bullets items={['Built around your child’s age, interests, guest count and budget', 'You choose what to keep — each part is added only when you tap it', 'Change anything, or ask for another idea']} />
        <p className="mx-auto mt-5 max-w-sm px-5 text-center text-sm leading-relaxed text-muted-foreground">Shown: a real request and the real plan it produced in the app (the child’s name is hidden).</p>
      </section>

      {/* ------------------------------------------------------------- features */}
      <div id="features" className="scroll-mt-20">
        <section className="bg-card/70 py-14 sm:py-20" aria-labelledby="discover">
          <SectionHead id="discover" eyebrow="Discover" title="Find party places near you." lead="Real local venues — play spaces, science centers, studios, parks and more — matched to your child." />
          <PhoneRail shots={DISCOVER_SHOTS} label="Discover: real screens" />
          <Bullets items={['Matched to your ZIP code, your child’s interests and your budget', 'Google ratings, distance and kid-friendliness at a glance', 'Save favorites and compare them side by side']} />
        </section>

        <section className="py-14 sm:py-20" aria-labelledby="details">
          <SectionHead id="details" eyebrow="Plan the details" title="The little details are what make birthday planning stressful." lead="Food for the real headcount, a budget that adds up, a timeline for the day, one shopping list and a checklist that remembers what you’d forget." />
          <PhoneRail shots={DETAIL_SHOTS} label="Plan the details: real screens" />
        </section>

        <section className="bg-card/70 py-14 sm:py-20" aria-labelledby="guests">
          <SectionHead id="guests" eyebrow="Guests & invitations" title="Keep the guest list out of the group-chat chaos." lead="Send a beautiful invitation by link or email. Families reply in a tap, and you always know who’s coming." />
          <PhoneRail shots={GUEST_SHOTS} label="Guests and invitations: real screens" />
          <Bullets items={['Invitation designs and wording, ready to share', 'Guests RSVP without creating an account', 'See who’s going, who’s waiting and who can’t make it']} />
        </section>

        <section className="py-14 sm:py-20" aria-labelledby="magic">
          <SectionHead id="magic" eyebrow="Party Magic" title="AI helpers for every part of the party." lead="From activities with materials and steps to your welcome speech and the thank-you notes afterwards." />
          <PhoneRail shots={MAGIC_SHOTS} label="Party Magic: real screens" />
          <ul className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2 px-5" aria-label="AI helpers">
            {HELPERS.map((h) => (
              <li key={h} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {h}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------------------------------------------------------- final CTA */}
      <section id="join-final" className="scroll-mt-20 px-4 pb-16 sm:pb-24" aria-labelledby="final">
        <div className="bg-hero mx-auto max-w-md rounded-[2rem] px-5 py-10 text-center text-white shadow-xl shadow-primary/20 sm:px-8">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/85">Launching October 13</p>
          <h2 id="final" className={cn('mt-2', H2)}>Be first in line.</h2>
          <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-white/90 text-balance">Join the waitlist and we’ll let you know the moment Magical Birthday Planner opens.</p>
          <div className="mt-6 text-left">
            <WaitlistForm placement="footer" tone="dark" />
          </div>
        </div>
      </section>

      <StickyJoin />
    </div>
  )
}
