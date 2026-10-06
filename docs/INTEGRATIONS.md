# Integrations

Credentials live only in the deployment environment (Vercel) or a local `.env.local`. They are never
in the repository, and tooling never prints values. Variable list: [`.env.example`](../.env.example).

## Status

| Service | Used for | Code | Automated tests | Real-service status | Blocker |
|---|---|---|---|---|---|
| **Supabase** | Auth (email/password + Google OAuth), Postgres + RLS, RPCs | Complete (`supabase/migrations`, 13 migrations) | Integration suite on local Supabase | Production: all migrations through `20251004001200` applied; RLS verified cross-user | — |
| **Google Places API (New)** | Venue search, details, photos | Complete: field masks, hard `locationRestriction`, cache-first (24 h / 7 d), in-flight dedupe, deadline, budgets | Unit + integration + E2E against `tests/mock-google` | Live in production (real results, details, photos) | Keep GCP quota caps + billing alerts |
| **Google Maps JavaScript API** | Map (`GoogleMapView`: Advanced Markers, clustering) | Complete. Simplified map when no key | E2E (simplified map) | Live in production (referrer-restricted browser key + Map ID) | — |
| **Resend** | Invitation, RSVP confirmation, host notification; Supabase auth email via SMTP | Complete: escaped templates, idempotency keys, `email_logs`, daily caps; failures never break the action | Integration + E2E (mock) | Production sends from the verified domain's `noreply@` address (delivered in production smoke tests) | — |
| **Dodo Payments** | Checkout, webhook, entitlements | Complete (`BILLING_SECURITY.md`) | Unit + integration + E2E (mock test mode, signed webhooks) | **Live mode** in production; live checkout session verified; no live payment processed yet | One real purchase + refund (owner) |
| **AI provider** (OpenAI-compatible) | All AI features (`lib/ai/*`) | Complete: provider abstraction, timeouts, retry, validation, server-only usage accounting | Unit + integration + E2E with a deterministic mock; opt-in live checks (`vitest.live.config.ts`) | Live: six features enabled (see `docs/ai/AI_FEATURES.md`) | — |
| **Sentry** | Errors, tracing, logs, metrics, alerts, uptime | Complete (`docs/OBSERVABILITY.md`) | Unit + integration (in-memory Sentry mock) | Live; source maps uploaded at build | — |
| **Azure OpenAI** (legacy, optional) | Old AI theme ideas route (`/api/themes/ai`) | Kept for compatibility | Unit | **Not configured** in production (route returns 503) | Retire |
| **Vercel** | Hosting | `vercel.json` | — | Production on the canonical domain (SSL, `www` and `*.vercel.app` → 308 apex) from `master`; Preview on `mobile-first` (branch-scoped env vars) | — |
| **Cloudflare** | DNS for `magicalbirthdayplanner.app` | — | — | Web + Resend records configured (below) | — |

## Setup notes

### Resend
* Domain `magicalbirthdayplanner.app` is verified (DKIM `resend._domainkey`; SPF MX + TXT on `send`;
  CNAME `rsend`). `EMAIL_FROM=Magical Birthday Planner <noreply@magicalbirthdayplanner.app>` is set
  for Production and the `mobile-first` Preview.
* `EMAIL_FROM` empty (local/tests) → Resend's shared test sender, which only reaches the account owner.
* Recommended before volume sending: a DMARC record (`_dmarc` TXT, e.g. `v=DMARC1; p=none; rua=mailto:…`).
* Sign-up confirmation and password-reset emails are sent by **Supabase Auth**, not by this
  integration. Point Supabase → Auth → SMTP at the same verified domain (Resend offers SMTP).

### Supabase Auth (dashboard → Authentication → URL Configuration)
* **Site URL:** `https://magicalbirthdayplanner.app`
* **Redirect URLs:** `https://magicalbirthdayplanner.app/auth/callback**`,
  `https://magicalbirthdayplanner.app/reset-password`, and for UAT
  `https://magical-birthday-planner-17-git-ef697a-magical-birthday-planner.vercel.app/auth/callback**` and `…/reset-password`.
* Until this is set, confirmation and reset links fall back to the default Site URL, `http://localhost:3000`.

### Dodo Payments (test mode first)
1. Products (non-recurring, USD; one purchase unlocks one party): Starter $9.99, Plus $19.99, Pro $29.99 (live products exist;
   test mode needs its own),
   then set `DODO_PRODUCT_STARTER/PLUS/PRO`.
2. API key (test) → `DODO_PAYMENTS_API_KEY`. Keep `DODO_PAYMENTS_ENVIRONMENT=test_mode`.
3. Webhooks → endpoint `<origin>/api/webhooks/dodo`. Subscribe to:
   * `payment.succeeded`, `payment.failed`, `payment.cancelled`, `payment.processing`
   * `refund.succeeded`
   * all `subscription.*` events

   Copy the signing secret to `DODO_PAYMENTS_WEBHOOK_SECRET`.
4. Previews are behind Vercel Authentication, so Dodo's webhook can't reach them directly. For
   sandbox tests, create a Protection Bypass for Automation secret and use
   `<preview>/api/webhooks/dodo?x-vercel-protection-bypass=<secret>`. Revoke it afterwards.
5. Live mode: separate live keys, products and webhook endpoint (and its own signing secret), plus
   `DODO_PAYMENTS_ENVIRONMENT=live_mode` **and** `DODO_LIVE_PAYMENTS_ENABLED=true`. Without both, checkout
   refuses to charge. Live product prices must match `/pricing` (999 / 1999 / 2999 USD cents): a USD payment
   below the expected price is held for review instead of granting (check with `npm run check:dodo-prices`;
   change a price by re-pricing the product in Dodo and `PLAN_INFO` together, then deploy). Saved customer ids are tagged per mode
   (`billing_customers.provider` = `dodo` sandbox / `dodo_live`), so a sandbox customer is never sent to live.
   Production went live 2026-10-03; rollback = the sandbox values (test key, products, webhook secret) +
   `DODO_PAYMENTS_ENVIRONMENT=test_mode`, `DODO_LIVE_PAYMENTS_ENABLED=false`, then redeploy.

### Google Cloud
* Server key (`GOOGLE_PLACES_API_KEY`): API restriction Places API (New), plus Geocoding API if enabled.
* Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): Maps JavaScript API only. HTTP referrers:
  `https://*-magical-birthday-planner.vercel.app/*`, `http://localhost:3100/*` and the production domain.
* Create a Map ID (`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`).
* Quotas and a budget alert: see `GOOGLE_PLACES_COST_CONTROL.md`.

### Vercel
* **Domains:**
  * `magicalbirthdayplanner.app` is the production domain.
  * `www.magicalbirthdayplanner.app` and `magical-birthday-planner.vercel.app` 308-redirect to it.
  * Previews stay on their own protected URLs.
* **Production deployment:** built from `mobile-first` and served on the domain.
  * The project's production branch setting is still `master` (the retired app).
  * Vercel refuses to switch it while `mobile-first` has branch-scoped Preview variables.
  * Merge `mobile-first` into `master` (or move the Preview variables and switch the setting) before
    the next production deploy, so a push to `master` can't redeploy the retired app.
* **Environment variables:**
  * The old shared Development/Preview/Production entries with old credentials were **removed**.
  * Production has its own entries: Supabase, Resend + `EMAIL_FROM`, Google Places,
    `NEXT_PUBLIC_BASE_URL=https://magicalbirthdayplanner.app`, `DODO_LIVE_PAYMENTS_ENABLED=false`.
  * Preview (`mobile-first`) keeps its branch-scoped entries.
  * Development has none (use `.env.local`).

### Cloudflare DNS (`magicalbirthdayplanner.app`, all DNS-only / not proxied)
| Type | Name | Value | Purpose |
|---|---|---|---|
| A | `@` | `216.198.79.1` | Vercel |
| A | `@` | `64.29.17.1` | Vercel |
| CNAME | `www` | `01d134b1b48722af.vercel-dns-017.com` | Vercel (redirects to apex) |
| TXT | `resend._domainkey` | DKIM public key | Resend |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (10) | Resend (bounce/SPF) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Resend SPF |
| CNAME | `rsend` | `send.forge.rmta.net` | Resend |

No apex MX exists: the domain doesn't receive mail. Add inbound mail (e.g. Cloudflare Email
Routing) separately if you want `reply-to` / support addresses on this domain.
