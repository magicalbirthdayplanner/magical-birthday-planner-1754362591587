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
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel (dataset) ID for Facebook/Instagram ads measurement (components/analytics/MetaPixel.tsx). Unset → no pixel. Public value (it appears in page source); build-time, redeploy after changing | no | no | — | — |
| `CRON_SECRET` | Bearer secret for Vercel Cron `/api/cron/*` (≥ 16 chars). Used by the founder marketing agent's scheduler (`/api/cron/marketing`); without it the scheduler refuses to run | yes | no | ✓ | — |

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

## Founder marketing agent (X)

Details and the go-live checklist: [marketing/FOUNDER_MARKETING_AGENT.md](marketing/FOUNDER_MARKETING_AGENT.md) and
[marketing/X_GROWTH_ENGINE.md](marketing/X_GROWTH_ENGINE.md). Defaults are safe: dry-run ON, autonomous publishing OFF;
cadence 8 posts/day inside the monthly budgets.

| Variable | Purpose | Secret | Public | Prod | Preview |
|---|---|:-:|:-:|:-:|:-:|
| `X_API_KEY`, `X_API_SECRET` | X app Consumer Key / Secret (OAuth 1.0a) | **yes** | no | — | — |
| `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` | Posting account's Access Token / Secret (app must have *Read and write* before generating them) | **yes** | no | — | — |
| `MARKETING_DRY_RUN` | Default `true`; only the exact string `false` lets anything reach X | no | no | — | — |
| `AUTONOMOUS_PUBLISHING` | Default `false`; exactly `true` lets the scheduler publish (the admin switch must also be ON) | no | no | — | — |
| `MARKETING_POSTS_PER_DAY` | 1–8 (default 8, hard cap 8); the budget may publish fewer | no | no | — | — |
| `MARKETING_POST_TIMES`, `MARKETING_TIMEZONE` | Local slots (default `08:00,10:30,12:30,14:30,16:30,18:00,19:30,21:00`) and zone (default `America/New_York`) | no | no | — | — |
| `MARKETING_MIN_GAP_MINUTES`, `MARKETING_PUBLISH_EARLY_MINUTES` | Spacing (60) and early-publish window (90) | no | no | — | — |
| `MARKETING_URL_SHARE` | Max share of posts with the product link (0.1, max 0.4) — X bills $0.20 per link post, so the budget usually allows fewer | no | no | — | — |
| `MONTHLY_X_BUDGET_USD`, `MARKETING_X_RESERVE_USD` | Hard monthly X API budget (5) and the part never spent (0.25) | no | no | — | — |
| `MONTHLY_AI_BUDGET_USD`, `MARKETING_AI_USD_PER_1M_TOKENS` | AI budget for copy/images/video (2) and the token price used for estimates (2) | no | no | — | — |
| `MARKETING_X_PRICE_<OP>` | Override an X rate (`POST_CREATE`, `POST_CREATE_URL`, `POST_READ`, `OWNED_READ`, `USER_READ`, `MEDIA_METADATA`, `MEDIA_UPLOAD`) | no | no | — | — |
| `MARKETING_X_ALT_TEXT` | `auto` (only while GREEN) · `on` · `off` — alt text is a billed call | no | no | — | — |
| `MARKETING_METRICS_WINDOWS` | Hours-ago windows read once a day (`24-48,168-192`) | no | no | — | — |
| `MARKETING_SCORE_WEIGHTS` | Business-score weights (JSON) | no | no | — | — |
| `MARKETING_UTM_CAMPAIGN` | `utm_campaign` for X links (`mbp_x_growth`) | no | no | — | — |
| `MARKETING_MEDIA_SOURCE_DIR` | Seed script only: where the campaign media files are | no | no | never | never |
| `MARKETING_X_MAX_CHARS` | Weighted-character limit (280) | no | no | — | — |
| `MARKETING_IMAGE_PROVIDER` | `brand` (default, no API) · `openai` · `none` | no | no | — | — |
| `OPENAI_API_KEY`, `MARKETING_IMAGE_MODEL` | Only for `openai` images (`gpt-image-1`) | **yes** / no | no | — | — |
| `MARKETING_AI_MODEL` | Optional copy-model override (same `AI_PROVIDER`/`AI_API_KEY`) | no | no | — | — |
| `MARKETING_AUTO_DRAFT` | One review draft a day while autonomous is off (default on) | no | no | — | — |
| `MARKETING_BRIEF_EMAIL` | Daily brief recipient (optional) | no | no | — | — |
| `MARKETING_LAUNCH_DATE` | Launch date (default `2026-10-13`) | no | no | — | — |
| `MARKETING_LEARNING_INTERVAL_DAYS`, `MARKETING_LEARNING_WINDOW_DAYS` | Learning cadence (1) and window (30) | no | no | — | — |
| `MARKETING_FORBIDDEN_TERMS` | Comma list never allowed in posts (founder/family names) | no (keep private) | no | — | — |
| `MARKETING_X_USERNAME` | Optional handle for post URLs | no | no | — | — |

## Vercel

Vercel itself provides `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`. Deployment settings (production branch `master`,
domains, the variables above) are managed in the Vercel project; nothing Vercel-specific needs to be set by hand
besides the variables listed here.
