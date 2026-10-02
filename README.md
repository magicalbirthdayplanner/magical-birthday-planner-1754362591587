# Magical Birthday Planner

A **mobile-first web app (PWA)** that helps parents plan a child's birthday party: tell it about
the child, the date, ZIP code, guests, budget, vibe and interests, and it finds and ranks local
party venues, builds a plan, and handles invitations, RSVPs and a checklist.

| Layer | Service |
|---|---|
| App | Next.js 14 (App Router) + TypeScript + Tailwind, deployed on **Vercel** |
| Database & auth | **Supabase** (Postgres + RLS, email/password auth) |
| Venues & map | **Google Places API (New)** (server) · **Google Maps JavaScript API** (browser) |
| Email | **Resend** (invitation, RSVP confirmation, host notification) |
| Payments | **Dodo Payments** (server-created checkout, signed webhook, server-side entitlement) |
| AI theme ideas (optional) | Azure OpenAI |

## Product flow

```
Landing → Sign up / Sign in → wizard (child · birthday · ZIP · guests · budget · vibe · interests · theme)
→ venue discovery (list + map) → venue details → save / add to party
→ guests → invitation → guest RSVP → checklist → plan → optional paid plan (Dodo)
```

## Repository map

| Path | What |
|---|---|
| `app/(app)` | Signed-in app with bottom navigation: `/home`, `/plan/*`, `/discover/*`, `/guests`, `/more` |
| `app/(flow)` | Full-screen flows: `/start` (wizard), `/login`, `/join`, `/reset-password`, `/venue/[placeId]`, `/invite/[token]` (guest RSVP), `/offline` |
| `app/(site)` | Public pages: landing `/`, `/pricing`, `/checkout-success`, `/privacy`, `/terms` |
| `app/api` | Route handlers: discovery, themes AI, invitations, RSVP, billing, Dodo webhook, analytics, health |
| `components/` | UI by feature (`app`, `wizard`, `discover`, `plan`, `guests`, `invite`, `more`, `billing`, `site`, `ui`) |
| `lib/` | Domain + server code (`discovery`, `google`, `billing`, `server`, `data`, `planning`, `geo`, `analytics`) |
| `supabase/migrations` | Database schema (source of truth) |
| `tests/` | `unit`, `integration` (local Supabase), `e2e` (Playwright, phone viewports), `mock-google` (mock Google/Resend/Dodo) |
| `docs/` | Architecture, integrations, security, release and launch documentation |

## Local development

```bash
npm ci
cp .env.example .env.local                # fill in values (see comments in the file)
npm run db:start && npm run db:reset      # local Supabase in Docker (API :54321)
node tests/mock-google/server.mjs         # terminal 2: mock Google / Resend / Dodo on :4010
npx dotenv -e .env.e2e -- npm run dev     # app on http://localhost:3100 against local services
```

## Checks

```bash
npm run check              # lint · typecheck · unit tests · production build · client-bundle secret scan
npm run test:integration   # RLS, API, billing, email (needs local Supabase)
npm run test:e2e           # Playwright on phone viewports (builds and starts the app itself)
npm run scan:history       # secret patterns across Git history (values never printed)
```

## Documentation

* [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md): status and setup of every external service
* [`docs/RELEASE.md`](docs/RELEASE.md): deploying to Vercel, environment variables
* [`docs/LAUNCH_READINESS_REPORT.md`](docs/LAUNCH_READINESS_REPORT.md): launch review and checklist
* [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/BILLING_SECURITY.md`](docs/BILLING_SECURITY.md)
* [`docs/LOCAL_DISCOVERY.md`](docs/LOCAL_DISCOVERY.md) · [`docs/GOOGLE_PLACES.md`](docs/GOOGLE_PLACES.md) · [`docs/GOOGLE_PLACES_COST_CONTROL.md`](docs/GOOGLE_PLACES_COST_CONTROL.md)
* [`docs/SUPABASE_SCHEMA.md`](docs/SUPABASE_SCHEMA.md) · [`docs/MOBILE_UX.md`](docs/MOBILE_UX.md) · [`docs/PWA.md`](docs/PWA.md) · [`docs/TESTING.md`](docs/TESTING.md)
* [`docs/LEGACY_CLEANUP_REPORT.md`](docs/LEGACY_CLEANUP_REPORT.md): what was removed when the repository was consolidated
* [`docs/archive/`](docs/archive/): dated audit reports from earlier phases (historical; not current instructions)
