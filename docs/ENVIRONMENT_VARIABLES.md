# Environment variables

**Names only — never commit values.** Local template: [`.env.example`](../.env.example) (placeholders).
Production values live in Vercel (project settings → Environment Variables); secret ones are stored as *Sensitive*.

Columns: **Secret** = must never be exposed · **Public** = `NEXT_PUBLIC_*`, compiled into the browser bundle (never
put a secret there; `npm run check:secrets` enforces it) · **Prod / Preview** = set in Vercel Production / in the
Preview environment (scoped to the `mobile-first` branch) at the v1.0 baseline (— = not set; code default applies).

## Application

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `NEXT_PUBLIC_BASE_URL` | Canonical origin for email/invitation links, Dodo return URL, metadata, sitemap (`lib/site-url.ts`; production default `https://magicalbirthdayplanner.app`) | no | yes | ✓ | ✓ |
| `NEXT_PUBLIC_EXPERIENCE_ENABLED` | Shows the Party Experience UI (Activities tab, Party Magic). Build-time | no | yes | ✓ (`true`) | — |
| `NEXT_PUBLIC_DISABLE_SW` | Disable the service worker (`true`) | no | yes | — | — |
| `NEXT_PUBLIC_SITE_URL` | Not read by the code (stale preview variable) | no | yes | — | ✓ |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `NODE_ENV`, `NEXT_RUNTIME`, `CI` | Set by the platform/tooling | no | — | auto | auto |
| `NEXT_DIST_DIR` | Test-only build directory (`.next-e2e`) | no | no | — | — |

## Supabase

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | no | yes | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key (RLS protects data) | no (public by design) | yes | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role: billing, AI usage finalize, RSVP RPC, venue cache, analytics, admin | **yes** | no | ✓ | ✓ |
| `DATABASE_URL` / `DIRECT_URL` | Only in `.env.e2e` (local); migrations use `supabase db push --db-url` | **yes** (real) | no | — | — |

## Google

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `GOOGLE_PLACES_API_KEY` | Server key: Places API (New) + Geocoding fallback | **yes** | no | ✓ | ✓ |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser key, Maps JavaScript API only, HTTP-referrer restricted | restricted, not secret | yes | ✓ | — |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Map ID for Advanced Markers | no | yes | ✓ | — |
| `GOOGLE_USER_HOURLY_CALLS`, `GOOGLE_INSTANCE_HOURLY_CALLS` | Cost guards (defaults 60 / 2000) | no | no | — | — |
| `DISCOVERY_MAX_QUERIES`, `DISCOVERY_CONCURRENCY`, `DISCOVERY_DEADLINE_MS`, `DISCOVERY_SEARCH_TTL_HOURS`, `DISCOVERY_DETAILS_TTL_DAYS`, `DISCOVERY_RANKING_WEIGHTS` | Discovery tuning (defaults in code) | no | no | — | — |
| `GOOGLE_PLACES_API_BASE_URL`, `GOOGLE_GEOCODING_API_BASE_URL` | Test-only overrides (mock server) | no | no | never | never |

## Dodo Payments

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `DODO_PAYMENTS_API_KEY` | Create checkouts | **yes** | no | ✓ | — |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Verify Standard Webhooks signatures | **yes** | no | ✓ | — |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` / `live_mode` (production: `live_mode`) | no | no | ✓ | ✓ |
| `DODO_LIVE_PAYMENTS_ENABLED` | Second switch required for live charging (production: `true`) | no | no | ✓ | ✓ |
| `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_PLUS`, `DODO_PRODUCT_PRO` | Dodo product id per plan (not secret) | no | no | ✓ | — |
| `DODO_PRICE_STARTER_CENTS`, `DODO_PRICE_PLUS_CENTS`, `DODO_PRICE_PRO_CENTS` | Optional expected prices for the price-integrity check (defaults 999 / 1999 / 2999 from `lib/entitlements.ts`) | no | no | — | — |
| `DODO_ALLOW_DISCOUNTS` | Accept payments below the plan price (default off → held for review) | no | no | — | — |
| `DODO_API_BASE_URL` | Test-only override (mock server) | no | no | never | never |

## Sentry

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `NEXT_PUBLIC_SENTRY_DSN` | Send-only DSN; empty → Sentry disabled | no (public by design) | yes | ✓ | ✓ |
| `SENTRY_DSN` | Optional server override | no | no | — | — |
| `SENTRY_AUTH_TOKEN` | **Build-time only** source-map upload | **yes** | no | ✓ | — |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Defaults `magical-birthday-planner` / `javascript-nextjs` | no | no | — | — |

## AI

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `AI_ENABLED` | Master switch (`true`) | no | no | ✓ | — |
| `AI_ENABLED_FEATURES` | Comma list of enabled feature ids (production: the 11 sold features) | no | no | ✓ | — |
| `AI_PROVIDER` | `opencode` · `openai` · `anthropic` · `mock` (tests) | no | no | ✓ (`opencode`) | — |
| `AI_API_KEY` | Provider key | **yes** | no | ✓ | — |
| `AI_MODEL`, `AI_BASE_URL` | Model (production `deepseek-v4-pro`) / endpoint override | no | no | ✓ / — | — |
| `AI_THINKING` | Reasoning mode (production `off`) | no | no | ✓ | — |
| `AI_TIMEOUT_MS`, `AI_LONG_TIMEOUT_MS` | Timeouts (production 45000; long default 55000) | no | no | ✓ / — | — |
| `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_RETRIES` | Output cap 3000, 1 repair retry | no | no | ✓ | — |
| `AI_USER_DAILY_LIMIT` | Per-user generations per rolling 24 h (production 10) | no | no | ✓ | — |
| `AI_GLOBAL_DAILY_LIMIT` | Global breaker per UTC day (production 50) | no | no | ✓ | — |
| `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION` | Legacy `/api/themes/ai` route (not configured in production) | key: **yes** | no | — | — |

Per-party allowances (10 / 25 / 50) and the per-user hourly cap (10) are constants in `lib/ai/capabilities.ts`.

## Resend (email)

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `RESEND_API_KEY` | Send email | **yes** | no | ✓ | ✓ |
| `EMAIL_FROM` | Sender (production `Magical Birthday Planner <noreply@magicalbirthdayplanner.app>`) | no | no | ✓ | ✓ |
| `EMAIL_REPLY_TO` | Optional reply-to | no | no | — | — |
| `EMAIL_DAILY_INVITES_PER_USER`, `EMAIL_DAILY_RSVP_EMAILS_PER_PARTY` | Abuse caps (defaults 300 / 200) | no | no | — | — |
| `RESEND_BASE_URL` | Test-only override (mock server) | no | no | never | never |

## Vercel

Vercel itself provides `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`. Deployment settings (production branch `master`,
domains, the variables above) are managed in the Vercel project; nothing Vercel-specific needs to be set by hand
besides the variables listed here.
