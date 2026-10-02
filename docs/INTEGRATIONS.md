# Integrations

Credentials live only in the deployment environment (Vercel) or a local `.env.local`. They are never
in the repository, and tooling never prints values. Variable list: [`.env.example`](../.env.example).

## Status

| Service | Used for | Code | Automated tests | Real-service status | Blocker |
|---|---|---|---|---|---|
| **Supabase** | Auth (email/password), Postgres + RLS | Complete (`supabase/migrations`) | Integration suite on local Supabase | Production project: all migrations through `0500` applied, schema matches the migrations, RLS verified cross-user | Auth URL settings and SMTP (below). Migration `0600` awaits approval. |
| **Google Places API (New)** | Venue search, details, photos | Complete: field masks, hard `locationRestriction`, cache-first (24 h / 7 d), in-flight dedupe, deadline, budgets | Unit + integration + E2E against `tests/mock-google` | Supplied key returns **403** (billing / Places API (New) not enabled) | Enable billing and the API; set quotas |
| **Google Maps JavaScript API** | Map (`GoogleMapView`: Advanced Markers, clustering) | Complete. Simplified map when no key | E2E (simplified map) | No browser key yet | Referrer-restricted browser key + Map ID |
| **Resend** | Invitation, RSVP confirmation, host notification | Complete: escaped templates, idempotency keys, `email_logs`, daily caps; failures never break the action | Integration + E2E (mock) | Delivered through the real API on Preview | `EMAIL_FROM` on a domain verified in Resend (the shared test sender only reaches the account owner) |
| **Dodo Payments** | Checkout, webhook, entitlements | Complete (`BILLING_SECURITY.md`) | Unit + integration + E2E (mock test mode, signed webhooks) | Not yet run against the real sandbox | Test-mode API key, webhook secret, product ids |
| **Azure OpenAI** (optional) | AI theme ideas on the Theme screen (`/api/themes/ai`) | Complete: auth, per-user limit, 30-day cache, timeout | Unit | Uses the configured deployment | None (feature hides when unset) |
| **Vercel** | Hosting (Preview = UAT) | `vercel.json` | — | Preview on branch `mobile-first` verified end-to-end | Production environment and domain (below) |

## Setup notes

### Resend
* `EMAIL_FROM` empty → Resend's shared test sender, which only delivers to the Resend account owner.
* Before launch: verify a domain you own in Resend, then set `EMAIL_FROM` (and optionally
  `EMAIL_REPLY_TO`).
* Sign-up confirmation and password-reset emails are sent by **Supabase Auth**, not by this
  integration. Point Supabase → Auth → SMTP at the same verified domain (Resend offers SMTP).

### Supabase Auth (dashboard → Authentication → URL Configuration)
* **Site URL:** the deployment origin. For the Preview:
  `https://magical-birthday-planner-17-git-ef697a-magical-birthday-planner.vercel.app`
* **Redirect URLs:** `<origin>/auth/callback**` and `<origin>/reset-password` for each origin in use.
* Until this is set, confirmation and reset links fall back to the default Site URL, `http://localhost:3000`.

### Dodo Payments (test mode first)
1. Test mode → Products: create Starter $9.99, Plus $19.99 and Pro $29.99 (one-time, per party),
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
5. Live mode later: separate live keys and products, plus `DODO_PAYMENTS_ENVIRONMENT=live_mode` **and**
   `DODO_LIVE_PAYMENTS_ENABLED=true`. Without both, checkout refuses to charge.

### Google Cloud
* Server key (`GOOGLE_PLACES_API_KEY`): API restriction Places API (New), plus Geocoding API if enabled.
* Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): Maps JavaScript API only. HTTP referrers:
  `https://*-magical-birthday-planner.vercel.app/*`, `http://localhost:3100/*` and the production domain.
* Create a Map ID (`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`).
* Quotas and a budget alert: see `GOOGLE_PLACES_COST_CONTROL.md`.

### Vercel
* **Preview** (`mobile-first`) uses branch-scoped variables only.
* **Old shared entries.** These still target Preview + Development and hold old credentials:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `DATABASE_URL`.
  * Untick Preview and Development on each.
  * Replace their Production values when production is set up.
* **Domains:** the project serves only `magical-birthday-planner.vercel.app`. Remove the previous
  domain's leftover team-level record (Team → Domains). Add the new production domain when chosen.
