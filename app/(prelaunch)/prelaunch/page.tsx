import type { Metadata } from 'next'
import { CalendarHeart, Check, MessagesSquare, Search, ListChecks, Sparkles } from 'lucide-react'
import { Phone } from '@/components/prelaunch/Phone'
import { WaitlistForm } from '@/components/prelaunch/WaitlistForm'
import { Countdown } from '@/components/prelaunch/Countdown'
import { PrelaunchPageView, StickyJoin } from '@/components/prelaunch/PrelaunchChrome'

/**
 * The temporary pre-launch page (served at `/` from Oct 6 to Oct 12, 2026 — see lib/launch.ts).
 * Every screen shown is a real v1.0 screen with real AI output (child names blurred). No pricing, no sign-in.
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

const INTRO = 'Magical Birthday Planner brings the venue, the plan, the guest list and all the little details into one place — with AI that helps at every step.'

const PAINS = [
  { icon: Search, title: 'Twenty tabs of party places', body: 'Searching venues, comparing reviews and distances — and still not sure what your child would actually love.' },
  { icon: MessagesSquare, title: 'RSVPs lost in the group chat', body: 'Who’s coming? How many kids? It all scrolls out of sight the moment you send the invite.' },
  { icon: ListChecks, title: 'The little details pile up', body: 'Food for how many? Who’s buying the plates? What happens after cake? It’s a lot to hold in your head.' },
]

const STEPS = [
  { title: 'Tell us about your child', body: 'Their age, what they love, your ZIP code, your budget and the party you’re imagining.' },
  { title: 'Get a plan built around them', body: 'Local places that fit, a theme, activities, food and a party-day timeline — yours to change.' },
  { title: 'Keep it all in one place', body: 'Guests and RSVPs, the checklist and the shopping list, right on your phone.' },
]

const DETAILS = [
  { src: 'food', label: 'Food', alt: 'Food plan: a menu with quantities for 10 guests and an allergy reminder' },
  { src: 'budget', label: 'Budget', alt: 'Budget assistant: planned spend against a $150 budget, with ways to save' },
  { src: 'timeline', label: 'Timeline', alt: 'Party-day timeline: arrival, welcome circle, fossil dig, minute by minute' },
  { src: 'shopping', label: 'Shopping', alt: 'Shopping list built from the food plan and activities' },
  { src: 'checklist', label: 'Checklist', alt: 'AI checklist: tasks the party still needs, with due dates' },
]

const HELPERS = ['Activities', 'Party Host', 'Food', 'Messages', 'Shopping', 'Timeline', 'Budget', 'What am I forgetting?', 'Theme ideas', 'Invitation wording']

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{children}</p>
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5 text-[15px]">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PrelaunchPage() {
  return (
    <div data-testid="prelaunch-page">
      <PrelaunchPageView />

      {/* ------------------------------------------------------------------ hero */}
      <section className="bg-magic">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-6 sm:pt-12 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-8 md:pb-20 lg:pt-16">
          <div className="mx-auto w-full max-w-xl">
            <p className="inline-flex flex-wrap items-center gap-x-2 rounded-full bg-card/80 px-3 py-1.5 text-[13px] font-semibold text-primary shadow-sm ring-1 ring-primary/15" data-testid="launch-pill">
              <CalendarHeart className="h-4 w-4" aria-hidden />
              Launching October 13
              <Countdown className="font-medium text-muted-foreground before:mr-2 before:content-['·']" />
            </p>
            <h1 className="mt-3 font-display text-[2rem] font-extrabold sm:mt-4 leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.6rem]">
              Your child’s birthday. <span className="text-primary">Magically planned.</span>
            </h1>
            <p className="mt-3 text-[17px] font-semibold leading-snug text-foreground/90 sm:mt-4 sm:text-xl">Planning a kid’s birthday shouldn’t feel like managing a project.</p>
            {/* Phones: the form comes first so it sits above the fold; the explainer follows it. */}
            <p className="mt-3 hidden text-base leading-relaxed text-muted-foreground sm:block">{INTRO}</p>
            <div id="join" className="mt-5 scroll-mt-24 rounded-3xl border border-border bg-card p-4 shadow-lg shadow-primary/10 sm:mt-6 sm:p-5">
              <p className="mb-3 text-sm font-semibold leading-snug sm:text-[15px]">Be first in line when Magical Birthday Planner launches October 13.</p>
              <WaitlistForm placement="hero" />
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:hidden">{INTRO}</p>
          </div>
          <div className="relative mx-auto w-full max-w-[420px] pb-10 md:pb-16" aria-label="Real screens from Magical Birthday Planner">
            <Phone src="home" priority alt="Home screen: 47 days until the birthday, 52% planned, next step: choose a venue" className="w-[62%]" sizes="(min-width: 768px) 260px, 62vw" />
            <Phone src="ai-plan" priority alt="An AI party experience: a dinosaur discovery camp for ten 5-year-olds, with theme, decorations and budget" className="absolute right-0 top-[18%] w-[52%] rotate-[3deg]" sizes="(min-width: 768px) 220px, 52vw" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- problem */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20" aria-labelledby="pains">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Sound familiar?</Eyebrow>
          <h2 id="pains" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">Birthday planning is a lot of little jobs.</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PAINS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-card/70 py-14 sm:py-20" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 id="how" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">From “we should do something” to a party plan.</h2>
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-3xl border border-border bg-background p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-base font-extrabold text-primary-foreground">{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------- AI */}
      <section id="ai" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-14 sm:py-20" aria-labelledby="ai-title">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <Eyebrow>AI party planning</Eyebrow>
            <h2 id="ai-title" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">Describe the birthday. Get the whole party back.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Tell Magical Birthday Planner about your child, what they love, where you are and the party you have in mind. It comes back with a plan made for them — a theme, activities, food, a budget and a party-day timeline.
            </p>
            <Bullets items={['Built around your child’s age, interests, guest count and budget', 'You choose what to keep — each part is added only when you tap it', 'Change anything, or ask for another idea']} />
            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">Shown: a real request and the real plan it produced in the app (the child’s name is hidden).</p>
          </div>
          <div className="mx-auto grid w-full max-w-[460px] grid-cols-2 gap-4">
            <figure>
              <Phone src="ai-ask" crop="bottom" alt="The request: “My son is turning 5. He’s obsessed with dinosaurs. 10 kids, at home, 2 hours.”" sizes="(min-width: 768px) 220px, 45vw" />
              <figcaption className="mt-2 text-center text-sm font-semibold">You describe it</figcaption>
            </figure>
            <figure className="mt-8">
              <Phone src="ai-plan" crop="top" alt="The result: a hands-on dinosaur expedition party at home for ten 5-year-olds, with a Dino Discovery Camp theme" sizes="(min-width: 768px) 220px, 45vw" />
              <figcaption className="mt-2 text-center text-sm font-semibold">You get a plan</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- features */}
      <div id="features" className="scroll-mt-20">
        {/* Discover */}
        <section className="bg-card/70 py-14 sm:py-20" aria-labelledby="discover">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-center">
            <div className="md:order-2">
              <Eyebrow>Discover</Eyebrow>
              <h2 id="discover" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">Find party places near you.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">Real local venues — play spaces, science centers, studios, parks and more — matched to your child, with the reasons each one fits.</p>
              <Bullets items={['Matched to your ZIP code, your child’s interests and your budget', 'Google ratings, distance and kid-friendliness at a glance', 'Save favorites and compare them side by side']} />
            </div>
            <div className="mx-auto grid w-full max-w-[460px] grid-cols-2 gap-4 md:order-1">
              <Phone src="discover" alt="Party places near you: 11 options matched within 20 miles" sizes="(min-width: 768px) 220px, 45vw" />
              <Phone src="discover-why" alt="Why we recommend a science center: matches the child’s love of science, rated 4.8 by 278 Google reviewers, 5 miles away" className="mt-10" sizes="(min-width: 768px) 220px, 45vw" />
            </div>
          </div>
        </section>

        {/* Plan the details */}
        <section className="py-14 sm:py-20" aria-labelledby="details">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Plan the details</Eyebrow>
              <h2 id="details" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">The little details are what make birthday planning stressful.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">Food for the real headcount, a budget that adds up, a timeline for the day, one shopping list and a checklist that remembers what you’d forget.</p>
            </div>
          </div>
          <ul className="no-scrollbar mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:justify-center" aria-label="Plan the details: real screens" data-testid="details-strip">
            {DETAILS.map((d) => (
              <li key={d.src} className="w-[58vw] max-w-[210px] shrink-0 snap-center lg:w-[200px]">
                <p className="mb-2 text-center text-sm font-bold">{d.label}</p>
                <Phone src={d.src} alt={d.alt} sizes="210px" />
              </li>
            ))}
          </ul>
        </section>

        {/* Guests & invitations */}
        <section className="bg-card/70 py-14 sm:py-20" aria-labelledby="guests">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-center">
            <div>
              <Eyebrow>Guests &amp; invitations</Eyebrow>
              <h2 id="guests" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">Keep the guest list out of the group-chat chaos.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">Send a beautiful invitation by link or email. Families reply in a tap, and you always know who’s coming.</p>
              <Bullets items={['Invitation designs and wording, ready to share', 'Guests RSVP without creating an account', 'See who’s going, who’s waiting and who can’t make it']} />
            </div>
            <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-3">
              <Phone src="invitation" alt="An invitation design: You’re invited to a 5th birthday party, Saturday November 21, 2 to 4 PM" sizes="(min-width: 768px) 170px, 30vw" />
              <Phone src="rsvp" alt="The RSVP page a guest sees, with the party details and an add-to-calendar button" className="mt-8" sizes="(min-width: 768px) 170px, 30vw" />
              <Phone src="guests" alt="The guest list: 6 going, 8 kids and 4 adults, with going, waiting and can’t go filters" sizes="(min-width: 768px) 170px, 30vw" />
            </div>
          </div>
        </section>

        {/* Party Magic */}
        <section className="py-14 sm:py-20" aria-labelledby="magic">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-center">
            <div className="md:order-2">
              <Eyebrow>Party Magic</Eyebrow>
              <h2 id="magic" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">AI helpers for every part of the party.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">From activities with materials and steps to the words for your welcome and the thank-you notes afterwards — help is there whenever you want it.</p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="AI helpers">
                {HELPERS.map((h) => (
                  <li key={h} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden /> {h}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-3 md:order-1">
              <Phone src="activity" alt="An AI activity: a constellation hunt with steps, estimated cost and a materials list" sizes="(min-width: 768px) 170px, 30vw" />
              <Phone src="host" alt="AI Party Host: a welcome speech for the party, ready to copy or edit" className="mt-8" sizes="(min-width: 768px) 170px, 30vw" />
              <Phone src="themes" alt="AI theme ideas: Dino Dig Discovery Lab with decorations, activities and food ideas" sizes="(min-width: 768px) 170px, 30vw" />
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------- final CTA */}
      <section id="join-final" className="scroll-mt-20 px-4 pb-16 sm:pb-24" aria-labelledby="final">
        <div className="bg-hero mx-auto max-w-3xl rounded-[2rem] px-5 py-10 text-center text-white shadow-xl shadow-primary/20 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Launching October 13</p>
          <h2 id="final" className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">Be first in line.</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/85">Join the waitlist and we’ll let you know the moment Magical Birthday Planner opens.</p>
          <div className="mx-auto mt-6 max-w-md text-left">
            <WaitlistForm placement="footer" tone="dark" />
          </div>
        </div>
      </section>

      <StickyJoin />
    </div>
  )
}
