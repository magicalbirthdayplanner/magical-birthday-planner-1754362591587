# Magical Birthday Planner

**An AI-powered birthday planning platform that helps busy parents plan, organize, and execute magical birthday parties.**

> Private repository. Production: the canonical origin is configured in `lib/site-url.ts` / `NEXT_PUBLIC_BASE_URL`.
> Never commit secrets — see [Security](#security) and [`.env.example`](.env.example).

---

## Contents

- [What is Magical Birthday Planner?](#what-is-magical-birthday-planner)
- [Core product experience](#core-product-experience)
- [AI planning assistant](#ai-planning-assistant)
- [Feature inventory](#feature-inventory)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Integrations](#integrations)
- [Security](#security)
- [Local development](#local-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Operations & observability](#operations--observability)
- [Launch status](#launch-status)
- [Documentation map](#documentation-map)

---

## What is Magical Birthday Planner?

Planning a child's birthday means juggling a theme, activities, a venue, the guest list, invitations and RSVPs,
food, a budget, shopping, a timeline, a checklist — and then actually running the party. Parents usually do
this across Google searches, Pinterest boards, chat threads, spreadsheets and notes.

MBP puts the whole party in **one mobile-first app** (an installable PWA). A parent answers nine quick questions
about the child and the party, gets real local venues matched to the child, and plans everything in one place.
An **AI planning assistant** works inside that plan: it reads the party's real context (age, guests, budget,
theme, venue, RSVPs) and produces structured suggestions the parent can add to the party with one tap — it is
not a free-form chatbot.

## Core product experience

All of these flows exist in the current code (`app/`, `components/`):

```
Landing (/) ─► Sign up / Sign in (/join, /login, Google OAuth)
   ─► Party wizard (/start): child · age · date · ZIP · guests · budget · vibe · interests · theme
   ─► Venue discovery (/discover): ranked list + Google map ─► venue details (/venue/[placeId])
        ─► save to shortlist (/discover/saved) ─► add as the party venue
   ─► Party plan (/plan): progress, next step, theme (/plan/theme), checklist (/plan/checklist),
        "Your party plan" (activities · shopping · budget · timeline), Party Magic (AI)
   ─► Activities (/activities): planned activities, ideas, AI Activity Studio
   ─► Guests (/guests) ─► Invitation (/plan/invite): design, share link, email guests
        ─► Guest RSVP page (/invite/[token], no account needed) ─► host notification email
   ─► AI assistance throughout (Plan My Party, theme ideas, checklist, activities, host lines, party experience)
   ─► Party day: timeline, host lines (welcome / activity intro / cake / closing), checklist
   ─► More (/more): parties, plan & billing, account, notifications, install, sign out
```

Public pages: landing `/`, `/pricing`, `/privacy`, `/terms`, `/checkout-success`. Admin: `/admin` (Super Admin only).

---

## AI planning assistant

Status legend: **LIVE** (enabled in production) · **IMPLEMENTED, DISABLED** (code + tests exist, flag off) ·
**FUTURE** (not built).

Plans and minimum plans come from one place, **[`lib/entitlements.ts`](lib/entitlements.ts)** (product model and
validation: [docs/PRODUCT_MODEL_AUDIT.md](docs/PRODUCT_MODEL_AUDIT.md)). Free has no AI.

| Feature | Status | Where in the UI | Route | Min plan |
|---|---|---|---|---|
| **Plan My Party** | LIVE | Home and Plan → "Plan My Party" card | `POST /api/ai/party-planner` | Starter |
| **AI Theme Ideas** | LIVE | Plan → Theme → "Dream up themes with AI" | `POST /api/ai/theme-ideas` | Starter |
| **AI Checklist** ("What am I forgetting?") | LIVE | Plan → Checklist | `POST /api/ai/checklist` | Starter |
| **Activity Studio** | LIVE | Activities → "Create an activity"; activity detail → adjust | `POST /api/ai/activity` | Starter |
| **Food planner, Budget assistant, Invitation writer, Timeline, Shopping list** | IMPLEMENTED — enable with the product-model deploy | Plan → Party Magic / AI tools; Invite → "Write it for me" | `/api/ai/{food,budget,invitation,timeline,shopping-list}` | Plus |
| **Party Host** (what to say, thank-yous) | LIVE | Plan → Party Magic → Host / Messages; activity intros | `POST /api/ai/host` | Pro |
| **Party Experience** ("Create my party experience") | LIVE | Plan → Party Magic | `POST /api/ai/party-experience` | Pro |
| Activities list (legacy), "Why these places" | IMPLEMENTED, NOT SOLD | — | `/api/ai/{activities,discover-explain}` | Starter / Plus |

`AI_ENABLED_FEATURES` turns features on; the product-model deploy adds the five Plus features (see
docs/PRODUCT_MODEL_AUDIT.md §J). Every feature shares one pipeline (`lib/ai/handler.ts`):

```
UI ─► POST /api/ai/<feature> ─► authenticate (Bearer JWT) ─► strict body validation (zod, 16 KB cap)
   ─► party ownership (user's RLS session) ─► feature flag ─► plan gate ─► party context (lib/ai/context.ts)
   ─► server-only usage reservation (ai_reserve, global breaker inside) ─► per-party / hourly / daily caps
   ─► model call (lib/ai/client.ts: timeout, ≤1 repair retry, JSON schema validation, safety scrub)
   ─► server post-processing (ids, totals, dates) ─► finalize (service role) ─► Sentry telemetry
   ─► parent reviews ─► "Add" / "Use" applies items to party tables (POST /api/ai/apply)
```

- **Provider:** OpenAI-compatible abstraction (`lib/ai/provider.ts`, `lib/ai/providers/*`); production uses the
  configured provider/model from `AI_PROVIDER` / `AI_MODEL` with reasoning off. Tests use a deterministic mock.
- **Results persist** in `ai_generations`; reopening a feature restores the last result **without** a new request.
- **Limits (current production config):** per party Starter 10 · Plus 25 · Pro 50 (Free 0); per user 10/hour and
  10/day (`AI_USER_DAILY_LIMIT`); global breaker 50/day (`AI_GLOBAL_DAILY_LIMIT`). Failed calls count toward the
  user and global limits, not the per-party allowance. The sign-up trial includes no AI.

Full per-feature documentation (context, outputs, apply targets, errors, tables, tests):
**[docs/ai/AI_FEATURES.md](docs/ai/AI_FEATURES.md)**.

---

## Feature inventory

Details per feature: **[docs/FEATURES.md](docs/FEATURES.md)**.

| Area | What parents get |
|---|---|
| Party creation | 9-step wizard with a summary; multiple parties per account; edit details later |
| Venue discovery | Real local venues (Google Places) ranked for the child's age, interests, budget, setting and distance; filters; cache-first |
| Google Maps | Map view with clustered rating markers and a bottom sheet |
| Venue details | Photos, rating, address, hours, phone, website, directions, "why we recommend it" |
| Saved venues | Shortlist with private notes and compare; one venue can be the party venue |
| Guests (Starter+) | Guest list with RSVP status, kids/adults counts, notes; enforced by RLS (`has_paid_access`) |
| Invitations | Designed invitation card, share link, email to guests (Resend) |
| RSVP | Public page, no account; idempotent per invitee; host notification + guest confirmation emails |
| Checklist | Dated tasks generated from the party date; auto-completes milestones; AI additions |
| Activities | Planned activities with materials, timing and cost; ideas; Activity Studio |
| Food / shopping / budget / timeline | "Your party plan" sections fed by AI results and activities |
| Themes | Curated theme catalogue + AI theme ideas |
| Party Host | AI speeches and messages for the party day and after |
| Billing | Free + Starter / Plus / Pro priced per party (each purchase unlocks one party) via Dodo hosted checkout; 24 h trial of Starter's guest & RSVP features (no AI) on sign-up |
| Super Admin | User search, plan overrides with audit log, stats (server-verified role) |
| PWA / mobile | Installable, offline shell, 44 px touch targets, tested at 375–430 px |

## Tech stack

Versions verified from `package.json` / the lockfile.

| Area | Technology |
|---|---|
| Framework | Next.js **15.5.27** (App Router), React **19.3.0**, TypeScript **5.5.4** |
| Styling | Tailwind CSS 3.4.13, Radix primitives, lucide-react, Nunito |
| Data / auth | Supabase (Postgres + RLS + Auth), `@supabase/supabase-js` 2.x, SWR |
| Maps / venues | Google Places API (New) (server), Google Maps JavaScript API via `@vis.gl/react-google-maps` 1.10.1 |
| Payments | Dodo Payments (hosted checkout + signed webhooks) |
| Email | Resend 6.0.1 |
| AI | OpenAI-compatible provider abstraction (`openai` SDK 5.x), zod-validated structured output |
| Observability | Sentry (`@sentry/nextjs` 11.4.0): errors, tracing, logs, metrics, uptime |
| Hosting | Vercel (production + preview), Cloudflare DNS |
| Tests | Vitest 3.2.7 (unit + integration), Playwright 1.55.1 (mobile E2E) |
| Runtime | Node.js 22 |

## Architecture

```
Browser (PWA) ──HTTPS──► Vercel (Next.js App Router)
   │  anon key + user JWT             ├─ route handlers /api/*  (server-only modules, service role where required)
   │                                  ├─ Sentry (instrumentation*.ts, sentry.server.config.ts)
   ▼                                  │
Supabase Postgres (RLS) ◄─────────────┤──► Google Places API (New)   ──► Dodo Payments (checkout, webhooks)
Supabase Auth (email/password, Google)│──► AI provider (OpenAI-compatible) ──► Resend (email)
```

Repository map:

| Path | What |
|---|---|
| `app/(site)` | Public pages (landing, pricing, privacy, terms, checkout success) |
| `app/(flow)` | Full-screen flows: wizard, login/join/reset, venue detail, guest RSVP, offline |
| `app/(app)` | Signed-in app with bottom navigation: home, plan, activities, discover, guests, more, admin |
| `app/api` | Route handlers: `ai/*`, `discovery/*`, `billing/*`, `webhooks/dodo`, `invitations/send`, `invite/[token]/rsvp`, `admin/*`, `analytics`, `health` |
| `components/` | UI by feature |
| `lib/ai` | AI handler, provider abstraction, context, prompts, features, apply, usage accounting |
| `lib/billing` · `lib/discovery` · `lib/google` · `lib/server` · `lib/observability` | Domain and server code |
| `supabase/migrations` | Database schema — the source of truth (13 migrations) |
| `tests/` | `unit`, `integration` (local Supabase), `e2e` (Playwright), `mock-google` (mock Google/Resend/Dodo) |
| `docs/` | Architecture, AI, security, integrations, testing, release, launch and operations docs |

More: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (system, data model, RLS, migrations).

## Integrations

| Integration | Used for | Secret placement | Docs |
|---|---|---|---|
| Supabase | Auth, Postgres, RLS, RPCs, migrations | anon key public; service role server-only | [ARCHITECTURE](docs/ARCHITECTURE.md), [SUPABASE_SCHEMA](docs/SUPABASE_SCHEMA.md) |
| Google Places (New) / Maps JS | Venue search, details, photos, map | Places key server-only; separate referrer-restricted browser Maps key | [GOOGLE_PLACES](docs/GOOGLE_PLACES.md), [cost control](docs/GOOGLE_PLACES_COST_CONTROL.md) |
| Dodo Payments | One-time Starter / Plus / Pro checkout, webhooks, entitlement | server-only | [BILLING_SECURITY](docs/BILLING_SECURITY.md) |
| Resend | Invitations, RSVP confirmation, host notification; Supabase auth email via SMTP | server-only | [INTEGRATIONS](docs/INTEGRATIONS.md) |
| AI provider | All AI features | server-only (`AI_API_KEY`) | [docs/ai/AI_FEATURES.md](docs/ai/AI_FEATURES.md) |
| Sentry | Errors, tracing, logs, metrics, alerts, uptime | DSN public; auth token build-only | [OBSERVABILITY](docs/OBSERVABILITY.md) |
| Vercel | Hosting, production + preview, env separation | Vercel project settings | [RELEASE](docs/RELEASE.md) |

## Security

Summary (details and known trade-offs: **[docs/SECURITY.md](docs/SECURITY.md)**):

- **RLS everywhere.** The browser only holds the anon key and the user's JWT; user data is owner-scoped by policy.
- **Server-side authority.** Plans/trials, billing, AI usage reservation and finalization, RSVP writes and admin
  actions run only on the server (service role, `server-only` modules) after authentication and ownership checks.
- **AI usage accounting** cannot be manipulated by clients: no direct reservation RPC, usage survives party/account
  deletion, global breaker enforced atomically.
- **Billing:** server picks product and price; plans are granted only by verified (Standard Webhooks HMAC) Dodo
  webhooks; replay/duplicate safe.
- **Admin:** server-verified `super_admin` role; non-admins get 404; every override is audited.
- **Secrets:** server-only modules; `npm run check:secrets` scans the client bundle; `npm run scan:history` scans Git
  history without printing values. `.env*` files are git-ignored (only `.env.example` and the demo-only `.env.e2e`).

## Local development

Requirements: Node 22, npm, Docker (for the local Supabase stack).

```bash
git clone <private repository URL>
cd magical-birthday-planner
npm ci
cp .env.example .env.local          # fill in YOUR_* values for the services you need; never commit it
npm run db:start && npm run db:reset # local Supabase (Docker) + all migrations
npm run dev                          # http://localhost:3100
```

- Without Google keys the app uses a schematic map; without `AI_*` the AI features stay hidden; without Dodo keys
  checkout reports "not configured". `AI_PROVIDER=mock` gives deterministic AI output locally.
- `.env.example` lists every variable the code reads, grouped PUBLIC vs SERVER, with placeholders only.

| Task | Command |
|---|---|
| Lint / typecheck | `npm run lint` · `npm run typecheck` |
| Unit tests | `npm test` |
| Integration tests (local Supabase) | `npm run test:integration` |
| E2E (mobile, mocked Google/Resend/Dodo) | `npx playwright install chromium && npm run test:e2e` |
| Production build | `npm run build` |
| Client-bundle secret scan (after build) | `npm run check:secrets` |
| Git-history secret scan | `npm run scan:history` |
| Everything | `npm run check` |
| Regenerate DB types | `npm run db:types` |

## Testing

Current results (run 2026-10-04 on this commit): **Vitest 492/492** (unit 238 in 21 files, integration 254 in
17 files) · **Playwright 40/40** (29 specs × phone projects) · lint, typecheck, build and secret scan clean.

Layers: unit (pure logic, AI client, discovery, billing, observability) · integration against local Supabase
(RLS, security, billing/webhooks, email caps, AI features, AI usage security attacks, RSVP idempotency) ·
mobile E2E with mocked Google/Resend/Dodo · production smoke tests with temporary accounts (documented in
[docs/LAUNCH_STATUS.md](docs/LAUNCH_STATUS.md)). Details: **[docs/TESTING.md](docs/TESTING.md)**.

## Deployment

```
GitHub (private) ──push master──► Vercel production build ──► production domain
                └─push mobile-first──► Vercel preview (branch-scoped env vars)
Supabase migrations: applied separately with `supabase db push --db-url <session pooler URL>`
```

- Production deploys from `master`; preview environment variables are scoped to the `mobile-first` branch.
- **Order:** apply a migration first, then deploy the app that needs it (see each migration's header).
- **Rollback:** promote the previous Vercel deployment; migrations are additive and not reversed blindly
  (check compatibility first — e.g. after `20251004001200` the previous app cannot reserve AI usage).

Runbook: **[docs/RELEASE.md](docs/RELEASE.md)**.

## Operations & observability

Sentry is the single observability platform: client/server errors, request errors, tracing, structured logs and
metrics (AI, billing, auth, Google, DB), 11 metric monitors plus uptime on `/api/health`, emailed alerts.
Event names and alerts: **[docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)**.

## Launch status

The product is live on the production domain with live payments. Completed work, remaining items, deferred work
and known limitations: **[docs/LAUNCH_STATUS.md](docs/LAUNCH_STATUS.md)**. History: **[CHANGELOG.md](CHANGELOG.md)** ·
Roadmap: **[docs/ROADMAP.md](docs/ROADMAP.md)**.

## Documentation map

See **[docs/README.md](docs/README.md)** for the full index.
