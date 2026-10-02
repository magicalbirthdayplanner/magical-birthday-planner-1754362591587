# Integrations status

_Updated 2026-10-02 · branch `mobile-first`. Credentials live only in the secure environment
(never in the repo); values are never printed by tooling._

| Integration | Code | Automated tests | Real-service verification | Blocker |
|---|---|---|---|---|
| **Supabase** | Complete (auth, RLS, migrations 0000–0500) | 112 integration tests on local Supabase | Supplied `sb_secret_…` key returns **401** against the configured project `hgczncztmdqtfhqimfar` | Need the intended project’s URL (and publishable key); then read-only schema diff |
| **Google Places** | Complete (Places API New, server-side key, cost guards) | unit + integration with mock Google | Not tested — **no Google key supplied** (the old key is leaked and must be rotated) | New server key |
| **Google Maps** | Complete (`@vis.gl/react-google-maps` + MarkerClusterer; schematic fallback) | E2E uses schematic fallback | Not tested — **no browser key supplied** | New referrer-restricted browser key + Map ID |
| **Resend** | Complete: invitation email, RSVP confirmation, host notification; escaped templates; idempotency keys; `email_logs`; failures never break the action | 9 integration tests (fake Resend) + E2E journey | **Key verified**: real send to Resend’s test inbox via `onboarding@resend.dev` succeeded. Sending from `noreply@magicalbirthdayplanner.com` is **rejected: domain not verified** | Add DNS records (below) |
| **Dodo Payments** | Complete: server-created checkout, Standard-Webhooks verification, idempotency, out-of-order protection, customer mapping, refunds, subscription lifecycle, server-side entitlement | 12 unit + 18 integration + 2 E2E (mock Dodo test mode with signed webhooks) | Not tested — **no Dodo credentials supplied** | Test-mode API key, webhook secret, test product ids |
| **GitHub** | — | — | Token valid; push permission on the repo | — |
| **Vercel** | Ready (`vercel.json`, env split) | — | Token valid; **no project exists** under this token and it cannot list teams | Supabase + Google values needed for a functional preview |

## Manual configuration required

### Resend — verify `magicalbirthdayplanner.com` (status: failed)
Add these records at the DNS provider (full values are on resend.com → Domains), then click Verify:

| Purpose | Type | Name | Value |
|---|---|---|---|
| DKIM | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEB…` (copy from Resend) |
| SPF (bounce) | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) |
| SPF | TXT | `send` | `v=spf1 include:amazonses.com ~all` |

Recommended: DMARC `TXT _dmarc "v=DMARC1; p=none; rua=mailto:…"`. Also configure Supabase Auth →
SMTP to use Resend so password-reset/confirmation emails come from the same domain.

### Dodo Payments (test mode first)
1. Dashboard → Test mode → Products: create **Starter $9.99, Plus $19.99, Pro $29.99** (one-time,
   “per party”, matching `/pricing`) → set `DODO_PRODUCT_STARTER/PLUS/PRO`.
2. Developer → API keys (test) → `DODO_PAYMENTS_API_KEY`; keep `DODO_PAYMENTS_ENVIRONMENT=test_mode`.
3. Developer → Webhooks → endpoint `https://<preview-or-prod-domain>/api/webhooks/dodo`, events:
   `payment.succeeded`, `payment.failed`, `payment.cancelled`, `payment.processing`,
   `refund.succeeded`, all `subscription.*` → copy the signing secret to `DODO_PAYMENTS_WEBHOOK_SECRET`.
4. Live mode later: separate live keys/products, `DODO_PAYMENTS_ENVIRONMENT=live_mode` **and**
   `DODO_LIVE_PAYMENTS_ENABLED=true` (both required; otherwise checkout refuses).

### Google Cloud
* Server key: Places API (New) + Geocoding API only; application restriction by IP if possible.
* Browser key: Maps JavaScript API only; HTTP referrers = production + preview domains.
* Quotas per API (requests/day and /minute) and a billing budget with alerts — see
  `GOOGLE_PLACES_COST_CONTROL.md`.

### Supabase
* Provide the **project URL** for the `sb_secret_…` key (and the publishable/anon key).
* Auth → URL configuration: Site URL = production domain; redirect allow-list:
  `https://<domain>/auth/callback**`, `https://<domain>/reset-password`, preview domain equivalents.
* Then: read-only diff (`PRODUCTION_SCHEMA_DIFF.md`), and — with explicit approval — apply
  migrations 0100 → 0500.

### Vercel
Create the project from the GitHub repo (or `vercel link`), set env vars for **Preview** and
**Production** separately from `.env.example` (PUBLIC vs SERVER), test-mode Dodo values on Preview.
