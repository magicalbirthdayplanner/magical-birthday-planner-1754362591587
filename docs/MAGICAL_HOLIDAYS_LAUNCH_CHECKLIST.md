# Magical Holidays — Launch readiness (live report)

Updated 2026-11-22. Statuses: **COMPLETE** · **IN PROGRESS** · **BLOCKED** · NOT STARTED.
Nothing is marked complete unless it exists in the repo and was tested.

## Launch blockers

| # | Item | Status | Needs |
|---|---|---|---|
| B1 | Vendor permission for child end users (avatar vendor + LLM): written confirmation, DPA, no training, minimal retention | **BLOCKED** | Owner to contact LiveAvatar/HeyGen (and Tavus as fallback); Azure OpenAI data terms review |
| B2 | Legal review: COPPA (2025 amended rule), state laws, notice + verifiable parental consent method, privacy policy, terms | **BLOCKED** | Counsel |
| B3 | Real-time Santa PoC (storybook Santa default; Simli optional) + OpenAI Realtime on iPhone Safari + Android Chrome | IN PROGRESS — full two-way call works in desktop Chrome (face ~4 s, Santa's first words ~7–9 s after Start, replies ~1–2 s after the child stops); placeholder face; phones untested | Simli Hobby plan + Santa face; real phones; dedicated ZDR OpenAI key before children |
| B4 | Domain for Magical Holidays | **BLOCKED** | Owner (will provide) |

## Engineering

| Item | Status | Evidence |
|---|---|---|
| Architecture audit | COMPLETE | `docs/MAGICAL_HOLIDAYS_ARCHITECTURE_AUDIT.md` |
| Provider research & recommendation | COMPLETE (pending PoC) | `docs/MAGICAL_HOLIDAYS_PROVIDER_COMPARISON.md` |
| Santa prompt layers (incl. conversation craft, 4 Santa styles), phases, child profile schema | COMPLETE (pending live red-team) | `lib/santa/persona.ts`, `tests/unit/santa-persona.test.ts` (24 tests) |
| `SantaAvatarProvider` interface + mock | COMPLETE | `lib/santa/providers/*` |
| Visit/preview/session ledger + RPCs | COMPLETE (local) | migration `20251122002400`, `tests/integration/santa-ledger.test.ts` (12 tests) |
| Santa-hat icon set | COMPLETE (first cut; owner review) | `scripts/holidays-icons.py`, `public/brands/holidays/` |
| Brand registry + Holidays deployment config | NOT STARTED | |
| Storybook Santa (`components/santa/StorybookSanta.tsx`), OpenAI Realtime server module, call screen, PoC page `/santa/poc` | IN PROGRESS (works in desktop Chrome) | `lib/santa/realtime.ts`, `components/santa/SantaCall.tsx`, `tests/unit/santa-realtime.test.ts` |
| Sessions API, LLM route, reaper | NOT STARTED | |
| Call UI (permissions, autoplay, reconnect, parent end) | NOT STARTED | |
| Landing page | NOT STARTED | |
| 3-step setup + preview + consent screens | NOT STARTED | |
| Dodo Santa product + checkout + webhook branch | NOT STARTED | Dodo product id |
| Parent dashboard + deletion request | NOT STARTED | |
| Admin ops (stats, cost, kill switch, caps) | NOT STARTED | |
| Analytics funnel events (no child data) | NOT STARTED | |
| Safety red-team suite (live) | NOT STARTED | B3 |
| Real-device matrix, load/concurrency test | NOT STARTED | |
| Remaining docs: AI engine, child safety, privacy & consent, payment flow, deployment | IN PROGRESS | |
| Staging deploy, monitoring, rollback | NOT STARTED | |

## Definition of done (from the brief)

Branded Magical Holidays · Santa icon · existing infrastructure reused · mobile + desktop browsers · parent can buy ·
personalize · consent collected · real-time Santa session · Santa answers spoken questions using parent context ·
safety enforced · limits enforced server-side · failed sessions not charged · data protected · monitoring + kill
switch · cross-device tests pass · legal/privacy reviewed.

## Added 2026-11-22 (differentiation)

| Item | Status | Evidence |
|---|---|---|
| Parent approval gate before a paid visit (edits clear it) | COMPLETE (local) | ledger `not_approved`, integration test |
| Reliability guarantee: auto-return of never-connected visits | COMPLETE (local) | ledger `voided` |
| Replacement visit for qualifying failures (admin, idempotent per session) | NOT STARTED | |
| Nice List certificate keepsake (parent-entered data only) | NOT STARTED | |
| Conversation-quality suite (shy child, "I don't know", pauses, mishearing, no interrogation) | NOT STARTED | needs B3 |
| Brand name decision + trademark/domain clearance | **BLOCKED** | Owner |

## Added 2026-11-22 (product build)

| Item | Status | Evidence |
|---|---|---|
| Pricing: $4.99 per 3 minutes, top-ups 3/6/9 min (minutes wallet) | COMPLETE (code) | `lib/santa/packs.ts`, `tests/unit/santa-billing.test.ts` |
| Landing page `/santa` (mobile, "no app needed") | COMPLETE (local) | `components/santa/SantaLanding.tsx` |
| Parent setup `/santa/create` (4 steps, approve, email-code sign-in) | COMPLETE (local) | `components/santa/SantaSetup.tsx`, `tests/e2e/santa.spec.ts` |
| Santa page `/santa/ready` (choose pack, get-ready, reconnect, edit/delete) | COMPLETE (local) | `components/santa/SantaReady.tsx` |
| Santa checkout + Dodo webhook branch (own ledger) | COMPLETE (mock Dodo) | `lib/santa/billing.ts`, e2e journey |
| Paid call `/santa/call` + sessions API + reaper cron | IN PROGRESS (live test pending Santa face) | `components/santa/SantaCallPage.tsx`, `app/api/santa/*` |
| Dodo live product SANTA_TIME ($4.99, quantity allowed) | **BLOCKED** — owner creates in Dodo; set `DODO_PRODUCT_SANTA_TIME` | |
| Supabase sign-in email says "Magical Birthday Planner" | **BLOCKED** — owner approves a neutral subject ("Your Magical sign-in code") in production Supabase | |
| Domain + host routing to `/santa` | **BLOCKED** — owner (tomorrow) | |
| Demo video (20–30 s) | NOT STARTED — needs the Santa face | |
| Free 30-second preview, no sign-up (`/santa/try`) with per-client + daily caps | COMPLETE (local, live-tested) | `app/api/santa/preview/*`, ledger tests |
