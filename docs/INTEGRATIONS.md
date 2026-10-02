# Integrations status

_Updated 2026-10-02 · branch `mobile-first`. Credentials live only in the secure environment
(never in the repo); values are never printed by tooling._

| Integration | Code | Automated tests | Real-service verification | Blocker |
|---|---|---|---|---|
| **Supabase** | Complete (auth, RLS, migrations 0000–0500) | 112 integration tests on local Supabase | New project `fnrgybrhmjtokmotqotk`: all migrations applied, schema identical to tested schema, prod RLS smoke passed, used by the Preview UAT | Auth → URL configuration (Site URL / redirects) must be set in the dashboard |
| **Google Places API (New)** (venue provider) | Complete: Text Search with hard `locationRestriction`, field masks, cache-first (24 h search / 7 d details), duplicate in-flight suppression, server-side radius filter, details only on open, photos via server proxy | unit + integration + E2E with mock Google | Key supplied 2026-10-02 but Google returns **403 PERMISSION_DENIED** — billing not enabled / Places API (New) not enabled for the key's project | Enable billing + Places API (New) on the key's Google Cloud project |
| **Google Maps JavaScript API** (map) | Complete (`GoogleMapView`: AdvancedMarker + MarkerClusterer, select/pan, list/map sync); schematic fallback without a key | E2E uses schematic fallback | **No browser key supplied** | Separate referrer-restricted browser key + Map ID |
| **Geoapify** | Removed 2026-10-02 (was the provider between 9f25ef0 and this migration). Venues saved then keep `geo_` ids and stay readable (OSM attribution kept for them) | — | — | — |
| **Resend** | Complete: invitation email, RSVP confirmation, host notification; escaped templates; idempotency keys; `email_logs`; failures never break the action | 9 integration tests (fake Resend) + E2E journey | **Verified 2026-10-02 with the real API through the app**: invitation, RSVP confirmation and host notification all **delivered** from `Magical Birthday Planner <onboarding@resend.dev>`; invitation link and RSVP link worked | Shared sender delivers only to the Resend account owner’s address and Resend test inboxes (Resend policy) — real guests need a verified domain |
| **Dodo Payments** | Complete: server-created checkout, Standard-Webhooks verification, idempotency, out-of-order protection, customer mapping, refunds, subscription lifecycle, server-side entitlement | 12 unit + 18 integration + 2 E2E (mock Dodo test mode with signed webhooks) | Not tested — **no Dodo credentials supplied** | Test-mode API key, webhook secret, test product ids |
| **GitHub** | — | — | Token valid; push permission on the repo | — |
| **Vercel** | Preview live: existing git-linked project; env vars scoped to Preview + branch `mobile-first` only (production env untouched) | — | **Full UAT journey passed 2026-10-02 on the branch preview** (sign-in, wizard, Geoapify discovery 58 venues, detail/save, tiled map, theme, guests, real invitation email → link → RSVP → confirmation + host emails delivered, checklist, checkout refused safely without Dodo, no secrets in shipped JS, logout/login persistence; test user deleted) | Production domain: project still has the no-longer-owned domain attached; Supabase Auth URL config is manual |

## Manual configuration required

### Resend — sender
`magicalbirthdayplanner.com` is **no longer owned** and must not be used. The account has no
verified domain, so the app uses Resend’s shared sender **`Magical Birthday Planner
<onboarding@resend.dev>`** (default when `EMAIL_FROM` is empty; no reply-to unless
`EMAIL_REPLY_TO` is set). Resend restricts this sender to the account owner’s own address (and
`*@resend.dev` test inboxes), so **invitations to real guests will be rejected by Resend** until a
domain you own is verified in Resend and `EMAIL_FROM` is set to it. The app degrades gracefully:
failed sends are logged, the invite link can still be shared by text/copy, RSVPs always succeed.

Password-reset and sign-up confirmation emails are sent by **Supabase Auth’s own mailer**, not by
this Resend integration (configure Supabase → Auth → SMTP once a verified domain exists).

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
* Enable **billing**, **Places API (New)** and **Maps JavaScript API** on the project. Geocoding API is
  optional (only used for ZIPs missing from the offline dataset).
* Server key (`GOOGLE_PLACES_API_KEY`): API restriction = Places API (New) (+ Geocoding API if enabled);
  application restriction: none/IP (Vercel egress IPs are not fixed). Never `NEXT_PUBLIC_`.
* Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): API restriction = Maps JavaScript API only;
  application restriction = HTTP referrers: `https://*-magical-birthday-planner.vercel.app/*`,
  `http://localhost:3100/*`, plus your future production domain. Create a Map ID
  (`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, required for Advanced Markers).
* Quotas + budget alerts: see `GOOGLE_PLACES_COST_CONTROL.md`.

### Supabase
* Provide the **project URL** for the `sb_secret_…` key (and the publishable/anon key).
* Auth → URL configuration: Site URL = production domain; redirect allow-list:
  `https://<domain>/auth/callback**`, `https://<domain>/reset-password`, preview domain equivalents.
* Then: read-only diff (`PRODUCTION_SCHEMA_DIFF.md`), and — with explicit approval — apply
  migrations 0100 → 0500.

### Vercel (state 2026-10-02)
* `magicalbirthdayplanner.com` and `www.` were **removed from the project** (no longer owned). Only
  `magical-birthday-planner.vercel.app` remains. `vercel.production.json` no longer lists them.
  The apex still exists as a **team-level** domain record (Team → Domains) — remove it there too.
* `mobile-first` Preview uses branch-scoped variables only (new Supabase, Resend, Dodo
  test mode, Preview URL; Google Places server key). **Old shared entries still target Preview + Development** and hold the
  old/leaked values: `NEXT_PUBLIC_SUPABASE_URL` (old project `hgcz…`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `DATABASE_URL`. Branch
  overrides win for `mobile-first` (including `GOOGLE_PLACES_API_KEY`); `DATABASE_URL` has no override
  and still reaches its Preview runtime (scripts-only, unused by the app).
  Untick **Preview** and **Development** on those six (keep Production until production is migrated).
  Branches `development`, `staging`, `production` are stale (Aug 2025, nothing beyond `master`,
  never deployed) — nothing active depends on the shared Preview values.
* Previews are behind Vercel Authentication. **Dodo webhooks cannot reach a protected Preview**: for
  sandbox testing create a Protection Bypass for Automation secret and use
  `https://<preview>/api/webhooks/dodo?x-vercel-protection-bypass=<secret>` as the Dodo endpoint
  (or exempt the Preview), then revoke it afterwards.

### Supabase Auth URL configuration (dashboard → Authentication → URL Configuration)
Verified 2026-10-02: Site URL is still the default `http://localhost:3000` and the Preview is not
allow-listed, so confirmation/reset links would point to localhost. Set:
* Site URL: `https://magical-birthday-planner-17-git-ef697a-magical-birthday-planner.vercel.app`
* Redirect URLs:
  `https://magical-birthday-planner-17-git-ef697a-magical-birthday-planner.vercel.app/auth/callback**`
  and `https://magical-birthday-planner-17-git-ef697a-magical-birthday-planner.vercel.app/reset-password`
Sign-up confirmation now returns to `/auth/callback?next=/home` (previously it ended on `/signin`
without a session); both flows were verified end-to-end on local Supabase.

Create the project from the GitHub repo (or `vercel link`), set env vars for **Preview** and
**Production** separately from `.env.example` (PUBLIC vs SERVER), test-mode Dodo values on Preview.
