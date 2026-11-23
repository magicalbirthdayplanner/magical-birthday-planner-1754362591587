# Magical Santa — Product Requirements (MVP, Christmas 2026)

Status: agreed direction 2026-11-22. Launch target 2026-12-01. Site: Magical Holidays on its own domain (domain to be
provided by the owner); the Magical Birthday Planner site stays as it is.

## Positioning

**A little Christmas magic. A conversation made just for them.**
Your child doesn't just watch Santa — they get to talk with him. You personalize the visit, you test it first, then
you bring the magic to your child.

Live AI Santa calls are already a crowded category (Dial Santa, Magic Santa, Portable North Pole, ConstantLife.AI and
others offer parent setup and live calls). We do not win on features; we win on **quality of conversation, parent
trust and reliability**. Three promises:

1. **Personal** — Santa knows the little things that make your child special.
2. **Trusted** — parents control the details, preview the experience privately and stay in charge.
3. **Magical** — a genuine-feeling two-way conversation, not a prerecorded performance.

Pricing stance: **premium but accessible** — $9.99 flat, clear before checkout, no surprises.

Brand name: working name *Magical Santa* (Magical family). Alternatives under consideration: *Northstar Santa*,
*The Santa Line*. No name or domain is cleared for trademark yet. The name is one setting in the brand registry.

A parent-controlled web experience. Children never sign in, navigate or type: the parent sets everything up, tests
it, approves it, pays once, then hands the screen to the child.

## Launch priorities (in order)

1. Exceptional, natural Santa conversation (`lib/santa/persona.ts` — listening, no interrogation, shy-child and
   "I don't know" handling, no promises, natural goodbyes; verified by the live conversation-quality and safety suite)
2. Simple parent personalization (emotional direction, not a script)
3. Private test call
4. Reliable connection and recovery (+ the guarantee below)
5. Flat one-time pricing
6. Parent-controlled privacy
7. One post-call keepsake (Nice List certificate)

Not for launch: games, social features, elaborate dashboards, other characters, silent memory of children's data.

## Offer (updated 2026-11-22 — owner decision)

**$4.99 = 3 minutes of live talk with Santa. Top up 3 minutes at a time (3 / 6 / 9 minutes per checkout).**
Minutes are a wallet: only connected time is charged (sessions under 15 s are free), unused time stays, a dropped call
just continues from the balance. **Free 30-second live preview for anyone, no sign-up** (`/santa/try`), capped per
client per day and globally. The table below is the earlier proposal, kept for history.


| | |
|---|---|
| Price | **$9.99 one-time** per visit (configurable server-side; no subscriptions, no per-minute billing) |
| Includes | One personalized Santa video visit for one child, **up to 10 minutes** |
| Free | A short **preview / technical test** before purchase (signed-in parent) |
| Reconnect | If the call drops, the parent can reconnect within **30 minutes** and continue with the remaining time, without paying again |
| Another visit | Buy another visit (same flow). Bundles are a later decision |

No visible countdown in front of the child. The time limit is built into Santa's behaviour.

## Parent flow

1. **Landing page** — Santa hero, short example video, "$9.99, one visit up to 10 minutes", privacy reassurance,
   FAQ, one CTA: **Create Your Santa Call**.
2. **Sign in** — existing email-code / Google sign-in (parent account only).
3. **Set up (3 short steps)**
   1. *About your child*: first name, age (2–12), optional "how to say the name".
   2. *Make it personal* — the emotional direction, all optional, as chips + short text:
      - **Celebrate** something they achieved · **Encourage** them about something they're learning
      - What they **love** (hobbies, animals, a favourite character) · Christmas **wishes**
      - Anything Santa should **avoid**
      - **Santa's manner**: Traditional (default) · Gentle · Funny · Playful
   3. *Preview*: what Santa will know, written out in plain language, and Santa's opening line.
4. **Parent notice & consent** — plain-language notice of how the call works (AI, live audio/video to our providers,
   no recording by us, what is kept and for how long), parent/guardian affirmation, supervision expectation.
5. **Test Santa privately (free preview)** — real call interface, ~60 seconds: device check (mic, speaker, camera
   permissions, autoplay, connection quality), Santa says the child's name and one personal line, then talks to the
   grown-up. Clearly labelled *Preview*; never uses the paid visit. Parent can edit and test again (2 previews per
   account by default). Ends with **"Looks perfect — I approve"**, which is what makes the real visit startable.
6. **Payment** — $9.99 via the existing Dodo hosted checkout. Server-verified only.
7. **Santa visit** — parent opens the visit, gets the child ready, taps *Start*. Full-screen: Santa's video, a
   discreet connection indicator, mute, and a parent-only *End visit* (confirmation). No clock.
8. **After** — thank-you screen with the **keepsake**: a printable/downloadable *Nice List certificate* with the
   child's first name, the date and one line from the parent's "Celebrate" item (built only from what the parent
   entered — never from the conversation, which we don't keep). "Book another visit".

## Visit shape (10 minutes, invisible to the child)

| Time | Santa |
|---|---|
| 0–2 min | Greets by name, builds rapport |
| 2–7 min | Interests, proud moments, wishes, Christmas |
| 7–9 min | Relaxed: what are you excited about, a North Pole story; no new big topics |
| 9–10 min | Warm goodbye; the call ends gracefully at the cap |

Phases are computed on our server from the session's connected time and given to Santa as private cues.
A gentle parent-only indicator may appear around minute 8 (parent UI corner, not a timer).

## Rules for counting a visit

- A visit is **used** only after at least **45 seconds** of connected time. Failed connections never use a visit.
- A drop keeps the visit open for 30 minutes with the remaining time.
- Parent *End visit* or reaching 10 minutes completes the visit.
- Refund → the visit can no longer be started.

## Reliability guarantee — "If Santa doesn't show up, we'll make it right."

- Pre-call device check (in the preview and again right before the visit).
- Automatic reconnect attempts for brief network blips; manual reconnect within 30 minutes with the remaining time.
- A visit that never really connected (< 45 s) is automatically returned — no claim needed.
- Qualifying technical failure after that (provider outage, repeated drops, Santa frozen/unresponsive): a free
  **replacement visit** (one tap by support/admin, idempotent per failed session) or a refund, the parent's choice.
- Monitoring: connection success rate, time-to-Santa, drops per visit, LLM latency, provider errors, abandoned
  sessions — with alerts and the kill switch.

## Personalization data (the only child data we collect)

First name, optional pronunciation, age, Santa's manner, loves, things to celebrate, things to encourage, wishes,
topics to avoid. **Never**: surname,
address, school, phone, email, photos. Contact details and addresses typed into free text are stripped.

## Parent dashboard (minimal)

Child profiles (edit/delete), visits (remaining / used / open with reconnect), purchase history, data deletion
request, support link. No transcripts exist to show.

## Out of scope for Dec 1

Bundles/packs, gifting, voice instructions, recordings/keepsake video, Christmas Eve message, bedtime story,
memory page, opt-in "next Christmas" reuse of details, child accounts, native apps, non-US payments, languages other
than English, other characters. (Longer term: a reusable real-time character platform; Santa is the first.)

## Success metrics

Landing → setup start → setup complete → preview started → preview connected → checkout → purchase → visit started
→ visit connected → visit completed; repeat purchase; failed-connection rate; average connected minutes; provider
cost per visit; contribution per purchase; refund rate.
